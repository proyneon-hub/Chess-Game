import type { GameState, MoveResult } from "@/lib/game/types";
import { rulesFor } from "@/lib/rpg/config";
export type LocalHistory = { start: GameState; completed: GameState[] };
export const recordTurn = (
  h: LocalHistory,
  result: MoveResult,
): LocalHistory =>
  result.turnConsumed
    ? {
        start: result.state,
        completed: [...h.completed, h.start].slice(
          -rulesFor(result.state).undoLimit,
        ),
      }
    : h;
export const undoTurn = (
  h: LocalHistory,
  current: GameState,
): { game: GameState; history: LocalHistory; message: string } => {
  if (current.pendingRefusal)
    return {
      game: h.start,
      history: h,
      message: "Pending order cancelled. The turn has been restored.",
    };
  const game = h.completed.at(-1);
  return game
    ? {
        game,
        history: { start: game, completed: h.completed.slice(0, -1) },
        message: "Last move undone.",
      }
    : { game: current, history: h, message: "No move to undo." };
};
