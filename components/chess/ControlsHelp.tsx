import type { PublicGame } from "@/lib/game/publicState";

/** Collapsible help for the board controls. */
export function ControlsHelp({ game }: { game: PublicGame }) {
  return (
    <details className="text-sm text-stone-300">
      <summary>Controls</summary>
      <p className="mt-2">
        Select a piece, then a highlighted destination. Tab to the board, then
        use the arrow keys (Home and End along a rank) and Enter to select.
        Choose a piece when promoting a pawn. Games here are kept in this
        browser if you reload.
      </p>
      {game.events.some((e) => e.message.includes("hesitates")) && (
        <p className="mt-2">
          After hesitation, repeat the order or select a different legal move.
          Inspect the event log for earlier observations.
        </p>
      )}
    </details>
  );
}
