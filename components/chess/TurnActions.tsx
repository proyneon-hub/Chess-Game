import { squareName } from "@/lib/chess";
import type { Intention } from "@/lib/game/types";
import type { PublicGame } from "@/lib/game/publicState";
import { button } from "@/components/chess/styles";

/** Repeating a refused order and claiming an available draw. */
export function TurnActions({
  game,
  myTurn,
  send,
}: {
  game: PublicGame;
  myTurn: boolean;
  send: (intent: Intention | { type: "claim-draw" }) => void;
}) {
  const refusal = game.pendingRefusal;
  return (
    <>
      {refusal && (
        <div className="text-sm text-stone-300">
          <p>
            Order: {squareName(refusal.from)} to {squareName(refusal.to)}.
          </p>
          <button
            disabled={!myTurn}
            className={button + " mt-2"}
            onClick={() => send(refusal)}
          >
            Repeat order
          </button>
        </div>
      )}
      {(game.drawClaims.threefold || game.drawClaims.fiftyMove) &&
        game.status === "active" && (
          <button
            disabled={!myTurn}
            className={button}
            onClick={() => send({ type: "claim-draw" })}
          >
            Claim draw
          </button>
        )}
    </>
  );
}
