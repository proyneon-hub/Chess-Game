import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import {
  createServerMatch,
  getServerMatch,
  joinServerMatch,
  submitServerMove,
} from "@/lib/serverMatches";
import { GameMatch } from "@/models/GameMatch";
import { createGameState, getAllLegalMoves, submitMove } from "@/lib/game";
import { publicState } from "@/lib/game/publicState";
import { parseAction, validateState } from "@/lib/game/validation";
import { migrateState } from "@/lib/game/migrate";
import { initializePieceIds, initializeRpgState } from "@/lib/rpgChess";
import { subjectAt } from "../fixtures";
let db: MongoMemoryServer;
beforeAll(async () => {
  db = await MongoMemoryServer.create();
  process.env.MONGODB_URI = db.getUri("hidden_kingdom_test");
}, 120000);
afterAll(async () => {
  await mongoose.disconnect();
  await db?.stop();
});
const hidden = [
  "pieceIds",
  "simulation",
  "rpgState",
  "rngState",
  "legacyRng",
  "kingdoms",
  "subjects",
  "personality",
  "loyalty",
  "resentment",
  "plots",
  "ringleader",
  "accomplice",
  "privateEvents",
  "configVersion",
  "receipts",
  "whitePlayerId",
  "blackPlayerId",
];
export function assertPrivate(v: unknown) {
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
describe("actual MongoDB coordination", () => {
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
    expect(stored!.version).toBe(m.version + 1);
  });
  it("receipts are bounded at 64 and an aged retry remains stale", async () => {
    const { m, white, black } = await match();
    let version = m.version;
    let first: ReturnType<typeof parseAction> = null;
    for (let i = 0; i < 66; i++) {
      const stored = await GameMatch.findOne({ inviteId: m.id }).lean(),
        state = migrateState(stored!.state);
      const move = getAllLegalMoves(
        state.board,
        state.sideToMove,
        state.rights,
      ).find((move) => submitMove(state, move).state.status !== "finished")!;
      expect(move).toBeDefined();
      const action = {
        actionId: randomUUID(),
        expectedVersion: version,
        from: move.from,
        to: move.to,
        ...(move.promotion ? { promotion: move.promotion } : {}),
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
  });
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
  it("same revision concurrent actions produce one mutation and preserve losing RNG", async () => {
    const { white, m } = await match();
    const a = {
        actionId: randomUUID(),
        expectedVersion: m.version,
        from: [6, 4],
        to: [4, 4],
      },
      b = { ...a, actionId: randomUUID(), from: [6, 3], to: [4, 3] };
    const before = await GameMatch.findOne({ inviteId: m.id }).lean();
    const results = await Promise.all([
      submitServerMove(m.id, white, a),
      submitServerMove(m.id, white, b),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const after = await GameMatch.findOne({ inviteId: m.id }).lean();
    expect(after!.version).toBe(m.version + 1);
    const winner = results[0].status === 200 ? a : b;
    expect(after!.state).toEqual(
      submitMove(migrateState(before!.state), {
        from: winner.from as [number, number],
        to: winner.to as [number, number],
        side: "white",
      }).state,
    );
    results.forEach(assertPrivate);
  });
  it("online refusal retry acknowledges one grievance and no second roll", async () => {
    const { white, m } = await match();
    const state = createGameState(1);
    state.ply = 16;
    state.simulation!.turnContext.ply = 16;
    const sub = subjectAt(state, [6, 4]);
    sub.fear = 100;
    sub.resentment = 100;
    sub.loyalty = 0;
    // Search a persisted seed that gives the scripted stress refusal; production
    // receives only the ordinary request, never a force-roll flag.
    const action = {
      actionId: randomUUID(),
      expectedVersion: m.version,
      from: [6, 4],
      to: [4, 4],
    };
    for (let seed = 0; seed < 1000; seed++) {
      state.simulation!.rngState.gameplay = seed;
      if (
        submitMove(state, { from: [6, 4], to: [4, 4], side: "white" })
          .resolution === "refused"
      )
        break;
    }
    await GameMatch.updateOne({ inviteId: m.id }, { $set: { state } });
    const first = await submitServerMove(m.id, white, action);
    expect(first.match?.state.lastAction?.resolution).toBe("refused");
    const stored = await GameMatch.findOne({ inviteId: m.id }).lean();
    const retried = await submitServerMove(m.id, white, action);
    expect(retried.duplicate).toBe(true);
    expect((await GameMatch.findOne({ inviteId: m.id }).lean())!.state).toEqual(
      stored!.state,
    );
    expect(
      (await submitServerMove(m.id, white, { ...action, to: [5, 4] })).status,
    ).toBe(409);
    assertPrivate(first);
    assertPrivate(retried);
    const repeat = await submitServerMove(m.id, white, {
      ...action,
      actionId: randomUUID(),
      expectedVersion: first.match!.version,
    });
    expect(repeat.match?.state.lastAction?.turnConsumed).toBe(true);
    const done = await GameMatch.findOne({ inviteId: m.id }).lean();
    expect(done!.state.simulation.kingdoms.white.tyranny).toBe(15);
  });
  it("unauthorized, stale and invalid requests do not mutate a match", async () => {
    const { m, white, black } = await match();
    const action = {
      actionId: randomUUID(),
      expectedVersion: m.version,
      from: [6, 4],
      to: [4, 4],
    };
    const before = await GameMatch.findOne({ inviteId: m.id }).lean();
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
    expect((await GameMatch.findOne({ inviteId: m.id }).lean())!.state).toEqual(
      before!.state,
    );
  });
  it("legacy matches remain readable/playable and future schemas remain untouched", async () => {
    const s = createGameState(1),
      pieceIds = initializePieceIds(s.board);
    const baseline = {
      board: s.board,
      pieceIds,
      rpgState: initializeRpgState(s.board, pieceIds),
      sideToMove: "white",
      status: "active",
      result: null,
      lastMove: null,
      specialSquare: null,
      moves: [],
    };
    const once = migrateState(baseline);
    expect(migrateState(once)).toEqual(once);
    expect(once.simulation).toBeNull();
    expect(
      submitMove(
        once,
        { from: [6, 4], to: [4, 4], side: "white" },
        { draw: () => 0.5 },
      ).turnConsumed,
    ).toBe(true);
    const { m, white } = await match();
    await GameMatch.updateOne(
      { inviteId: m.id },
      { $set: { state: baseline } },
    );
    expect((await getServerMatch(m.id, white))?.state.board).toEqual(s.board);
    await GameMatch.updateOne(
      { inviteId: m.id },
      { $set: { "state.schemaVersion": 999 } },
    );
    await expect(getServerMatch(m.id, white)).rejects.toThrow("incompatible");
    expect(
      (await GameMatch.findOne({ inviteId: m.id }).lean())!.state.schemaVersion,
    ).toBe(999);
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
      { simulation: {} },
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
      special: false,
      ...{ rngState: "secret" },
    });
    s.events.push({
      seq: 1,
      ply: 0,
      message: "public",
      square: null,
      intended: null,
      actual: null,
      special: false,
      ...{ loyalty: 2 },
    });
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
        subjectAt(s, [6, 0]).loyalty = 101;
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
