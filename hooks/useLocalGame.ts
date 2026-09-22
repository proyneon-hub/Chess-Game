"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Difficulty } from "@/lib/game";
import type { Action, GameState, MoveResult } from "@/lib/game/types";
import type { LocalHistory } from "@/lib/game/undo";
import type { LocalSave } from "@/hooks/localSave";
import { clearLocalGame, saveLocalGame } from "@/hooks/localSave";

export type LocalEngine = typeof import("@/lib/localEngine");

/**
 * A local or computer game. The rules engine loads on first use (starting
 * or restoring a game), so `game` and `view` are null until then.
 */
export function useLocalGame() {
  const engine = useRef<LocalEngine | null>(null),
    [loaded, setLoaded] = useState<LocalEngine | null>(null);
  const [game, setGame] = useState<GameState | null>(null),
    // Mirrors history.current so render never reads the ref.
    [undoDepth, setUndoDepth] = useState(0);
  const current = useRef<GameState | null>(null),
    history = useRef<LocalHistory | null>(null);
  const load = useCallback(async () => {
    if (!engine.current) {
      engine.current = await import("@/lib/localEngine");
      setLoaded(engine.current);
    }
    return engine.current;
  }, []);
  const set = (next: GameState, saved: LocalHistory) => {
    current.current = next;
    history.current = saved;
    setUndoDepth(saved.completed.length);
    setGame(next);
  };
  const reset = useCallback(async () => {
    const next = (await load()).createGameState();
    set(next, { start: next, completed: [] });
  }, [load]);
  /** Restores a validated saved game, if one exists. */
  const restoreSaved = useCallback(async (): Promise<LocalSave | null> => {
    const saved = (await load()).loadLocalGame();
    if (saved) set(saved.game, saved.history);
    return saved;
  }, [load]);
  const submit = useCallback((action: Action): MoveResult => {
    const e = engine.current!,
      result = e.submitMove(current.current!, action);
    if (result.requestAccepted) {
      history.current = e.recordTurn(history.current!, result);
      current.current = result.state;
      setUndoDepth(history.current.completed.length);
      setGame(result.state);
    }
    return result;
  }, []);
  const undo = useCallback(() => {
    const restored = engine.current!.undoTurn(
      history.current!,
      current.current!,
    );
    set(restored.game, restored.history);
    return restored.message;
  }, []);
  /** Keeps the game across reloads once a move has been made. */
  const save = useCallback(
    (mode: LocalSave["mode"], difficulty: Difficulty) => {
      if (!current.current || !history.current) return;
      if (!current.current.revision) clearLocalGame();
      else
        saveLocalGame({
          mode,
          difficulty,
          game: current.current,
          history: history.current,
        });
    },
    [],
  );
  const view = useMemo(
    () => (game && loaded ? loaded.publicState(game) : null),
    [game, loaded],
  );
  return {
    game,
    view,
    engine: loaded,
    submit,
    reset,
    undo,
    restoreSaved,
    save,
    canUndo: !!game && (!!game.pendingRefusal || undoDepth > 0),
  };
}
