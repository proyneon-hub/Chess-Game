import { randomUUID } from "crypto";
import { connectToDatabase } from "@/lib/db";
import { type GameState, type MoveAttempt, type Side, createGameState, submitMove } from "@/lib/game";
import { GameMatch } from "@/models/GameMatch";

type StoredMatch = {
  inviteId: string;
  whitePlayerId: string;
  blackPlayerId: string | null;
  state: GameState;
  version: number;
};

export type PublicMatch = {
  id: string;
  playerSide: Side | null;
  waitingForOpponent: boolean;
  version: number;
  state: Omit<GameState, "pieceIds" | "rpgState">;
};

const toStoredMatch = (value: unknown) => value as StoredMatch;

const publicMatch = (match: StoredMatch, playerId: string): PublicMatch => {
  const playerSide = match.whitePlayerId === playerId
    ? "white"
    : match.blackPlayerId === playerId
      ? "black"
      : null;
  const { pieceIds: _pieceIds, rpgState: _rpgState, ...state } = match.state;
  return {
    id: match.inviteId,
    playerSide,
    waitingForOpponent: !match.blackPlayerId,
    version: match.version,
    state,
  };
};

export const createServerMatch = async (playerId: string) => {
  await connectToDatabase();
  const match = await GameMatch.create({
    inviteId: randomUUID(),
    whitePlayerId: playerId,
    state: createGameState(),
    version: 1,
  });
  return publicMatch(toStoredMatch(match.toObject()), playerId);
};

export const getServerMatch = async (inviteId: string, playerId: string) => {
  await connectToDatabase();
  const match = await GameMatch.findOne({ inviteId }).lean();
  if (!match) return null;
  return publicMatch(toStoredMatch(match), playerId);
};

// Joining is deliberately separate from reading an invite. Link-preview bots
// and curious visitors can inspect a waiting game without consuming Black.
export const joinServerMatch = async (inviteId: string, playerId: string) => {
  await connectToDatabase();
  const existing = await GameMatch.findOne({ inviteId }).lean();
  if (!existing) return { error: "Match not found.", match: null as PublicMatch | null, status: 404 };
  const stored = toStoredMatch(existing);
  if (stored.whitePlayerId === playerId || stored.blackPlayerId === playerId) {
    return { error: null, match: publicMatch(stored, playerId), status: 200 };
  }
  const claimed = await GameMatch.findOneAndUpdate(
    { inviteId, blackPlayerId: null },
    { $set: { blackPlayerId: playerId }, $inc: { version: 1 } },
    { new: true }
  ).lean();
  if (!claimed) return { error: "This game already has two players.", match: null as PublicMatch | null, status: 409 };
  return { error: null, match: publicMatch(toStoredMatch(claimed), playerId), status: 200 };
};

export const submitServerMove = async (
  inviteId: string,
  playerId: string,
  move: Omit<MoveAttempt, "side">
) => {
  await connectToDatabase();
  const match = await GameMatch.findOne({ inviteId }).lean();
  if (!match) return { error: "Match not found.", match: null as PublicMatch | null, status: 404 };
  const stored = toStoredMatch(match);
  const side: Side | null = stored.whitePlayerId === playerId
    ? "white"
    : stored.blackPlayerId === playerId
      ? "black"
      : null;
  if (!side) return { error: "You are not a player in this match.", match: null as PublicMatch | null, status: 403 };
  if (!stored.blackPlayerId) return { error: "Waiting for an opponent.", match: publicMatch(stored, playerId), status: 409 };

  const result = submitMove(stored.state, { ...move, side });
  // The version condition makes a second simultaneous request fail cleanly
  // instead of resolving two hidden-RPG outcomes from the same position.
  const updated = await GameMatch.findOneAndUpdate(
    { inviteId, version: stored.version },
    { $set: { state: result.state }, $inc: { version: 1 } },
    { new: true }
  ).lean();
  if (!updated) return { error: "The board changed. Please try your move again.", match: null as PublicMatch | null, status: 409 };
  return {
    error: result.accepted ? null : result.message,
    match: publicMatch(toStoredMatch(updated), playerId),
    status: 200,
  };
};
