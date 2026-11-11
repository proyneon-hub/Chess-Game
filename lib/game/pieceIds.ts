import { type Board, KIND_NAMES, isWhite } from "@/lib/chess";

export type PieceIdBoard = (string | null)[][];
/** Stable private ids ("white_pawn_3") that follow each piece as it moves. */
export const initializePieceIds = (board: Board): PieceIdBoard => {
  const counts: Record<string, number> = {};
  return board.map((row) =>
    row.map((piece) => {
      if (!piece) return null;
      const key = `${isWhite(piece) ? "white" : "black"}_${KIND_NAMES[piece.toLowerCase()]}`;
      counts[key] = (counts[key] ?? 0) + 1;
      return `${key}_${counts[key]}`;
    }),
  );
};
