// Movement for Battle Chess: ordinary piece movement with no check rule. A
// king may move into attack and may itself be attacked. Depends only on
// lib/chess so the online client can highlight moves without the engine.
import {
  type Board,
  type ChessRights,
  type PromotionKind,
  type Side,
  type Square,
  getPseudoMoves,
  isWhite,
} from "@/lib/chess";
export type BattleMove = {
  from: Square;
  to: Square;
  side: Side;
  promotion?: PromotionKind;
};
export function battleMoves(
  board: Board,
  row: number,
  col: number,
  white: boolean,
  rights: ChessRights,
): Square[] {
  const p = board[row][col];
  if (!p || isWhite(p) !== white) return [];
  const moves = getPseudoMoves(board, row, col);
  const kind = p.toLowerCase();
  if (kind === "p" && rights.enPassant) {
    const [r, c] = rights.enPassant;
    if (
      r === row + (white ? -1 : 1) &&
      Math.abs(c - col) === 1 &&
      !board[r][c] &&
      board[row][c] === (white ? "p" : "P")
    )
      moves.push([r, c]);
  }
  if (kind === "k" && row === (white ? 7 : 0) && col === 4) {
    const cr = rights.castling[white ? "white" : "black"];
    for (const [enabled, rookCol, dest, path] of [
      [cr.king, 7, 6, [5, 6]],
      [cr.queen, 0, 2, [3, 2, 1]],
    ] as const)
      if (
        enabled &&
        board[row][rookCol] === (white ? "R" : "r") &&
        path.every((c) => !board[row][c])
      )
        moves.push([row, dest]);
  }
  return moves;
}
/** The square of the piece a move attacks, if any (en passant included). */
export const battleTarget = (
  board: Board,
  from: Square,
  to: Square,
): Square | null =>
  board[to[0]][to[1]]
    ? to
    : board[from[0]][from[1]]?.toLowerCase() === "p" && from[1] !== to[1]
      ? [from[0], to[1]]
      : null;
/** Every move for a side. Pawns reaching the last rank promote to a queen. */
export function allBattleMoves(
  board: Board,
  side: Side,
  rights: ChessRights,
): BattleMove[] {
  const out: BattleMove[] = [],
    white = side === "white";
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || isWhite(p) !== white) continue;
      for (const to of battleMoves(board, r, c, white, rights))
        out.push(
          p.toLowerCase() === "p" && (to[0] === 0 || to[0] === 7)
            ? { from: [r, c], to, side, promotion: "q" }
            : { from: [r, c], to, side },
        );
    }
  return out;
}
