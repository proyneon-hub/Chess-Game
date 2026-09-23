"use client";
import { useEffect, useRef, useState } from "react";
import type { Side } from "@/lib/chess";
import type { PublicGame } from "@/lib/game/publicState";
export function EncounterArea({
  encounters: all,
  quietSide,
}: {
  encounters: NonNullable<PublicGame["encounters"]>;
  /** A side the viewer does not command (the computer): one summary line. */
  quietSide?: Side;
}) {
  const encounters = all.filter((e) => e.side !== quietSide),
    quiet = all.filter((e) => e.side === quietSide && !e.outcome).length;
  const seen = useRef(new Set<string>()),
    [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    // Encounter ids are unique within a game; an empty list (including a new
    // game) lets repeated ids from a later game announce again.
    if (!encounters.length) seen.current.clear();
    const fresh = encounters.filter(
      (e) => !seen.current.has(`${e.id}|${e.message}|${e.outcome}`),
    );
    for (const e of fresh)
      seen.current.add(`${e.id}|${e.message}|${e.outcome}`);
    if (fresh.length)
      setAnnouncement(
        fresh.map((e) => e.outcome ?? `${e.message} ${e.response}`).join(" "),
      );
  }, [encounters]);
  return (
    <>
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </span>
      {quiet > 0 && (
        <p className="text-xs text-stone-400">
          The {quietSide === "white" ? "White" : "Black"} court stirs: {quiet}{" "}
          {quiet === 1 ? "request" : "requests"}.
        </p>
      )}
      {encounters.length > 0 && (
        <section aria-label="Piece requests" className="space-y-2 text-sm">
          {encounters.map((e) => (
            <article
              key={e.id}
              className="rounded border border-stone-600 bg-stone-900/50 px-4 py-3"
            >
              <p className="font-medium text-stone-200">
                {e.outcome ?? e.message}
              </p>
              {!e.outcome && (
                <>
                  <p className="mt-1 text-stone-300">{e.response}</p>
                  <p className="mt-1 text-xs text-stone-400">
                    {e.side === "white" ? "White" : "Black"}: {e.remainingTurns}{" "}
                    response {e.remainingTurns === 1 ? "turn" : "turns"}{" "}
                    remaining.
                  </p>
                </>
              )}
            </article>
          ))}
        </section>
      )}
    </>
  );
}
