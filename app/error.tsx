"use client";
import { useEffect } from "react";
import { clearLocalGame } from "@/hooks/localSave";

// Shown if rendering throws. "Start over" also drops a saved local game, in
// case that is what fails to load.
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-5 text-center text-stone-200">
      <h1 className="text-2xl font-light uppercase tracking-widest text-amber-600">
        Something went wrong
      </h1>
      <p className="mt-4 text-sm text-stone-400">
        The board could not be shown. You can try again or start a new game.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          className="rounded border border-stone-600 px-4 py-2 text-sm hover:bg-stone-900"
          onClick={reset}
        >
          Try again
        </button>
        <button
          className="rounded border border-stone-600 px-4 py-2 text-sm hover:bg-stone-900"
          onClick={() => {
            clearLocalGame();
            // A full reload is the point: it discards the failed client state.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            location.assign("/");
          }}
        >
          Start over
        </button>
      </div>
    </main>
  );
}
