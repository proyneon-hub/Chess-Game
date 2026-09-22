import type { Difficulty } from "@/lib/game";
import type { GameState } from "@/lib/game/types";
import type { LocalHistory } from "@/lib/game/undo";
import { migrateState } from "@/lib/game/migrate";
import { record } from "@/lib/game/validation";

// Local and computer games survive a reload in this browser only. Storage can
// be missing, full, or blocked, so every access is guarded and a failure
// simply means the game is not kept.
const KEY = "chess:local-game:v1";
export type LocalSave = {
  mode: "local" | "computer";
  difficulty: Difficulty;
  game: GameState;
  history: LocalHistory;
};

/** Returns a saved game only if every stored state validates. */
export function loadLocalGame(): LocalSave | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    if (
      !record(v) ||
      (v.mode !== "local" && v.mode !== "computer") ||
      (v.difficulty !== "normal" && v.difficulty !== "advanced") ||
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

export function saveLocalGame(save: LocalSave) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Undo history is the bulk of a save; keep at least the position.
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          ...save,
          history: { start: save.history.start, completed: [] },
        }),
      );
    } catch {
      clearLocalGame();
    }
  }
}

export function clearLocalGame() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* Storage unavailable. */
  }
}
