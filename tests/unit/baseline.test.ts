import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type Board,
  findKing,
  getLegalMoves,
  getPseudoMoves,
} from "@/lib/chess";
import {
  initializePieceIds,
  initializeRpgState,
  resolveMoveAttempt,
} from "@/lib/rpgChess";
import { createGameState, submitMove } from "@/lib/game";

afterEach(() => vi.restoreAllMocks());
const fixture = () => {
  const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
  board[7][7] = "K";
  board[2][0] = "k";
  board[4][0] = "R";
  const ids = initializePieceIds(board);
  return { board, ids, rpg: initializeRpgState(board, ids) };
};
describe("baseline regressions", () => {
  it("an exceptional rook command cannot capture a king", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const { board, ids, rpg } = fixture();
    const result = resolveMoveAttempt(
      board,
      ids,
      rpg,
      [4, 0],
      [3, 0],
      () => 0.999,
    );
    expect(result.destination).not.toEqual([2, 0]);
    expect(findKing(board, false)).toEqual([2, 0]);
  });
  it("ordinary legal moves never include king capture", () => {
    const { board } = fixture();
    expect(getLegalMoves(board, 4, 0, true)).not.toContainEqual([2, 0]);
  });
  it("opening commands execute even on the old natural-one draw", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const result = submitMove(createGameState(), {
      from: [6, 4],
      to: [4, 4],
      side: "white",
    });
    expect(result.state.sideToMove).toBe("black");
  });
  it("pseudo moves are movement, not a pawn threat map", () => {
    const { board } = fixture();
    board[6][4] = "P";
    expect(getPseudoMoves(board, 6, 4)).toContainEqual([5, 4]);
  });
});
