import { expect, it, vi, afterEach } from "vitest";
import { createGameState, getAllLegalMoves, submitMove } from "@/lib/game";
import { publicState } from "@/lib/game/publicState";
import { validateState } from "@/lib/game/validation";
import { newerMatch } from "@/hooks/useOnlineMatch";
import { boardFixture, subjectAt, scripted } from "../fixtures";
import { remember } from "@/lib/rpg/subjects";
import { seedRng, draw } from "@/lib/rpg/rng";
afterEach(() => vi.restoreAllMocks());
it("threefold claims and fivefold automatic draws use visible positions", () => {
  let s = createGameState(1);
  const cycle = [
    [
      [7, 6],
      [5, 5],
    ],
    [
      [0, 6],
      [2, 5],
    ],
    [
      [5, 5],
      [7, 6],
    ],
    [
      [2, 5],
      [0, 6],
    ],
  ];
  const next = () => {
    for (const [from, to] of cycle)
      s = submitMove(
        s,
        {
          from: from as [number, number],
          to: to as [number, number],
          side: s.sideToMove,
        },
        { classic: true },
      ).state;
  };
  next();
  next();
  expect(publicState(s).drawClaims.threefold).toBe(true);
  const claim = submitMove(s, { type: "claim-draw", side: s.sideToMove });
  expect(claim.state.terminal?.reason).toBe("threefold");
  expect(claim.state.ply).toBe(s.ply);
  next();
  next();
  expect(s.terminal?.reason).toBe("fivefold");
});
it("50/75 move draws count completed turns, and mate takes precedence", () => {
  let s = boardFixture([
    ["K", [7, 7]],
    ["k", [0, 7]],
    ["R", [7, 0]],
    ["r", [0, 0]],
  ]);
  s.rights.halfmove = 99;
  s = submitMove(
    s,
    { from: [7, 0], to: [6, 0], side: "white" },
    { classic: true },
  ).state;
  expect(publicState(s).drawClaims.fiftyMove).toBe(true);
  expect(
    submitMove(s, { type: "claim-draw", side: "black" }).state.terminal?.reason,
  ).toBe("fifty-move");
  s.rights.halfmove = 149;
  s = submitMove(
    s,
    { from: [0, 0], to: [1, 0], side: "black" },
    { classic: true },
  ).state;
  expect(s.terminal?.reason).toBe("seventy-five-move");
  const mate = boardFixture([
    ["K", [2, 5]],
    ["Q", [2, 6]],
    ["k", [0, 7]],
  ]);
  mate.rights.halfmove = 149;
  const r = submitMove(
    mate,
    { from: [2, 6], to: [1, 6], side: "white" },
    { classic: true },
  );
  expect(r.state.terminal?.reason).toBe("checkmate");
});
it("stalemate and insufficient material stop before the political scheduler", () => {
  const s = boardFixture(
    [
      ["K", [2, 5]],
      ["Q", [3, 6]],
      ["k", [0, 7]],
    ],
    48,
  );
  const r = submitMove(
    s,
    { from: [3, 6], to: [2, 6], side: "white" },
    { draw: () => 0.9 },
  );
  expect(r.state.terminal?.reason).toBe("stalemate");
  const t = boardFixture(
    [
      ["K", [7, 7]],
      ["k", [0, 7]],
      ["B", [5, 5]],
      ["r", [4, 4]],
    ],
    48,
  );
  const end = submitMove(
    t,
    { from: [5, 5], to: [4, 4], side: "white" },
    { draw: () => 0.9 },
  );
  expect(end.state.terminal?.reason).toBe("insufficient-material");
  expect(end.state.simulation!.plots).toHaveLength(0);
});
it("castling and en passant move identities atomically", () => {
  const s = boardFixture([
    ["K", [7, 4]],
    ["R", [7, 7]],
    ["k", [0, 4]],
    ["r", [0, 0]],
  ]);
  s.rights.castling.white.king = true;
  const king = s.pieceIds[7][4],
    rook = s.pieceIds[7][7];
  const r = submitMove(s, { from: [7, 4], to: [7, 6], side: "white" }).state;
  expect(r.pieceIds[7][6]).toBe(king);
  expect(r.pieceIds[7][5]).toBe(rook);
  expect(r.ply).toBe(s.ply + 1);
  validateState(r);
  const e = boardFixture([
    ["K", [7, 4]],
    ["k", [0, 4]],
    ["P", [3, 4]],
    ["p", [3, 3]],
  ]);
  e.rights.enPassant = [2, 3];
  const victim = subjectAt(e, [3, 3]);
  const capture = submitMove(
    e,
    { from: [3, 4], to: [2, 3], side: "white" },
    { draw: () => 0.9 },
  ).state;
  expect(capture.board[3][3]).toBeNull();
  expect(capture.pieceIds[3][3]).toBeNull();
  expect(capture.simulation!.subjects[victim.id].status).toBe("captured");
  validateState(capture);
});
it("implicit queen promotion is the same repeated intention, a different promotion is restraint", () => {
  const s = boardFixture([
    ["K", [7, 7]],
    ["k", [0, 7]],
    ["P", [1, 0]],
    ["r", [4, 4]],
  ]);
  const sub = subjectAt(s, [1, 0]);
  sub.loyalty = 0;
  sub.resentment = 100;
  sub.fear = 100;
  const refusal = submitMove(
    s,
    { from: [1, 0], to: [0, 0], side: "white" },
    { draw: () => 0 },
  );
  expect(refusal.resolution).toBe("refused");
  const repeated = submitMove(
    refusal.state,
    { from: [1, 0], to: [0, 0], side: "white", promotion: "q" },
    {
      draw: () => {
        throw Error("repeat reroll");
      },
    },
  ).state;
  expect(repeated.simulation!.kingdoms.white.tyranny).toBe(15);
  const alternative = submitMove(refusal.state, {
    from: [1, 0],
    to: [0, 0],
    side: "white",
    promotion: "n",
  }).state;
  expect(alternative.simulation!.kingdoms.white.tyranny).toBe(8);
});
it("heroism cannot exceed its side budget or expose its king", () => {
  const s = boardFixture([
    ["K", [7, 4]],
    ["k", [0, 7]],
    ["R", [6, 4]],
    ["r", [0, 4]],
  ]);
  const sub = subjectAt(s, [6, 4]);
  sub.morale = 90;
  const r = submitMove(
    s,
    { from: [6, 4], to: [5, 4], side: "white" },
    { draw: scripted(0.9, 0.99, 0.1) },
  );
  expect(r.state.simulation!.kingdoms.white.extensionsUsed).toBe(1);
  s.simulation!.kingdoms.white.extensionsUsed = 1;
  const capped = submitMove(
    s,
    { from: [6, 4], to: [5, 4], side: "white" },
    { draw: scripted(0.9, 0.99, 0.1) },
  );
  expect(capped.state.lastMove?.[1]).toEqual([5, 4]);
});
it("older polls and responses to departed matches are ignored", () => {
  const state = publicState(createGameState(1)),
    m = {
      id: "a",
      state,
      version: 3,
      playerSide: "white" as const,
      waitingForOpponent: false,
    };
  expect(newerMatch(m, { ...m, version: 2 }, "a")).toBe(false);
  expect(newerMatch(m, { ...m, version: 4 }, null)).toBe(false);
  expect(newerMatch(m, { ...m, id: "b", version: 10 }, "a")).toBe(false);
  expect(newerMatch(m, { ...m, version: 4 }, "a")).toBe(true);
});
it("seeded randomized legal sequences preserve invariants and cannot deadlock", () => {
  for (let seed = 0; seed < 10; seed++) {
    let s = createGameState(seed),
      rng = seedRng(seed);
    for (let ply = 0; ply < 80 && s.status === "active"; ply++) {
      const moves = getAllLegalMoves(s.board, s.sideToMove, s.rights),
        move = moves[Math.floor(draw(rng) * moves.length)];
      let r = submitMove(s, move);
      if (!r.turnConsumed) r = submitMove(r.state, move);
      expect(r.turnConsumed).toBe(true);
      s = r.state;
      validateState(s);
    }
  }
});
it("coercion memory expires on own turns only and never on refused/invalid actions", () => {
  const s = createGameState(1);
  s.ply = 16;
  s.simulation!.turnContext.ply = 16;
  const sub = subjectAt(s, [6, 4]);
  sub.loyalty = 0;
  sub.resentment = 100;
  remember(s, sub, "coerced", sub.id, 1, 1);
  const m = { from: [6, 4], to: [4, 4], side: "white" } as const;
  const r = submitMove(
    s,
    { ...m, from: [...m.from], to: [...m.to] },
    { draw: () => 0 },
  );
  expect(r.state.simulation!.subjects[sub.id].memories).toEqual(sub.memories);
  const changed = submitMove(r.state, {
    from: [6, 3],
    to: [4, 3],
    side: "white",
  }).state;
  expect(changed.simulation!.subjects[sub.id].memories).toHaveLength(0);
});
