import type { Difficulty } from "@/lib/game";
import type { GameState } from "@/lib/game/types";
import type { LocalHistory } from "@/lib/game/undo";

// Local and computer games survive a reload in this browser only. Storage can
// be missing, full, or blocked, so every access is guarded and a failure
// simply means the game is not kept. This module stays free of the rules
// engine; validating a saved game (loadLocalGame) lives in lib/localEngine.
export const LOCAL_SAVE_KEY = "chess:local-game:v1";
export type LocalSave = {
  mode: "local" | "computer";
  difficulty: Difficulty;
  game: GameState;
  history: LocalHistory;
};

/** The raw saved value, if any; callers must validate before use. */
export function readLocalSave(): string | null {
  try {
    return localStorage.getItem(LOCAL_SAVE_KEY);
  } catch {
    return null;
  }
}

export function saveLocalGame(save: LocalSave) {
  try {
    localStorage.setItem(LOCAL_SAVE_KEY, JSON.stringify(save));
  } catch {
    // Undo history is the bulk of a save; keep at least the position.
    try {
      localStorage.setItem(
        LOCAL_SAVE_KEY,
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
    localStorage.removeItem(LOCAL_SAVE_KEY);
  } catch {
    /* Storage unavailable. */
  }
}
