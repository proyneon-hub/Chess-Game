import type { Difficulty } from "@/lib/game";

// Kept apart from the search so the page bundle does not load the engine.
/**
 * Search budgets per difficulty. Budgets are soft; the watchdog is hard. The
 * search weighs every attack over the dice, so each ply costs more than in
 * a plain chess search.
 */
export const DIFFICULTY: Record<
  Difficulty,
  { depth: number; budgetMs: number; watchdogMs: number; spreadCp?: number }
> = {
  easy: { depth: 1, budgetMs: 150, watchdogMs: 1500, spreadCp: 80 },
  normal: { depth: 3, budgetMs: 400, watchdogMs: 2500 },
  advanced: { depth: 5, budgetMs: 1500, watchdogMs: 5000 },
};
