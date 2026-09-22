import type { Side } from "@/lib/chess";
import type { GameKind } from "@/lib/game";
import type { PublicGame } from "@/lib/game/publicState";

export type OnlineTurnState = {
  remote: { waitingForOpponent: boolean } | null;
  busy: boolean;
  retryable: boolean;
};

/** Whether the viewer may act on the board right now. */
export const canMove = ({
  game,
  side,
  kind,
  computerThinking,
  online,
}: {
  game: PublicGame | null;
  side: Side | null | undefined;
  kind: GameKind | null;
  computerThinking: boolean;
  online: OnlineTurnState;
}): boolean =>
  !!game &&
  !!side &&
  side === game.sideToMove &&
  game.status === "active" &&
  !computerThinking &&
  !(
    kind === "online" &&
    (!online.remote ||
      online.remote.waitingForOpponent ||
      online.busy ||
      online.retryable)
  );
