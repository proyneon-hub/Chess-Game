// Everything local and computer play needs from the rules engine, loaded on
// demand (see hooks/useLocalGame.ts) so the menu and online play do not
// download it. Online play needs only the public state and the odds maths.
import type { LocalSave } from "@/hooks/localSave";
import { clearLocalGame, readLocalSave } from "@/hooks/localSave";
import { loadState, record } from "@/lib/game/validation";

export { recordTurn, undoTurn } from "@/lib/game/undo";
export { publicState } from "@/lib/game/publicState";
export { createGameState, movesFor, submitMove } from "@/lib/game";
export { unitGrid } from "@/lib/battle/resolve";
export { rulesFor } from "@/lib/battle/config";

/** Returns a saved game only if every stored state validates. */
export function loadLocalGame(): LocalSave | null {
  try {
    const raw = readLocalSave();
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    if (
      !record(v) ||
      (v.mode !== "local" && v.mode !== "computer") ||
      (v.difficulty !== "easy" &&
        v.difficulty !== "normal" &&
        v.difficulty !== "advanced") ||
      !record(v.history) ||
      !Array.isArray(v.history.completed)
    )
      throw Error("Invalid save.");
    return {
      mode: v.mode,
      difficulty: v.difficulty,
      game: loadState(v.game),
      history: {
        start: loadState(v.history.start),
        completed: v.history.completed.map(loadState),
      },
    };
  } catch {
    clearLocalGame();
    return null;
  }
}
