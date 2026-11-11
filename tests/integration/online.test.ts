import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import {
  createServerMatch,
  isCurrentVersion,
  tooManyOpenInvites,
  getServerMatch,
  joinServerMatch,
  submitServerMove,
} from "@/lib/serverMatches";
import { GameMatch } from "@/models/GameMatch";
import { createGameState, movesFor, submitMove } from "@/lib/game";
import { publicState } from "@/lib/game/publicState";
import { loadState, parseAction, validateState } from "@/lib/game/validation";
import { battleTarget } from "@/lib/battle/moves";
import { KINGS, boardFixture, unitAt } from "../fixtures";
let db: MongoMemoryServer;
beforeAll(async () => {
  db = await MongoMemoryServer.create();
  process.env.MONGODB_URI = db.getUri("battle_chess_test");
}, 120000);
afterAll(async () => {
  await mongoose.disconnect();
  await db?.stop();
});
// Keys that must never appear anywhere in what a client receives.
const hidden = [
  "pieceIds",
  "rngState",
  "gameplay",
  "configVersion",
  "revision",
  "eventSeq",
  "positions",
  "receipts",
  "whitePlayerId",
  "blackPlayerId",
];
function assertPrivate(v: unknown) {
  if (!v || typeof v !== "object") return;
  for (const [k, x] of Object.entries(v)) {
    expect(hidden).not.toContain(k);
    assertPrivate(x);
  }
}
async function match() {
  const white = randomUUID(),
    black = randomUUID(),
    m = await createServerMatch(white);
  const joined = await joinServerMatch(m.id, black);
  return { white, black, m: joined.match! };
}
const storedState = async (id: string) =>
  (await GameMatch.findOne({ inviteId: id }).lean())!.state;

describe("actual MongoDB coordination", () => {
  it("a battle is rolled once on the server and both players see the same result", async () => {
    const { m, white, black } = await match();
    const s = boardFixture([...KINGS, ["N", [4, 4]], ["r", [2, 3]]]);
    await GameMatch.updateOne({ inviteId: m.id }, { $set: { state: s } });
    const action = {
      actionId: randomUUID(),
      expectedVersion: m.version,
      from: [4, 4],
      to: [2, 3],
    };
    const reply = await submitServerMove(m.id, white, action);
    expect(reply.status).toBe(200);
    const battle = reply.match!.state.battle!;
    expect(battle).toMatchObject({ from: [4, 4], target: [2, 3] });
    expect(["defeated", "wounded", "repelled"]).toContain(battle.outcome);
    // The stored game is exactly what the reducer produces from the stored
    // dice state: nothing about the roll came from the request.
    const stored = await storedState(m.id);
    expect(stored).toEqual(
      submitMove(s, { from: [4, 4], to: [2, 3], side: "white" }).state,
    );
    const seenByBlack = await getServerMatch(m.id, black);
    expect(seenByBlack!.state.battle).toEqual(battle);
    expect(seenByBlack!.state.units).toEqual(reply.match!.state.units);
    expect(seenByBlack!.state.sideToMove).toBe("black");
    // A retry of the same request rolls nothing again.
    const retry = await submitServerMove(m.id, white, action);
    expect(retry.duplicate).toBe(true);
    expect(await storedState(m.id)).toEqual(stored);
    for (const v of [reply, retry, seenByBlack]) assertPrivate(v);
  });
  it("defeating the king online finishes the match for both players", async () => {
    const { m, white, black } = await match();
    // Search for a stored dice state on which the queen's attack lands.
    let s = boardFixture([...KINGS, ["Q", [1, 4]]]);
    for (let seed = 1; ; seed++) {
      s = boardFixture([...KINGS, ["Q", [1, 4]]], "white", seed);
      unitAt(s, [0, 4]).hp = 1;
      if (
        submitMove(s, { from: [1, 4], to: [0, 4], side: "white" }).state
          .terminal
      )
        break;
    }
    await GameMatch.updateOne({ inviteId: m.id }, { $set: { state: s } });
    const won = await submitServerMove(m.id, white, {
      actionId: randomUUID(),
      expectedVersion: m.version,
      from: [1, 4],
      to: [0, 4],
    });
    expect(won.match!.state.terminal).toMatchObject({
      reason: "king-defeated",
      winner: "white",
    });
    expect((await getServerMatch(m.id, black))!.state.result).toBe(
      "The black king has fallen. White wins.",
    );
    const after = await submitServerMove(m.id, black, {
      actionId: randomUUID(),
      expectedVersion: won.match!.version,
      from: [7, 4],
      to: [7, 3],
    });
    expect(after.status).toBe(422);
  });
  it("simultaneous identical intents converge to one receipt", async () => {
    const { m, white } = await match();
    const a = {
      actionId: randomUUID(),
      expectedVersion: m.version,
      from: [6, 4],
      to: [4, 4],
    };
    const results = await Promise.all([
      submitServerMove(m.id, white, a),
      submitServerMove(m.id, white, a),
    ]);
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(results.filter((r) => r.duplicate)).toHaveLength(1);
    const stored = await GameMatch.findOne({ inviteId: m.id }).lean();
    expect(stored!.receipts).toHaveLength(1);
    // Receipts keep only what duplicate detection reads.
    expect(Object.keys(stored!.receipts[0] as object).sort()).toEqual([
      "actionId",
      "hash",
      "playerId",
      "version",
    ]);
    expect(stored!.version).toBe(m.version + 1);
  });
  it("receipts are bounded at 64 and an aged retry remains stale", async () => {
    const { m, white, black } = await match();
    let version = m.version;
    let first: ReturnType<typeof parseAction> = null;
    for (let i = 0; i < 66; i++) {
      const state = loadState(await storedState(m.id));
      // Quiet moves only, so no battle can end the game early.
      const move = movesFor(state).find(
        (x) => !battleTarget(state.board, x.from, x.to) && !x.promotion,
      )!;
      expect(move).toBeDefined();
      const action = {
        actionId: randomUUID(),
        expectedVersion: version,
        from: move.from,
        to: move.to,
      };
      if (i === 0) first = action;
      const result = await submitServerMove(
        m.id,
        state.sideToMove === "white" ? white : black,
        action,
      );
      expect(result.status).toBe(200);
      version = result.match!.version;
    }
    const stored = await GameMatch.findOne({ inviteId: m.id }).lean();
    expect(stored!.receipts).toHaveLength(64);
    expect((await submitServerMove(m.id, white, first)).status).toBe(409);
    expect((await GameMatch.findOne({ inviteId: m.id }).lean())!.version).toBe(
      version,
    );
  }, 60000);
  it("create/read/join preserve private fields and first claim locking", async () => {
    const white = randomUUID(),
      m = await createServerMatch(white);
    assertPrivate(m);
    expect((await getServerMatch(m.id, randomUUID()))?.playerSide).toBeNull();
    const responses = await Promise.all([
      joinServerMatch(m.id, randomUUID()),
      joinServerMatch(m.id, randomUUID()),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    responses.forEach(assertPrivate);
  });
  it("same revision concurrent actions produce one mutation and preserve the losing dice", async () => {
    const { white, m } = await match();
    const a = {
        actionId: randomUUID(),
        expectedVersion: m.version,
        from: [6, 4],
        to: [4, 4],
      },
      b = { ...a, actionId: randomUUID(), from: [6, 3], to: [4, 3] };
    const before = await storedState(m.id);
    const results = await Promise.all([
      submitServerMove(m.id, white, a),
      submitServerMove(m.id, white, b),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const after = await GameMatch.findOne({ inviteId: m.id }).lean();
    expect(after!.version).toBe(m.version + 1);
    const winner = results[0].status === 200 ? a : b;
    expect(after!.state).toEqual(
      submitMove(loadState(before), {
        from: winner.from as [number, number],
        to: winner.to as [number, number],
        side: "white",
      }).state,
    );
    results.forEach(assertPrivate);
  });
  it("unauthorized, stale and invalid requests do not mutate a match", async () => {
    const { m, white, black } = await match();
    const action = {
      actionId: randomUUID(),
      expectedVersion: m.version,
      from: [6, 4],
      to: [4, 4],
    };
    const before = await storedState(m.id);
    expect((await submitServerMove(m.id, randomUUID(), action)).status).toBe(
      403,
    );
    expect((await submitServerMove(m.id, black, action)).status).toBe(422);
    expect(
      (await submitServerMove(m.id, white, { ...action, expectedVersion: 1 }))
        .status,
    ).toBe(409);
    expect(
      (await submitServerMove(m.id, white, { ...action, from: [99, 0] }))
        .status,
    ).toBe(400);
    expect(
      (await submitServerMove(m.id, white, { ...action, to: [3, 4] })).status,
    ).toBe(422);
    expect(await storedState(m.id)).toEqual(before);
  });
  it("matches stored under older rules or unknown schemas are refused and left untouched", async () => {
    const { m, white } = await match();
    const valid = await storedState(m.id);
    for (const patch of [
      { "state.schemaVersion": 6, "state.rulesetVersion": "hidden-kingdom-v6" },
      { "state.schemaVersion": 999 },
      { "state.configVersion": "2026-09-23.1" },
    ]) {
      await GameMatch.updateOne({ inviteId: m.id }, { $set: patch });
      const broken = await storedState(m.id);
      await expect(getServerMatch(m.id, white)).rejects.toThrow("incompatible");
      await expect(
        submitServerMove(m.id, white, {
          actionId: randomUUID(),
          expectedVersion: m.version,
          from: [6, 4],
          to: [4, 4],
        }),
      ).rejects.toThrow("incompatible");
      expect(await storedState(m.id)).toEqual(broken);
      await GameMatch.updateOne({ inviteId: m.id }, { $set: { state: valid } });
    }
    expect((await getServerMatch(m.id, white))?.state.board).toEqual(
      valid.board,
    );
  });
});
describe("runtime contracts and nested privacy", () => {
  it("rejects malformed coordinate and authority fields", () => {
    const good = {
      actionId: randomUUID(),
      expectedVersion: 1,
      from: [6, 4],
      to: [4, 4],
    };
    for (const from of [
      [-1, 0],
      [8, 0],
      [1.5, 0],
      [null, 0],
      [0],
      [0, 0, 0],
      "a1",
      [NaN, 0],
      [Infinity, 0],
    ])
      expect(parseAction({ ...good, from })).toBeNull();
    for (const extra of [
      { side: "black" },
      { rules: {} },
      { draw: 0.5 },
      { type: "move" },
      { promotion: "king" },
      { expectedVersion: 1.1 },
      { actionId: "x" },
    ])
      expect(parseAction({ ...good, ...extra })).toBeNull();
    expect(parseAction(good)).not.toBeNull();
  });
  it("public projection recursively drops added private fields", () => {
    const s = createGameState(1);
    const dirty = s as unknown as Record<string, unknown>;
    dirty.futureSecret = "secret";
    s.moves.push({
      number: 1,
      text: "move",
      message: "move",
      ...{ rngState: "secret" },
    });
    s.events.push({
      seq: 1,
      ply: 0,
      message: "public",
      square: null,
      ...{ pieceIds: "secret" },
    });
    Object.assign(Object.values(s.battle.units)[0], { owner: "secret" });
    const dto = publicState(s);
    assertPrivate(dto);
    expect(JSON.stringify(dto)).not.toContain("secret");
  });
  it("runtime saved-state validation rejects broken identity, stats and future config", () => {
    const valid = createGameState(2);
    expect(() => validateState(valid)).not.toThrow();
    for (const mutate of [
      (s: typeof valid) => {
        s.pieceIds[6][0] = s.pieceIds[6][1];
      },
      (s: typeof valid) => {
        unitAt(s, [6, 0]).hp = 4;
      },
      (s: typeof valid) => {
        s.configVersion = "future";
      },
      (s: typeof valid) => {
        s.board[0][4] = null;
      },
    ]) {
      const s = structuredClone(valid);
      mutate(s);
      expect(() => validateState(s)).toThrow();
    }
  });
});
describe("match lifecycle", () => {
  it("polls detect the current version cheaply and every write refreshes expiry", async () => {
    const white = randomUUID(),
      created = await createServerMatch(white);
    const expiryOf = async () =>
      (await GameMatch.findOne({ inviteId: created.id }).lean())!.expiresAt!;
    const first = await expiryOf();
    expect(first.getTime()).toBeGreaterThan(Date.now());
    expect(await isCurrentVersion(created.id, created.version)).toBe(true);
    const joined = (await joinServerMatch(created.id, randomUUID())).match!;
    expect(await isCurrentVersion(created.id, created.version)).toBe(false);
    expect(await isCurrentVersion(created.id, joined.version)).toBe(true);
    expect(await isCurrentVersion("not-a-uuid", 1)).toBe(false);
    expect((await expiryOf()).getTime()).toBeGreaterThanOrEqual(
      first.getTime(),
    );
    await GameMatch.init();
    const ttl = (await GameMatch.collection.indexes()).find(
      (i) => i.key.expiresAt === 1,
    );
    expect(ttl?.expireAfterSeconds).toBe(0);
  });
  it("caps unjoined invites per guest", async () => {
    const white = randomUUID();
    for (let i = 0; i < 19; i++) await createServerMatch(white);
    expect(await tooManyOpenInvites(white)).toBe(false);
    await createServerMatch(white);
    expect(await tooManyOpenInvites(white)).toBe(true);
    expect(await tooManyOpenInvites(randomUUID())).toBe(false);
  });
});
describe("health", () => {
  it("reports database reachability", async () => {
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});
