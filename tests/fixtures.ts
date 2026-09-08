import type { Board, Square } from "@/lib/chess";
import { freshRights } from "@/lib/chess";
import { createGameState } from "@/lib/game";
import { initializePieceIds } from "@/lib/rpgChess";
import { initializeSimulation } from "@/lib/rpg/initialize";
import { positionKey } from "@/lib/chessRules";
export const boardFixture = (entries: [string, Square][], ply = 16) => {
  const s = createGameState(42, "2026-09-07.3");
  s.board = Array.from({ length: 8 }, () => Array(8).fill(null)) as Board;
  for (const [p, [r, c]] of entries) s.board[r][c] = p;
  s.pieceIds = initializePieceIds(s.board);
  s.simulation = initializeSimulation(s.board, s.pieceIds, 42, "2026-09-07.3");
  s.rights = freshRights(false);
  s.ply = ply;
  s.simulation.turnContext.ply = ply;
  s.positions = { [positionKey(s.board, s.sideToMove, s.rights)]: 1 };
  return s;
};
export const subjectAt = (s: ReturnType<typeof createGameState>, sq: Square) =>
  s.simulation!.subjects[s.pieceIds[sq[0]][sq[1]]!];
export const scripted = (...values: number[]) => {
  let i = 0;
  return () => values[i++] ?? 0.99;
};
