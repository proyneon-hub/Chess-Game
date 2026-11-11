import { type Board, type Side, type Square, freshRights } from "@/lib/chess";
import { positionKey } from "@/lib/chessRules";
import { createGameState } from "@/lib/game";
import type { GameState } from "@/lib/game/types";
import { initializePieceIds } from "@/lib/game/pieceIds";
import { initialUnits } from "@/lib/battle/resolve";
import { BATTLE_RULES } from "@/lib/battle/stats";

/** A position with full-strength units and no castling rights. */
export const boardFixture = (
  entries: [string, Square][],
  side: Side = "white",
  seed = 1,
): GameState => {
  const s = createGameState(seed);
  s.board = Array.from({ length: 8 }, () => Array(8).fill(null)) as Board;
  for (const [p, [r, c]] of entries) s.board[r][c] = p;
  s.pieceIds = initializePieceIds(s.board);
  s.battle.units = initialUnits(s.board, s.pieceIds);
  s.rights = freshRights(false);
  s.sideToMove = side;
  s.positions = { [positionKey(s.board, side, s.rights)]: 1 };
  return s;
};
/** Draws that make the dice show these faces, attacker first. */
export const rolls = (...faces: number[]) => {
  let i = 0;
  return () => (faces[i++] - 0.5) / BATTLE_RULES.die;
};
export const unitAt = (s: GameState, [r, c]: Square) =>
  s.battle.units[s.pieceIds[r][c]!];
export const KINGS: [string, Square][] = [
  ["K", [7, 4]],
  ["k", [0, 4]],
];
