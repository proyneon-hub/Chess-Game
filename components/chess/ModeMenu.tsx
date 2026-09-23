import type { Difficulty } from "@/lib/game";
import { button } from "@/components/chess/styles";

/** The opening screen: choose local, computer or online play. */
export function ModeMenu({
  difficulty,
  message,
  onDifficulty,
  onStart,
  onOnline,
}: {
  difficulty: Difficulty;
  message: string;
  onDifficulty: (difficulty: Difficulty) => void;
  onStart: (mode: "local" | "computer") => void;
  onOnline: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-5 text-center">
      <h1 className="text-4xl font-light uppercase tracking-[.35em] text-amber-600">
        Chess
      </h1>
      <p className="mt-5 text-sm text-stone-400">
        Choose your opponent and start a game.
      </p>
      <div className="mt-8 grid w-full gap-3">
        <button
          className={button + " py-4 text-left"}
          onClick={() => onStart("local")}
        >
          Play here
          <span className="block text-xs text-stone-400">
            Two players on one board
          </span>
        </button>
        <div className="rounded border border-stone-600">
          <button
            className="w-full px-4 py-4 text-left text-stone-200"
            onClick={() => onStart("computer")}
          >
            Play computer
            <span className="block text-xs text-stone-400">You play White</span>
          </button>
          <label className="flex items-center gap-3 border-t border-stone-700 px-4 py-2 text-xs text-stone-300">
            Difficulty
            <select
              aria-label="Difficulty"
              value={difficulty}
              onChange={(e) => onDifficulty(e.target.value as Difficulty)}
              className="rounded bg-stone-900 p-2"
            >
              <option value="normal">Normal</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
        </div>
        <button className={button + " py-4 text-left"} onClick={onOnline}>
          Play online
          <span className="block text-xs text-stone-400">
            Create a private invite game
          </span>
        </button>
      </div>
      <p role="status" className="mt-5 text-sm text-stone-300">
        {message}
      </p>
    </div>
  );
}
