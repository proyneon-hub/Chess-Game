// Everything local and computer play needs from the rules engine, loaded on
// demand (see hooks/useLocalGame.ts) so the menu and online play do not
// download it. Online play only needs lib/chess and the server's public state.
import type { LocalSave } from "@/hooks/localSave";
import { clearLocalGame, readLocalSave } from "@/hooks/localSave";
import { migrateState } from "@/lib/game/migrate";
import { record } from "@/lib/game/validation";

export { createGameState, submitMove } from "@/lib/game";
export { recordTurn, undoTurn } from "@/lib/game/undo";
export { publicState } from "@/lib/game/publicState";
export { refusalFallback } from "@/lib/ai/restraint";
export { ownPolitics } from "@/lib/ai/politicalEvaluation";

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
      game: migrateState(v.game),
      history: {
        start: migrateState(v.history.start),
        completed: v.history.completed.map(migrateState),
      },
    };
  } catch {
    clearLocalGame();
    return null;
  }
}
