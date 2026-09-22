import { expect, it } from "vitest";
import { createGameState, submitMove } from "@/lib/game";
import { searchMoves } from "@/lib/ai/search";
import { ownPolitics } from "@/lib/ai/politicalEvaluation";
import { politicalScore } from "@/lib/ai/politicalEvaluation";
import { applyMove } from "@/lib/chess";
import { getAllLegalMoves } from "@/lib/game";
import { lateCourt, courtTurn } from "../scenarios";
import { boardFixture } from "../fixtures";
it("search finds mate at depth-one horizon", () => {
  const s = boardFixture([
    ["K", [2, 5]],
    ["Q", [2, 6]],
    ["k", [0, 7]],
  ]);
  const r = searchMoves({
    board: s.board,
    rights: s.rights,
    side: "white",
    depth: 1,
    budgetMs: 1000,
    own: null,
  });
  const result = submitMove(s, r.moves[0], { classic: true });
  expect(result.state.terminal?.reason).toBe("checkmate");
});

it("nonterminal political preference stays capped and imminent court defense enters the shortlist", () => {
  let s = lateCourt();
  for (let n = 0; n < 4; n++) {
    s = courtTurn(s, "white").state;
    s = courtTurn(s, "black").state;
  }
  const id = s.pieceIds[5][3];
  s.pieceIds[5][3] = null;
  s.board[5][3] = null;
  s.pieceIds[5][2] = id;
  s.board[5][2] = "B";
  const own = ownPolitics(s, "white")!,
    result = searchMoves({
      board: s.board,
      rights: s.rights,
      side: "white",
      depth: 1,
      budgetMs: 1000,
      own,
    });
  const choice = result.moves[0],
    score = politicalScore(
      s.board,
      applyMove(s.board, choice.from, choice.to, choice.promotion, s.rights),
      choice,
      own,
    );
  expect(score).toBeGreaterThan(1000);
  own.plot!.stage = "preparing";
  for (const move of getAllLegalMoves(s.board, "white", s.rights)) {
    const score = politicalScore(
      s.board,
      applyMove(s.board, move.from, move.to, move.promotion, s.rights),
      move,
      own,
    );
    expect(Math.abs(score)).toBeLessThanOrEqual(100);
  }
});
it("budget expiry returns a legal fallback and own projection has no enemy or RNG", () => {
  const s = createGameState(1),
    own = ownPolitics(s, "white")!;
  expect(Object.values(own.subjects).every((x) => x.side === "white")).toBe(
    true,
  );
  expect(JSON.stringify(own)).not.toContain("rngState");
  const before = structuredClone(s);
  const r = searchMoves({
    board: s.board,
    rights: s.rights,
    side: "white",
    depth: 4,
    budgetMs: 0,
    maxNodes: 32,
    own,
  });
  expect(r.moves.length).toBe(20);
  expect(submitMove(s, r.moves[0]).requestAccepted).toBe(true);
  expect(s).toEqual(before);
});
it("a winning computer avoids claimable and automatic repetitions", async () => {
  const { searchMoves } = await import("@/lib/ai/search");
  const { nextRights, positionKey } = await import("@/lib/chessRules");
  const { freshRights } = await import("@/lib/chess");
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  board[0][0] = "k";
  board[3][3] = "q";
  board[7][7] = "K";
  const rights = { ...freshRights(false), halfmove: 10 };
  const input = {
    board,
    rights,
    side: "black" as const,
    depth: 1,
    budgetMs: 1e6,
    own: null,
  };
  const top = searchMoves(input).moves[0];
  const after = nextRights(board, rights, top);
  const { applyMove } = await import("@/lib/chess");
  const key = positionKey(applyMove(board, top.from, top.to), "white", after);
  for (const seen of [2, 4])
    expect(
      searchMoves({ ...input, positions: { [key]: seen } }).moves[0],
    ).not.toEqual(top);
  expect(searchMoves({ ...input, positions: { [key]: 1 } }).moves[0]).toEqual(
    top,
  );
});
