"use client";
import { useCallback, useRef, useState } from "react";
import { createGameState, submitMove } from "@/lib/game";
import type { Action, GameState } from "@/lib/game/types";
import { recordTurn, undoTurn, type LocalHistory } from "@/lib/game/undo";
export function useLocalGame() {
  const [game, setGame] = useState(() => createGameState(0));
  const current = useRef(game);
  const history = useRef<LocalHistory>({ start: game, completed: [] });
  const reset = useCallback(() => {
    const next = createGameState();
    current.current = next;
    history.current = { start: next, completed: [] };
    setGame(next);
  }, []);
  const submit = useCallback((action: Action) => {
    const result = submitMove(current.current, action);
    if (result.requestAccepted) {
      history.current = recordTurn(history.current, result);
      current.current = result.state;
      setGame(result.state);
    }
    return result;
  }, []);
  const undo = useCallback(() => {
    const restored = undoTurn(history.current, current.current);
    history.current = restored.history;
    current.current = restored.game;
    setGame(restored.game);
    return restored.message;
  }, []);
  // Restores a validated saved game (see hooks/localSave.ts).
  const restore = useCallback((next: GameState, saved: LocalHistory) => {
    current.current = next;
    history.current = saved;
    setGame(next);
  }, []);
  const snapshot = useCallback(
    () => ({ game: current.current, history: history.current }),
    [],
  );
  const replace = useCallback((next: GameState, expected: number) => {
    if (current.current.revision !== expected) return false;
    current.current = next;
    setGame(next);
    return true;
  }, []);
  return {
    game,
    submit,
    reset,
    undo,
    replace,
    restore,
    snapshot,
    canUndo: !!game.pendingRefusal || history.current.completed.length > 0,
  };
}
