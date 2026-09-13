"use client";
import { useEffect, useRef, useState } from "react";
import type { PublicGame } from "@/lib/game/publicState";
export function EncounterArea({
  encounters,
}: {
  encounters: NonNullable<PublicGame["encounters"]>;
}) {
  const seen = useRef(new Set<string>()),
    [announcement, setAnnouncement] = useState("");
  useEffect(() => {
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
