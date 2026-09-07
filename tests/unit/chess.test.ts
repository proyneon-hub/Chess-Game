import { describe, expect, it } from "vitest";
import {
  type Board,
  INITIAL_BOARD,
  applyMove,
  freshRights,
  getAttacks,
  getLegalMoves,
  isInCheck,
} from "@/lib/chess";
import {
  allMoves,
  nextRights,
  perft,
  positionKey,
  insufficientMaterial,
} from "@/lib/chessRules";
import { createGameState, submitMove } from "@/lib/game";
export const emptyBoard = (): Board =>
  Array.from({ length: 8 }, () => Array(8).fill(null));
describe("ordinary chess foundation", () => {
  it("start position perft is 20 / 400 / 8902", () => {
    for (const [depth, n] of [
      [1, 20],
      [2, 400],
      [3, 8902],
    ])
      expect(perft(INITIAL_BOARD, "white", freshRights(), depth)).toBe(n);
  });
  it("pawn attacks empty diagonals and defends friends, never forward", () => {
    const b = emptyBoard();
    b[4][4] = "P";
    b[3][3] = "N";
    expect(getAttacks(b, 4, 4)).toEqual([
      [3, 3],
      [3, 5],
    ]);
  });
  it("pins and adjacent kings cannot make illegal moves", () => {
    const b = emptyBoard();
    b[7][4] = "K";
    b[6][4] = "R";
    b[0][4] = "r";
    b[0][0] = "k";
    expect(getLegalMoves(b, 6, 4, true)).not.toContainEqual([6, 5]);
    b[5][4] = "k";
    b[0][0] = null;
    expect(getLegalMoves(b, 7, 4, true)).not.toContainEqual([6, 4]);
  });
  it("castles only with rights, clear path and safe transit", () => {
    const b = emptyBoard();
    b[7][4] = "K";
    b[7][7] = "R";
    b[0][4] = "k";
    const r = freshRights();
    expect(getLegalMoves(b, 7, 4, true, r)).toContainEqual([7, 6]);
    b[0][5] = "r";
    expect(getLegalMoves(b, 7, 4, true, r)).not.toContainEqual([7, 6]);
    b[0][5] = null;
    b[7][5] = "B";
    expect(getLegalMoves(b, 7, 4, true, r)).not.toContainEqual([7, 6]);
    b[7][5] = null;
    expect(getLegalMoves(b, 7, 4, true, freshRights(false))).not.toContainEqual(
      [7, 6],
    );
    const after = applyMove(b, [7, 4], [7, 6], "q", r);
    expect(after[7].slice(4)).toEqual([null, "R", "K", null]);
  });
  it("rook movement/capture and king movement remove rights permanently", () => {
    const r = freshRights();
    expect(
      nextRights(INITIAL_BOARD, r, { from: [7, 7], to: [5, 7], side: "white" })
        .castling.white.king,
    ).toBe(false);
    expect(
      nextRights(INITIAL_BOARD, r, { from: [0, 0], to: [7, 0], side: "black" })
        .castling.white.queen,
    ).toBe(false);
    expect(
      nextRights(INITIAL_BOARD, r, { from: [7, 4], to: [6, 4], side: "white" })
        .castling.white,
    ).toEqual({ king: false, queen: false });
  });
  it("en passant removes actual pawn, expires and cannot expose king", () => {
    const b = emptyBoard();
    b[3][4] = "P";
    b[3][3] = "p";
    b[7][4] = "K";
    b[0][0] = "k";
    const r = freshRights(false);
    r.enPassant = [2, 3];
    expect(getLegalMoves(b, 3, 4, true, r)).toContainEqual([2, 3]);
    expect(applyMove(b, [3, 4], [2, 3], "q", r)[3][3]).toBeNull();
    expect(
      nextRights(b, r, { from: [7, 4], to: [7, 5], side: "white" }).enPassant,
    ).toBeNull();
    b[0][4] = "r";
    expect(getLegalMoves(b, 3, 4, true, r)).not.toContainEqual([2, 3]);
  });
  it("generates all four promotions", () => {
    const b = emptyBoard();
    b[1][0] = "P";
    b[7][4] = "K";
    b[0][4] = "k";
    expect(
      allMoves(b, "white")
        .filter((m) => m.from[0] === 1)
        .map((m) => m.promotion),
    ).toEqual(["q", "r", "b", "n"]);
    for (const p of ["q", "r", "b", "n"] as const)
      expect(applyMove(b, [1, 0], [0, 0], p)[0][0]).toBe(p.toUpperCase());
  });
  it("meaningless en passant is omitted from repetition keys", () => {
    const r = freshRights();
    r.enPassant = [2, 3];
    expect(positionKey(INITIAL_BOARD, "white", r)).toBe(
      positionKey(INITIAL_BOARD, "white", freshRights()),
    );
  });
  it("recognizes dead material but permits bishop+knight", () => {
    const b = emptyBoard();
    b[7][4] = "K";
    b[0][4] = "k";
    expect(insufficientMaterial(b)).toBe(true);
    b[6][4] = "B";
    expect(insufficientMaterial(b)).toBe(true);
    b[5][4] = "N";
    expect(insufficientMaterial(b)).toBe(false);
  });
  it("fool's mate is terminal and immutable", () => {
    let s = createGameState(1);
    for (const [from, to] of [
      [
        [6, 5],
        [5, 5],
      ],
      [
        [1, 4],
        [3, 4],
      ],
      [
        [6, 6],
        [4, 6],
      ],
      [
        [0, 3],
        [4, 7],
      ],
    ] as const)
      s = submitMove(s, {
        from: [...from],
        to: [...to],
        side: s.sideToMove,
      }).state;
    expect(s.terminal?.reason).toBe("checkmate");
    expect(isInCheck(s.board, true)).toBe(true);
    expect(
      submitMove(s, { from: [6, 0], to: [5, 0], side: "white" }).state,
    ).toBe(s);
  });
  it("same seed and actions reproduce all state, invalid action consumes nothing", () => {
    const a = createGameState(123),
      b = createGameState(123);
    const m = { from: [6, 4], to: [4, 4], side: "white" } as const;
    expect(submitMove(a, { ...m, from: [...m.from], to: [...m.to] })).toEqual(
      submitMove(b, { ...m, from: [...m.from], to: [...m.to] }),
    );
    expect(
      submitMove(a, { from: [-1, 0], to: [3, 4], side: "white" }).state,
    ).toBe(a);
  });
});
