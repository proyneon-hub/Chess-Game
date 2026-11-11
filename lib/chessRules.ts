import {
  type Board,
  type ChessRights,
  type Side,
  type Square,
  type PromotionKind,
} from "@/lib/chess";

type ChessMove = {
  from: Square;
  to: Square;
  side: Side;
  promotion?: PromotionKind;
};
/** Castling rights, the en passant square and the move clocks after a move. */
export function nextRights(
  board: Board,
  rights: ChessRights,
  move: ChessMove,
): ChessRights {
  // Cheaper than structuredClone at every search node; spreads keep any keys.
  const n: ChessRights = {
    ...rights,
    castling: {
      white: { ...rights.castling.white },
      black: { ...rights.castling.black },
    },
    enPassant: rights.enPassant ? [...rights.enPassant] : null,
  };
  const p = board[move.from[0]][move.from[1]]!;
  if (p.toLowerCase() === "k")
    n.castling[move.side] = { king: false, queen: false };
  for (const side of ["white", "black"] as const) {
    const r = side === "white" ? 7 : 0;
    for (const [c, key] of [
      [0, "queen"],
      [7, "king"],
    ] as const) {
      if (
        (move.from[0] === r && move.from[1] === c) ||
        (move.to[0] === r && move.to[1] === c)
      )
        n.castling[side][key] = false;
    }
  }
  n.enPassant =
    p.toLowerCase() === "p" && Math.abs(move.to[0] - move.from[0]) === 2
      ? [(move.from[0] + move.to[0]) / 2, move.from[1]]
      : null;
  n.halfmove =
    p.toLowerCase() === "p" || board[move.to[0]][move.to[1]]
      ? 0
      : rights.halfmove + 1;
  n.fullmove += move.side === "black" ? 1 : 0;
  return n;
}
/** Identifies a position for repetition: board, side, castling, en passant. */
export function positionKey(
  board: Board,
  side: Side,
  rights: ChessRights,
): string {
  // En passant matters only if a pawn of the side to move can use it.
  const ep = rights.enPassant;
  const meaningful =
    ep &&
    !board[ep[0]][ep[1]] &&
    [-1, 1].some((dc) => {
      const r = ep[0] + (side === "white" ? 1 : -1),
        c = ep[1] + dc;
      return (
        c >= 0 &&
        c < 8 &&
        board[r]?.[c] === (side === "white" ? "P" : "p") &&
        board[r][ep[1]] === (side === "white" ? "p" : "P")
      );
    });
  return (
    board.map((r) => r.map((p) => p ?? ".").join("")).join("/") +
    ` ${side} ` +
    (rights.castling.white.king ? "K" : "") +
    (rights.castling.white.queen ? "Q" : "") +
    (rights.castling.black.king ? "k" : "") +
    (rights.castling.black.queen ? "q" : "") +
    ` ${meaningful ? ep!.join(",") : "-"}`
  );
}
export const material: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};
