import {
  type Board,
  type ChessRights,
  type Side,
  type Square,
  type PromotionKind,
  applyMove,
  getLegalMoves,
  isInCheck,
  isWhite,
} from "@/lib/chess";

export type ChessMove = {
  from: Square;
  to: Square;
  side: Side;
  promotion?: PromotionKind;
};
export const allMoves = (
  board: Board,
  side: Side,
  rights?: ChessRights,
): ChessMove[] => {
  const out: ChessMove[] = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      for (const to of getLegalMoves(board, r, c, side === "white", rights)) {
        if (board[r][c]?.toLowerCase() === "p" && (to[0] === 0 || to[0] === 7))
          for (const promotion of ["q", "r", "b", "n"] as const)
            out.push({ from: [r, c], to, side, promotion });
        else out.push({ from: [r, c], to, side });
      }
  return out;
};
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
export function positionKey(
  board: Board,
  side: Side,
  rights: ChessRights,
): string {
  // En passant matters only if a legal capture actually exists (including pins).
  const ep = rights.enPassant;
  const meaningful =
    ep &&
    [-1, 1].some((dc) => {
      const r = ep[0] + (side === "white" ? 1 : -1),
        c = ep[1] + dc;
      return (
        c >= 0 &&
        c < 8 &&
        board[r]?.[c] === (side === "white" ? "P" : "p") &&
        getLegalMoves(board, r, c, side === "white", rights).some(
          (t) => t[0] === ep[0] && t[1] === ep[1],
        )
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
export function insufficientMaterial(board: Board): boolean {
  const pieces: { p: string; r: number; c: number }[] = [];
  board.forEach((row, r) =>
    row.forEach((p, c) => {
      if (p && p.toLowerCase() !== "k")
        pieces.push({ p: p.toLowerCase(), r, c });
    }),
  );
  if (!pieces.length) return true;
  if (pieces.length === 1 && "bn".includes(pieces[0].p)) return true;
  return (
    pieces.every((x) => x.p === "b") &&
    pieces.every((x) => (x.r + x.c) % 2 === (pieces[0].r + pieces[0].c) % 2)
  );
}
export function perft(
  board: Board,
  side: Side,
  rights: ChessRights,
  depth: number,
): number {
  if (!depth) return 1;
  return allMoves(board, side, rights).reduce(
    (n, m) =>
      n +
      perft(
        applyMove(board, m.from, m.to, m.promotion, rights),
        side === "white" ? "black" : "white",
        nextRights(board, rights, m),
        depth - 1,
      ),
    0,
  );
}
export const kingsValid = (board: Board) =>
  board.flat().filter((p) => p === "K").length === 1 &&
  board.flat().filter((p) => p === "k").length === 1;
export const legalFinalBoard = (board: Board, side: Side) =>
  kingsValid(board) && !isInCheck(board, side === "white");
export const captureSquare = (board: Board, move: ChessMove): Square | null =>
  board[move.to[0]][move.to[1]]
    ? move.to
    : board[move.from[0]][move.from[1]]?.toLowerCase() === "p" &&
        move.from[1] !== move.to[1]
      ? [move.from[0], move.to[1]]
      : null;
export const material: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};
export const sideOf = (p: string): Side => (isWhite(p) ? "white" : "black");
