"use client";
import {
  type Square,
  PIECE_SYMBOLS,
  findKing,
  isInCheck,
  isWhite,
  pieceName,
  sameSquare,
  squareName,
} from "@/lib/chess";
import type { PublicGame } from "@/lib/game/publicState";
export function Board({
  game,
  selected,
  moves,
  flipped,
  onSquare,
}: {
  game: PublicGame;
  selected: Square | null;
  moves: Square[];
  flipped: boolean;
  onSquare: (s: Square) => void;
}) {
  const indices = Array.from({ length: 8 }, (_, i) => (flipped ? 7 - i : i)),
    check = isInCheck(game.board, game.sideToMove === "white")
      ? findKing(game.board, game.sideToMove === "white")
      : null;
  const lastEvent = game.events.findLast((e) => e.actual),
    deviated =
      lastEvent?.intended &&
      lastEvent.actual &&
      !sameSquare(lastEvent.intended, lastEvent.actual);
  return (
    <section
      aria-label="Chess board"
      className="min-w-0 self-start rounded-lg border border-amber-500/30 bg-black/45 p-2 shadow-2xl sm:p-3"
    >
      <div className="flex">
        <div className="flex w-5 shrink-0 flex-col">
          {indices.map((r) => (
            <span
              key={r}
              className="flex flex-1 items-center justify-center text-xs text-stone-400"
            >
              {8 - r}
            </span>
          ))}
        </div>
        <div className="grid w-full grid-cols-8 border-2 border-stone-700">
          {indices.flatMap((r) =>
            indices.map((c) => {
              const sq: Square = [r, c],
                p = game.board[r][c],
                chosen = selected && sameSquare(selected, sq),
                legal = moves.some((m) => sameSquare(m, sq)),
                last = game.lastMove?.some((m) => sameSquare(m, sq)),
                special =
                  game.specialSquare && sameSquare(game.specialSquare, sq),
                checked = check && sameSquare(check, sq),
                warning =
                  game.warning?.square && sameSquare(game.warning.square, sq),
                intended = deviated && sameSquare(lastEvent.intended!, sq);
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  data-square={squareName(sq)}
                  aria-label={`${squareName(sq)} ${p ? pieceName(p) : "empty"}${checked ? ", check" : ""}${legal ? ", legal destination" : ""}`}
                  aria-pressed={!!chosen}
                  onClick={() => onSquare(sq)}
                  onKeyDown={(e) => {
                    const steps: Record<string, Square> = {
                      ArrowUp: [-1, 0],
                      ArrowDown: [1, 0],
                      ArrowLeft: [0, -1],
                      ArrowRight: [0, 1],
                    };
                    const step = steps[e.key];
                    if (!step) return;
                    e.preventDefault();
                    const factor = flipped ? -1 : 1;
                    const nr = r + step[0] * factor,
                      nc = c + step[1] * factor;
                    if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8)
                      document
                        .querySelector<HTMLButtonElement>(
                          `[data-square="${squareName([nr, nc])}"]`,
                        )
                        ?.focus();
                  }}
                  className="chess-square relative flex aspect-square min-w-0 items-center justify-center focus-visible:z-40 focus-visible:outline focus-visible:outline-4 focus-visible:outline-blue-700"
                  style={{
                    background: chosen
                      ? "#7dd3fc"
                      : (r + c) % 2 === 0
                        ? "#f0d9b5"
                        : "#b58863",
                  }}
                >
                  {last && (
                    <span className="absolute inset-0 bg-yellow-300/25" />
                  )}
                  {chosen && (
                    <span className="absolute inset-0 border-4 border-blue-600" />
                  )}
                  {legal && (
                    <span
                      className={
                        p
                          ? "absolute inset-0 rounded-full border-4 border-red-700"
                          : "absolute h-3 w-3 rounded-full bg-emerald-800"
                      }
                    />
                  )}
                  {(special || warning) && (
                    <span className="actual-destination absolute inset-0 border-4 border-dashed border-amber-400" />
                  )}
                  {intended && (
                    <span className="intended-destination absolute inset-1 border-2 border-dotted border-blue-800" />
                  )}
                  {checked && (
                    <span className="absolute inset-0 border-4 border-red-700">
                      <span className="absolute right-0 top-0 text-xs font-bold text-red-900">
                        !
                      </span>
                    </span>
                  )}
                  {p && (
                    <span
                      aria-hidden="true"
                      className="relative text-[clamp(1.4rem,6vw,3.25rem)] leading-none"
                      style={{
                        fontFamily: '"Segoe UI Symbol", "DejaVu Sans", serif',
                        color: isWhite(p) ? "#fff" : "#1a1008",
                        textShadow: isWhite(p)
                          ? "0 1px 4px #000"
                          : "0 1px 2px rgba(255,255,255,.2)",
                      }}
                    >
                      {PIECE_SYMBOLS[p] + "\uFE0E"}
                    </span>
                  )}
                </button>
              );
            }),
          )}
        </div>
      </div>
      <div className="ml-5 grid grid-cols-8">
        {indices.map((c) => (
          <span key={c} className="text-center text-xs text-stone-400">
            {String.fromCharCode(97 + c)}
          </span>
        ))}
      </div>
    </section>
  );
}
