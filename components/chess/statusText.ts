import { isInCheck } from "@/lib/chess";
import type { GameKind } from "@/lib/game";
import type { PublicGame, PublicMatch } from "@/lib/game/publicState";

export type StatusInput = {
  game: PublicGame;
  kind: GameKind;
  online: { error: string; remote: PublicMatch | null; busy: boolean };
  computerThinking: boolean;
  message: string;
};

/** The single status line: results and check first, then mode-specific. */
export function statusText({
  game,
  kind,
  online,
  computerThinking,
  message,
}: StatusInput): string {
  if (game.result) return game.result;
  if (isInCheck(game.board, game.sideToMove === "white")) return "Check!";
  if (game.warning) return game.warning.message;
  if (kind === "online") {
    if (online.error) return online.error;
    if (!online.remote) return "Opening the match…";
    if (online.remote.waitingForOpponent)
      return "Waiting for an opponent to join.";
    if (online.busy) return "Submitting move…";
    return game.lastAction?.message || "Select a piece and destination.";
  }
  return computerThinking ? "Your opponent is considering the board." : message;
}
