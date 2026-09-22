"use client";
import { memo, useCallback, useRef, useState, type KeyboardEvent } from "react";
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
type Marks = {
  chosen: boolean;
  legal: boolean;
  last: boolean;
  special: boolean;
  checked: boolean;
  warning: boolean;
  intended: boolean;
  requested: boolean;
  hesitating: boolean;
};
const ARROWS: Record<string, Square> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};
// The label carries everything the highlights show.
const label = (sq: Square, p: string | null, m: Marks) =>
  [
    `${squareName(sq)} ${p ? pieceName(p) : "empty"}`,
    m.checked && "check",
    m.legal && "legal destination",
    m.last && "last move",
    m.special && "unexpected destination",
    m.warning && "warning",
    m.intended && "ordered destination",
    m.requested && "requesting piece",
    m.hesitating && "hesitated",
  ]
    .filter(Boolean)
    .join(", ");
type SquareProps = {
  r: number;
  c: number;
  piece: string | null;
  marks: Marks;
  focusable: boolean;
  flipped: boolean;
  onSquare: (s: Square) => void;
  onNavigate: (
    e: KeyboardEvent,
    r: number,
    c: number,
    flipped: boolean,
  ) => void;
  register: (r: number, c: number, el: HTMLButtonElement | null) => void;
};
const sameProps = (a: SquareProps, b: SquareProps) =>
  a.piece === b.piece &&
  a.focusable === b.focusable &&
  a.flipped === b.flipped &&
  a.onSquare === b.onSquare &&
  (Object.keys(a.marks) as (keyof Marks)[]).every(
    (k) => a.marks[k] === b.marks[k],
  );
// Memoized so a status change re-renders only squares whose marks changed.
const BoardSquare = memo(function BoardSquare({
  r,
  c,
  piece: p,
  marks: m,
  focusable,
  flipped,
  onSquare,
  onNavigate,
  register,
}: SquareProps) {
  const sq: Square = [r, c];
  return (
    <button
      ref={(el) => register(r, c, el)}
      type="button"
      tabIndex={focusable ? 0 : -1}
      data-square={squareName(sq)}
      aria-label={label(sq, p, m)}
      aria-pressed={m.chosen}
      onClick={() => onSquare(sq)}
      onKeyDown={(e) => onNavigate(e, r, c, flipped)}
      className={`chess-square${m.hesitating ? " hesitating" : ""} relative flex aspect-square min-w-0 items-center justify-center focus-visible:z-40 focus-visible:outline focus-visible:outline-4 focus-visible:outline-blue-900 focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-white`}
      style={{
        background: m.chosen
          ? "#7dd3fc"
          : (r + c) % 2 === 0
            ? "#f0d9b5"
            : "#b58863",
      }}
    >
      {m.last && <span className="absolute inset-0 bg-yellow-300/45" />}
      {m.chosen && (
        <span className="absolute inset-0 border-4 border-blue-700" />
      )}
      {/* Two-tone marks keep 3:1 contrast on light and dark squares. */}
      {m.legal && (
        <span
          className={
            p
              ? "absolute inset-0 rounded-full border-4 border-red-800 ring-2 ring-inset ring-white/80"
              : "absolute h-3.5 w-3.5 rounded-full bg-emerald-900 ring-2 ring-white/85"
          }
        />
      )}
      {(m.special || m.warning) && (
        <span className="actual-destination absolute inset-0 border-4 border-dashed border-amber-400" />
      )}
      {m.requested && (
        <span className="absolute inset-1 rounded-full border-2 border-dotted border-amber-800 ring-1 ring-white/80" />
      )}
      {m.intended && (
        <span className="intended-destination absolute inset-1 border-2 border-dotted border-blue-800" />
      )}
      {m.checked && (
        <span className="absolute inset-0 border-4 border-red-800 ring-2 ring-inset ring-white/80">
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
              ? "0 0 2px #000, 0 1px 4px #000"
              : "0 1px 2px rgba(255,255,255,.2)",
          }}
        >
          {PIECE_SYMBOLS[p] + "︎"}
        </span>
      )}
    </button>
  );
}, sameProps);
export function Board({
  game,
  selected,
  moves,
  flipped,
  onSquare,
  requested = [],
}: {
  game: PublicGame;
  selected: Square | null;
  moves: Square[];
  flipped: boolean;
  onSquare: (s: Square) => void;
  /** Pieces making a request the viewer can answer. */
  requested?: Square[];
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
  // One tab stop for the whole board (roving tabindex): the square that last
  // had focus, the selection, or the king's home square on the viewer's side.
  const [focused, setFocused] = useState<Square | null>(null),
    squares = useRef<(HTMLButtonElement | null)[]>([]);
  const tabStop: Square = selected ?? focused ?? (flipped ? [0, 4] : [7, 4]);
  const register = useCallback(
    (r: number, c: number, el: HTMLButtonElement | null) => {
      squares.current[r * 8 + c] = el;
    },
    [],
  );
  const onNavigate = useCallback(
    (e: KeyboardEvent, r: number, c: number, view: boolean) => {
      let target: Square | null = null;
      if (e.key in ARROWS) {
        const [dr, dc] = ARROWS[e.key],
          factor = view ? -1 : 1;
        target = [r + dr * factor, c + dc * factor];
      } else if (e.key === "Home") target = [r, view ? 7 : 0];
      else if (e.key === "End") target = [r, view ? 0 : 7];
      if (!target) return;
      e.preventDefault();
      const [nr, nc] = target;
      if (nr < 0 || nr > 7 || nc < 0 || nc > 7) return;
      setFocused(target);
      squares.current[nr * 8 + nc]?.focus();
    },
    [],
  );
  return (
    <section
      aria-label="Chess board"
      className="min-w-0 self-start rounded-lg border border-amber-500/30 bg-black/45 p-2 shadow-2xl sm:p-3"
    >
      <div className="flex">
        <div aria-hidden="true" className="flex w-5 shrink-0 flex-col">
          {indices.map((r) => (
            <span
              key={r}
              className="flex flex-1 items-center justify-center text-xs text-stone-400"
            >
              {8 - r}
            </span>
          ))}
        </div>
        <div
          onFocus={(e) => {
            const name = (e.target as HTMLElement).dataset.square;
            if (!name) return;
            const next: Square = [8 - Number(name[1]), name.charCodeAt(0) - 97];
            if (!focused || !sameSquare(focused, next)) setFocused(next);
          }}
          className="grid w-full grid-cols-8 border-2 border-stone-700"
        >
          {indices.flatMap((r) =>
            indices.map((c) => {
              const sq: Square = [r, c];
              return (
                <BoardSquare
                  key={`${r}-${c}`}
                  r={r}
                  c={c}
                  piece={game.board[r][c]}
                  focusable={sameSquare(tabStop, sq)}
                  flipped={flipped}
                  onSquare={onSquare}
                  onNavigate={onNavigate}
                  register={register}
                  marks={{
                    chosen: !!selected && sameSquare(selected, sq),
                    legal: moves.some((m) => sameSquare(m, sq)),
                    last: !!game.lastMove?.some((m) => sameSquare(m, sq)),
                    special:
                      !!game.specialSquare &&
                      sameSquare(game.specialSquare, sq),
                    checked: !!check && sameSquare(check, sq),
                    warning:
                      !!game.warning?.square &&
                      sameSquare(game.warning.square, sq),
                    intended: !!deviated && sameSquare(lastEvent.intended!, sq),
                    requested: requested.some((q) => sameSquare(q, sq)),
                    hesitating:
                      !!game.pendingRefusal &&
                      sameSquare(game.pendingRefusal.from, sq),
                  }}
                />
              );
            }),
          )}
        </div>
      </div>
      <div aria-hidden="true" className="ml-5 grid grid-cols-8">
        {indices.map((c) => (
          <span key={c} className="text-center text-xs text-stone-400">
            {String.fromCharCode(97 + c)}
          </span>
        ))}
      </div>
    </section>
  );
}
