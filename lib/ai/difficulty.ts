import type { Difficulty } from "@/lib/game";

// Kept apart from the search so the page bundle does not load the engine.
/** Search budgets per difficulty. Budgets are soft; the watchdog is hard. */
export const DIFFICULTY: Record<
  Difficulty,
  { depth: number; budgetMs: number; watchdogMs: number; spreadCp?: number }
> = {
  easy: { depth: 1, budgetMs: 150, watchdogMs: 1500, spreadCp: 80 },
  normal: { depth: 2, budgetMs: 250, watchdogMs: 2000 },
  advanced: { depth: 4, budgetMs: 1000, watchdogMs: 4000 },
};
