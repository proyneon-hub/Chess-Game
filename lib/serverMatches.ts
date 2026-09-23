import { createHash, randomBytes, randomUUID } from "node:crypto";
import { connectToDatabase } from "@/lib/db";
import {
  type GameState,
  type Side,
  createGameState,
  submitMove,
} from "@/lib/game";
import { publicState, type PublicMatch } from "@/lib/game/publicState";
import { migrateState } from "@/lib/game/migrate";
import {
  parseAction,
  type ActionRequest,
  UUID,
  validateState,
} from "@/lib/game/validation";
import { rulesFor } from "@/lib/rpg/config";
import { GameMatch, MATCH_RETENTION_MS } from "@/models/GameMatch";
export type { PublicMatch } from "@/lib/game/publicState";
type Receipt = {
  playerId: string;
  actionId: string;
  hash: string;
  version: number;
  /** Written by older releases; never read. */
  outcome?: GameState["lastAction"];
};
type StoredMatch = {
  inviteId: string;
  whitePlayerId: string;
  blackPlayerId: string | null;
  state: GameState;
  version: number;
  receipts?: Receipt[];
};
const stored = (v: unknown): StoredMatch => v as StoredMatch;
const expiry = () => new Date(Date.now() + MATCH_RETENTION_MS);
// A soft cap on unjoined invites per guest per day, against accidental floods.
const OPEN_INVITE_LIMIT = 20;
export async function tooManyOpenInvites(playerId: string) {
  await connectToDatabase();
  const open = await GameMatch.countDocuments({
    whitePlayerId: playerId,
    blackPlayerId: null,
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  });
  return open >= OPEN_INVITE_LIMIT;
}
const playerSide = (m: StoredMatch, id: string): Side | null =>
  m.whitePlayerId === id ? "white" : m.blackPlayerId === id ? "black" : null;
export const publicMatch = (m: StoredMatch, id: string): PublicMatch => ({
  id: m.inviteId,
  playerSide: playerSide(m, id),
  waitingForOpponent: !m.blackPlayerId,
  version: m.version,
  state: publicState(migrateState(m.state)),
});
export async function createServerMatch(playerId: string) {
  await connectToDatabase();
  const state = createGameState(randomBytes(4).readUInt32LE());
  const match = await GameMatch.create({
    inviteId: randomUUID(),
    whitePlayerId: playerId,
    state,
    version: 1,
    receipts: [],
    schemaVersion: state.schemaVersion,
    rulesetVersion: state.rulesetVersion,
    configVersion: state.configVersion,
    expiresAt: expiry(),
  });
  return publicMatch(stored(match.toObject()), playerId);
}
/** Cheap poll check: the version bumps on every commit and on join. */
export async function isCurrentVersion(inviteId: string, version: number) {
  if (!UUID.test(inviteId) || !Number.isSafeInteger(version)) return false;
  await connectToDatabase();
  return !!(await GameMatch.exists({ inviteId, version }));
}
export async function getServerMatch(inviteId: string, playerId: string) {
  if (!UUID.test(inviteId)) return null;
  await connectToDatabase();
  const m = await GameMatch.findOne({ inviteId }).lean();
  return m ? publicMatch(stored(m), playerId) : null;
}
const response = (
  status: number,
  error: string | null,
  match: PublicMatch | null = null,
  duplicate = false,
) => ({ status, error, match, duplicate });
export async function joinServerMatch(inviteId: string, playerId: string) {
  if (!UUID.test(inviteId)) return response(404, "Match not found.");
  await connectToDatabase();
  const found = await GameMatch.findOne({ inviteId }).lean();
  if (!found) return response(404, "Match not found.");
  const m = stored(found);
  migrateState(m.state);
  if (playerSide(m, playerId))
    return response(200, null, publicMatch(m, playerId));
  const claimed = await GameMatch.findOneAndUpdate(
    { inviteId, blackPlayerId: null, version: m.version },
    {
      $set: { blackPlayerId: playerId, expiresAt: expiry() },
      $inc: { version: 1 },
    },
    { new: true },
  ).lean();
  return claimed
    ? response(200, null, publicMatch(stored(claimed), playerId))
    : response(409, "This game already has two players.");
}
// Canonical JSON hash is independent of key order. Promotion normalization is
// based on the submitted shape: omitted promotion and q are equivalent, while
// no other request fields (including expected revision) may change on retry.
export const requestHash = (m: ActionRequest) =>
  createHash("sha256")
    .update(
      JSON.stringify(
        "type" in m
          ? { type: m.type, expectedVersion: m.expectedVersion }
          : {
              from: m.from,
              to: m.to,
              promotion: m.promotion ?? "q",
              expectedVersion: m.expectedVersion,
            },
      ),
    )
    .digest("hex");
function receiptResponse(
  m: StoredMatch,
  playerId: string,
  action: ActionRequest,
  hash: string,
) {
  const receipt = m.receipts?.find(
    (r) => r.playerId === playerId && r.actionId === action.actionId,
  );
  return receipt
    ? receipt.hash === hash
      ? {
          ...response(200, null, publicMatch(m, playerId), true),
          committedVersion: receipt.version,
        }
      : response(
          409,
          "This action id was already used for a different request.",
          publicMatch(m, playerId),
        )
    : null;
}
export async function submitServerMove(
  inviteId: string,
  playerId: string,
  input: unknown,
) {
  const action = parseAction(input);
  if (!action) return response(400, "A valid action is required.");
  if (!UUID.test(inviteId)) return response(404, "Match not found.");
  await connectToDatabase();
  const found = await GameMatch.findOne({ inviteId }).lean();
  if (!found) return response(404, "Match not found.");
  const m = stored(found),
    side = playerSide(m, playerId);
  if (!side) return response(403, "You are not a player in this match.");
  const state = migrateState(m.state),
    hash = requestHash(action),
    duplicate = receiptResponse(m, playerId, action, hash);
  if (duplicate) return duplicate;
  if (action.expectedVersion !== m.version)
    return response(
      409,
      "The board changed. Select a move from the current position.",
      publicMatch(m, playerId),
    );
  if (!m.blackPlayerId)
    return response(409, "Waiting for an opponent.", publicMatch(m, playerId));
  const intent =
    "type" in action
      ? { type: action.type, side }
      : { from: action.from, to: action.to, promotion: action.promotion, side };
  const result = submitMove(state, intent);
  if (!result.requestAccepted)
    return response(422, result.message, publicMatch(m, playerId));
  validateState(result.state);
  const receipts = [
    ...(m.receipts ?? []),
    {
      playerId,
      actionId: action.actionId,
      hash,
      version: m.version + 1,
    },
  ].slice(-rulesFor(state).receiptLimit);
  const updated = await GameMatch.findOneAndUpdate(
    { inviteId, version: m.version },
    {
      $set: {
        state: result.state,
        receipts,
        schemaVersion: result.state.schemaVersion,
        rulesetVersion: result.state.rulesetVersion,
        configVersion: result.state.configVersion,
        expiresAt: expiry(),
      },
      $inc: { version: 1 },
    },
    { new: true },
  ).lean();
  if (updated)
    return response(200, null, publicMatch(stored(updated), playerId));
  const current = await GameMatch.findOne({ inviteId }).lean();
  if (!current) return response(404, "Match not found.");
  const latest = stored(current);
  return (
    receiptResponse(latest, playerId, action, hash) ??
    response(
      409,
      "The board changed. Select a move from the current position.",
      publicMatch(latest, playerId),
    )
  );
}
