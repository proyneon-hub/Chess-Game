"use client";
import { useEffect, useRef, useState } from "react";
import { type Difficulty } from "@/lib/game";
import type { GameState, MoveAttempt, MoveResult } from "@/lib/game/types";
import type { LocalEngine } from "@/hooks/useLocalGame";
import { DIFFICULTY } from "@/lib/ai/difficulty";
// A rejected search result leaves the game unchanged, so the turn effect would
// never rerun. Try the legal fallback before giving up on this turn.
export function submitWithFallback(
  submit: (a: MoveAttempt) => MoveResult,
  move: MoveAttempt,
  fallback: MoveAttempt | undefined,
): MoveResult {
  const result = submit(move);
  return !result.requestAccepted && fallback && fallback !== move
    ? submit(fallback)
    : result;
}
export function useComputerTurn(
  game: GameState | null,
  engine: LocalEngine | null,
  enabled: boolean,
  difficulty: Difficulty,
  submit: (a: MoveAttempt) => MoveResult,
  onMessage: (m: string) => void,
) {
  const thinking =
    enabled &&
    !!game &&
    !!engine &&
    game.status === "active" &&
    game.sideToMove === "black";
  const [failure, setFailure] = useState("");
  // One worker is reused across turns so the search runs JIT-warm and the
  // chunk loads once. A worker still searching when its turn is cancelled is
  // terminated (the search is synchronous), and the next turn starts a new one.
  const idleWorker = useRef<Worker | null>(null);
  useEffect(() => () => idleWorker.current?.terminate(), []);
  useEffect(() => {
    if (!thinking || !game || !engine) return;
    setFailure("");
    let cancelled = false,
      settled = false;
    const revision = game.revision;
    const level = DIFFICULTY[difficulty];
    const fallback = engine.movesFor(game)[0];
    const apply = (move: MoveAttempt | undefined) => {
      if (cancelled || settled || !move) return;
      const result = submitWithFallback(submit, move, fallback);
      settled = result.requestAccepted;
      onMessage(result.message);
    };
    // When the player has just fought a battle, hold the reply briefly so
    // its dice and result can be read before the computer's move replaces
    // them. A cancelled turn ignores the late call.
    const readyAt =
      performance.now() + (game.battle.last?.ply === game.ply ? 1200 : 0);
    const commit = (move: MoveAttempt | undefined) => {
      const wait = readyAt - performance.now();
      if (wait > 0) setTimeout(() => apply(move), wait);
      else apply(move);
    };
    let worker: Worker | undefined,
      searching = false;
    const discard = () => {
      worker?.terminate();
      if (idleWorker.current === worker) idleWorker.current = null;
    };
    try {
      worker =
        idleWorker.current ??
        new Worker(new URL("../lib/ai/worker.ts", import.meta.url));
      idleWorker.current = worker;
      worker.onmessage = (e) => {
        if (e.data.revision !== revision) return;
        searching = false;
        if (e.data.error)
          setFailure("Computer search recovered with a legal move.");
        commit(e.data.result?.moves[0] ?? fallback);
      };
      worker.onerror = () => {
        searching = false;
        discard();
        setFailure("Computer search recovered with a legal move.");
        commit(fallback);
      };
      searching = true;
      worker.postMessage({
        revision,
        input: {
          board: game.board,
          rights: game.rights,
          side: "black",
          depth: level.depth,
          budgetMs: level.budgetMs,
          spreadCp: level.spreadCp,
          positions: game.positions,
          rules: "battle",
          units: engine.unitGrid(game),
          battle: engine.rulesFor(game).battle,
        },
      });
    } catch {
      commit(fallback);
    }
    const watchdog = setTimeout(() => {
      if (searching) discard();
      searching = false;
      commit(fallback);
    }, level.watchdogMs);
    return () => {
      cancelled = true;
      clearTimeout(watchdog);
      if (searching) discard();
    };
  }, [thinking, game, engine, difficulty, submit, onMessage]);
  return { thinking, failure };
}
