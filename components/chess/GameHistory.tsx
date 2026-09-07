import type { PublicGame } from "@/lib/game/publicState";
import { squareName } from "@/lib/chess";
export function GameHistory({ game }: { game: PublicGame }) {
  return (
    <>
      <details
        open
        className="border border-stone-800 bg-stone-950 px-4 py-3 text-sm text-stone-300"
      >
        <summary>Move History</summary>
        <ol className="mt-2 max-h-40 space-y-2 overflow-auto">
          {game.moves.length ? (
            game.moves.map((m) => <li key={m.number}>{m.text}</li>)
          ) : (
            <li>No moves yet.</li>
          )}
        </ol>
      </details>
      <details
        open
        className="border border-stone-800 bg-stone-950 px-4 py-3 text-sm text-stone-300"
      >
        <summary>Event Log</summary>
        <ol className="mt-2 max-h-44 space-y-2 overflow-auto">
          {game.events.length ? (
            game.events
              .slice()
              .reverse()
              .map((e) => (
                <li
                  key={e.seq}
                  className={e.special ? "text-amber-200" : undefined}
                >
                  {e.message}
                  {e.special && e.intended && e.actual && (
                    <span className="block text-xs">
                      Ordered {squareName(e.intended)}; reached{" "}
                      {squareName(e.actual)}.
                    </span>
                  )}
                </li>
              ))
          ) : (
            <li>Game started. White to move.</li>
          )}
        </ol>
      </details>
    </>
  );
}
