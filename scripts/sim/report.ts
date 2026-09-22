import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { configFor } from "../../lib/rpg/config";
import type { SimOptions } from "./options";

export type SimResult = {
  seed: number;
  pair: number;
  white: string;
  black: string;
  tactical: boolean;
  plies: number;
  terminal: string;
  winner: string | null;
  counters: Record<string, number>;
  firstEventPly: number | null;
  extrema: Record<string, number>;
  gates: Record<string, boolean>;
  maxStorage: Record<string, number>;
  rareEvents: unknown[];
  diagnostics: Record<string, number>;
  plotTransitions: unknown[];
  replay?: {
    command: unknown;
    resolution: unknown;
    ply: number;
    events: unknown[];
  }[];
};

/** Everything the game loop measured, ready to summarize. */
export type Measurements = {
  cap: number;
  elapsedSeconds: number;
  results: SimResult[];
  aggregate: Record<string, number>;
  breakdown: Record<string, Record<string, number>>;
  resolver: number[];
  ai: number[];
  leadershipTimes: number[];
  sizes: number[];
  payloads: number[];
  timingNodes: number[];
  restraintCosts: number[];
  invalid: number;
  stalls: number;
  errors: number;
  openingAnomalies: number;
  privacyFailures: number;
  terminalViolations: number;
  duplicateMutations: number;
};

export const stats = (v: number[]) => {
  const sorted = [...v].sort((a, b) => a - b);
  return {
    n: v.length,
    mean: v.reduce((a, b) => a + b, 0) / (v.length || 1),
    median: sorted[Math.floor(sorted.length * 0.5)] ?? 0,
    p90: sorted[Math.floor(sorted.length * 0.9)] ?? 0,
    p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
    p99: sorted[Math.floor(sorted.length * 0.99)] ?? 0,
  };
};

export function buildReport(
  { version, suite, seedStart, games }: SimOptions,
  m: Measurements,
) {
  const { results, aggregate } = m;
  const terminalCounts: Record<string, number> = {};
  for (const r of results)
    terminalCounts[r.terminal] = (terminalCounts[r.terminal] ?? 0) + 1;
  const w = results.filter((r) => r.winner === "white").length,
    b = results.filter((r) => r.winner === "black").length;
  const pairs = Array.from(
    { length: Math.floor(results.length / 2) },
    (_, i) =>
      results
        .slice(i * 2, i * 2 + 2)
        .reduce(
          (n, r) =>
            n + (r.winner === "white" ? 1 : r.winner === "black" ? -1 : 0),
          0,
        ) / 2,
  );
  const mean = pairs.reduce((a, b) => a + b, 0) / (pairs.length || 1),
    variance =
      pairs.reduce((n, x) => n + (x - mean) ** 2, 0) /
      Math.max(1, pairs.length - 1),
    error95 = 1.96 * Math.sqrt(variance / Math.max(1, pairs.length));
  return {
    configVersion: version,
    metricsVersion: 6,
    diagnosticVersion: 1,
    responsibilityRules: configFor(version)!.responsibility ?? null,
    gateThresholds: configFor(version)!.progression ?? null,
    suite,
    seedStart,
    policyNotes: suite.startsWith("board-")
      ? "Board-only policies: legal board, rights, public repetition/refusal and a separate policy RNG; no hidden politics or protected victims"
      : suite === "pressure"
        ? "Pressure policy v3 (material weight .5; repeat dangerous dependence on an actual sole defender) vs seeded eight-candidate one-ply material/PST/risk opponent; no forced RNG or protected victims"
        : "Original paired neutral/protective/coercive/promotion policies; deterministic depth-one top-three mix",
    games,
    cap: m.cap,
    elapsedSeconds: m.elapsedSeconds,
    tacticalGames: results.filter((r) => r.tactical).length,
    aggregate,
    breakdown: m.breakdown,
    terminalCounts,
    whiteWins: w,
    blackWins: b,
    colorDifference: {
      mean,
      approx95: [mean - error95, mean + error95],
      method: "paired normal approximation; draws/truncations contribute zero",
    },
    rates: {
      calmRefusal: [aggregate.calmRefusals ?? 0, aggregate.calmCommands ?? 0],
      refusal: [aggregate.refusal ?? 0, aggregate.eligibleCommands ?? 0],
      retreat: [aggregate.retreats ?? 0, aggregate.eligibleCommands ?? 0],
      plots: [aggregate.plots ?? 0, aggregate.eligibleKingdomTurns ?? 0],
      regicidePerMatch: [aggregate.regicides ?? 0, games],
      regicidePerAttempt: [
        aggregate.regicides ?? 0,
        aggregate.armedAttempts ?? 0,
      ],
    },
    resolverMs: stats(m.resolver),
    aiDecisionMs: stats(m.ai),
    leadershipProjectionMs: stats(m.leadershipTimes),
    finalStateBytes: stats(m.sizes),
    finalApiBytes: stats(m.payloads),
    invalid: m.invalid,
    stalls: m.stalls,
    errors: m.errors,
    openingAnomalies: m.openingAnomalies,
    privacyFailures: m.privacyFailures,
    terminalViolations: m.terminalViolations,
    duplicateMutations: m.duplicateMutations,
    discovery: {
      wholeCohort: [
        results.filter((r) => r.firstEventPly !== null).length,
        games,
      ],
      reached40: [
        results.filter((r) => r.plies >= 40 && r.firstEventPly !== null).length,
        results.filter((r) => r.plies >= 40).length,
      ],
      firstEventPly: stats(
        results.flatMap((r) =>
          r.firstEventPly === null ? [] : [r.firstEventPly],
        ),
      ),
      checkpoints: [20, 40, 60, 80].map((ply) => ({
        ply,
        observedByCheckpoint: results.filter(
          (r) => r.firstEventPly !== null && r.firstEventPly <= ply,
        ).length,
        wholeCohort: games,
        reachedCheckpoint: results.filter((r) => r.plies >= ply).length,
        endedEarlierWithoutEvent: results.filter(
          (r) => r.plies < ply && r.firstEventPly === null,
        ).length,
        truncated: results.filter((r) => r.terminal === "truncated").length,
      })),
    },
    naturalGates: Object.fromEntries(
      ["retreats", "disputeRelevantCommands", "armedAttempts"].map((key) => [
        key,
        {
          seeds: [
            ...new Set(
              results
                .filter((r) => (r.diagnostics[key] ?? 0) > 0)
                .map((r) => r.seed),
            ),
          ],
          requiredDistinctSeeds: 2,
        },
      ]),
    ),
    diagnostics: results.reduce(
      (acc, r) => {
        for (const [key, n] of Object.entries(r.diagnostics))
          acc[key] = (acc[key] ?? 0) + n;
        return acc;
      },
      {} as Record<string, number>,
    ),
    pressureGates: {
      gamesWithDisputes: [
        results.filter((r) => (r.counters.disputes ?? 0) > 0).length,
        games,
      ],
      gamesWithEligibility: [
        results.filter((r) => (r.counters.eligibleKingdomTurns ?? 0) > 0)
          .length,
        games,
      ],
      gamesWithPlots: [
        results.filter((r) => (r.counters.plots ?? 0) > 0).length,
        games,
      ],
      distinctDisputeSeeds: new Set(
        results
          .filter((r) => (r.counters.disputes ?? 0) > 0)
          .map((r) => r.seed),
      ).size,
      distinctPlotSeeds: new Set(
        results.filter((r) => (r.counters.plots ?? 0) > 0).map((r) => r.seed),
      ).size,
    },
    nodes: stats(m.timingNodes),
    restraintTacticalCost: stats(m.restraintCosts),
    gateCrossings: Object.fromEntries(
      [
        "tyranny",
        "legitimacy",
        "leaderLoyalty",
        "leaderResentment",
        "ambition",
      ].map((g) => [g, [results.filter((r) => r.gates[g]).length, games]]),
    ),
    results,
  };
}

/**
 * Writes raw.json, summary.json and report.md (never overwriting), logs a
 * one-line summary, and returns whether any invariant failed.
 */
export function writeReport(
  options: SimOptions,
  report: ReturnType<typeof buildReport>,
) {
  const { output, version, suite, seedStart, games } = options;
  mkdirSync(output, { recursive: true });
  writeFileSync(join(output, "raw.json"), JSON.stringify(report) + "\n", {
    flag: "wx",
  });
  const summary = {
    ...report,
    results: undefined,
    breakdown: undefined,
    aggregate: Object.fromEntries(
      Object.entries(report.aggregate).filter(
        ([k]) =>
          !k.startsWith("policyPair:") &&
          !k.startsWith("eligible:") &&
          !k.startsWith("refused:"),
      ),
    ),
  };
  writeFileSync(
    join(output, "summary.json"),
    JSON.stringify(summary, null, 2) + "\n",
    { flag: "wx" },
  );
  writeFileSync(
    join(output, "report.md"),
    `# ${version}: ${suite}\n\nSeed start ${seedStart}; ${games} games (${games / 2} color-swapped pairs), 240-ply cap. This is simulation evidence, not human playtesting.\n\nRefusals: ${report.rates.refusal.join(" / ")}. Discovery among games reaching ply 40: ${report.discovery.reached40.join(" / ")}. Court-eligible games: ${report.pressureGates.gamesWithEligibility.join(" / ")}.\n\nSee [summary](summary.json) for denominators/blockers and [raw](raw.json) for every game, extrema and policy/side/personality/phase breakdown. No historical output was overwritten.\n`,
    { flag: "wx" },
  );
  const failures = {
    invalid: report.invalid,
    stalls: report.stalls,
    errors: report.errors,
    openingAnomalies: report.openingAnomalies,
    privacyFailures: report.privacyFailures,
    terminalViolations: report.terminalViolations,
    duplicateMutations: report.duplicateMutations,
  };
  console.log(
    JSON.stringify({
      output,
      config: version,
      refusal: report.rates.refusal,
      discovery: report.discovery.reached40,
      pressure: report.pressureGates,
      resolver: report.resolverMs,
      ...failures,
    }),
  );
  return Object.values(failures).some(Boolean);
}
