"use client";
import { useEffect, useState } from "react";
import { type Difficulty, getAllLegalMoves } from "@/lib/game";
import type { GameState, MoveAttempt, MoveResult } from "@/lib/game/types";
import { ownPolitics } from "@/lib/ai/politicalEvaluation";
export function useComputerTurn(
  game: GameState,
  enabled: boolean,
  difficulty: Difficulty,
  submit: (a: MoveAttempt) => MoveResult,
  onMessage: (m: string) => void,
) {
  const thinking =
    enabled && game.status === "active" && game.sideToMove === "black";
  const [failure, setFailure] = useState("");
  useEffect(() => {
    if (!thinking) return;
    let cancelled = false,
      settled = false;
    const revision = game.revision;
    const fallback = getAllLegalMoves(game.board, "black", game.rights)[0];
    const commit = (move: MoveAttempt | undefined) => {
      if (cancelled || settled || !move) return;
      settled = true;
      const result = submit(move);
      onMessage(result.message);
    };
    // After refusal, the same legal command completes with no search or roll.
    if (game.pendingRefusal) {
      const timer = setTimeout(
        () => commit({ ...game.pendingRefusal!, side: "black" }),
        150,
      );
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }
    let worker: Worker | undefined;
    try {
      worker = new Worker(new URL("../lib/ai/worker.ts", import.meta.url));
      worker.onmessage = (e) => {
        if (e.data.revision !== revision) return;
        if (e.data.error)
          setFailure("Computer search recovered with a legal move.");
        commit(e.data.result?.moves[0] ?? fallback);
      };
      worker.onerror = () => {
        setFailure("Computer search recovered with a legal move.");
        commit(fallback);
      };
      worker.postMessage({
        revision,
        input: {
          board: game.board,
          rights: game.rights,
          side: "black",
          depth: difficulty === "advanced" ? 4 : 2,
          budgetMs: difficulty === "advanced" ? 1000 : 250,
          own: ownPolitics(game, "black"),
        },
      });
    } catch {
      commit(fallback);
    }
    const watchdog = setTimeout(
      () => {
        worker?.terminate();
        commit(fallback);
      },
      difficulty === "advanced" ? 4000 : 2000,
    );
    return () => {
      cancelled = true;
      clearTimeout(watchdog);
      worker?.terminate();
    };
  }, [thinking, game, difficulty, submit, onMessage]);
  return { thinking, failure };
}
