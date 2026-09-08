import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { applyMove } from "../lib/chess";
import { createGameState, getAllLegalMoves, submitMove } from "../lib/game";
import { publicState } from "../lib/game/publicState";
import { validateState } from "../lib/game/validation";
import { seedRng, draw } from "../lib/rpg/rng";
import { evaluateBoard } from "../lib/ai";
import { searchMoves } from "../lib/ai/search";
import { ownPolitics } from "../lib/ai/politicalEvaluation";
import { exchangeLoss } from "../lib/rpg/context";
import { V2_CONFIG as CONFIG } from "../lib/rpg/config";
const policies = ["neutral", "protective", "coercive", "ambition"],
  games = Number(process.env.SIM_GAMES ?? 1000),
  cap = 240;
const aggregate: Record<string, number> = {},
  resolver: number[] = [],
  ai: number[] = [],
  sizes: number[] = [],
  payloads: number[] = [];
const breakdown: Record<string, Record<string, number>> = {};
const results: {
  seed: number;
  pair: number;
  white: string;
  black: string;
  tactical: boolean;
  plies: number;
  terminal: string;
  winner: string | null;
  counters: Record<string, number>;
}[] = [];
if (existsSync("docs/progression/baseline-post-refactor"))
  throw Error("Refusing to replace historical evidence.");
const start = performance.now();
let invalid = 0,
  stalls = 0,
  errors = 0,
  openingAnomalies = 0;
for (let index = 0; index < games; index++) {
  const pair = Math.floor(index / 2),
    seed = 10000 + pair,
    policy = policies[pair % 4],
    other = policies[(pair + 1) % 4];
  const white = index % 2 ? other : policy,
    black = index % 2 ? policy : other,
    tactical = pair % 10 === 0,
    policyRng = seedRng(seed);
  let s = createGameState(seed, "2026-09-07.3"),
    attempts = 0;
  try {
    while (s.status === "active" && s.ply < cap) {
      if (attempts++ > cap * 2 + 1) {
        stalls++;
        break;
      }
      const choices = getAllLegalMoves(s.board, s.sideToMove, s.rights);
      if (!choices.length) {
        stalls++;
        break;
      }
      const policy = s.sideToMove === "white" ? white : black;
      let move = choices[Math.floor(draw(policyRng) * choices.length)];
      if (s.pendingRefusal && policy === "coercive")
        move = { ...s.pendingRefusal, side: s.sideToMove };
      else if (tactical) {
        const t = performance.now();
        const ranked = searchMoves({
          board: s.board,
          rights: s.rights,
          side: s.sideToMove,
          depth: 1,
          budgetMs: 60000,
          maxNodes: 4096,
          own: ownPolitics(s, s.sideToMove),
        });
        ai.push(performance.now() - t);
        move =
          ranked.moves[
            Math.floor(draw(policyRng) * Math.min(3, ranked.moves.length))
          ];
      } else if (policy !== "neutral") {
        const sample = Array.from(
          { length: Math.min(8, choices.length) },
          () => choices[Math.floor(draw(policyRng) * choices.length)],
        );
        move = sample
          .map((m) => {
            const next = applyMove(
                s.board,
                m.from,
                m.to,
                m.promotion,
                s.rights,
              ),
              sub = s.simulation!.subjects[s.pieceIds[m.from[0]][m.from[1]]!];
            let score =
              evaluateBoard(next) * (s.sideToMove === "white" ? 1 : -1);
            if (policy === "protective")
              score -= exchangeLoss(next, m.to, m.side);
            if (policy === "ambition")
              score +=
                Number(sub.currentKind === "p") * 60 +
                Number(!!m.promotion) * 150;
            if (policy === "coercive")
              score +=
                Number(
                  sub.lastMovedOwnTurn ===
                    s.simulation!.kingdoms[m.side].ownTurnsCompleted,
                ) * 50;
            return { m, score };
          })
          .sort((a, b) => b.score - a.score)[0].m;
      }
      if (s.pendingRefusal && policy !== "coercive")
        move =
          choices.find(
            (m) =>
              m.from.join() !== s.pendingRefusal!.from.join() ||
              m.to.join() !== s.pendingRefusal!.to.join(),
          ) ?? move;
      const before = s,
        t = performance.now(),
        r = submitMove(s, move);
      resolver.push(performance.now() - t);
      if (!r.requestAccepted) {
        stalls++;
        break;
      }
      s = r.state;
      const subject =
        before.simulation!.subjects[
          before.pieceIds[move.from[0]][move.from[1]]!
        ];
      const phase =
        before.ply < 8
          ? "opening"
          : before.ply < 16
            ? "discovery"
            : before.ply < 40
              ? "established"
              : "crisis";
      const group = `${policy}/${move.side}/${subject.personality}/${phase}`;
      const counts = breakdown[group] ?? (breakdown[group] = {});
      counts.attempts = (counts.attempts ?? 0) + 1;
      counts[r.resolution!] = (counts[r.resolution!] ?? 0) + 1;
      for (const metric of [
        "eligibleCommands",
        "refusal",
        "repeats",
        "alternativeOrders",
        "retreats",
        "extensions",
        "eligibleKingdomTurns",
        "plots",
        "plotWarning",
        "plotThwarted",
        "plotFailed",
        "armedAttempts",
        "regicides",
        "rivalGrievances",
      ]) {
        const n =
          (s.simulation!.counters[metric] ?? 0) -
          (before.simulation!.counters[metric] ?? 0);
        if (n) counts[metric] = (counts[metric] ?? 0) + n;
      }
      if (before.ply < 8 && (r.resolution !== "executed" || r.special))
        openingAnomalies++;
      try {
        validateState(s);
      } catch {
        invalid++;
        break;
      }
      if (
        /"(?:rngState|subjects|pieceIds|kingdoms|loyalty|personality|privateEvents|rpgState)"/.test(
          JSON.stringify(publicState(s)),
        )
      ) {
        invalid++;
        break;
      }
    }
  } catch (e) {
    errors++;
    console.error(
      `Simulation ${index}:`,
      e instanceof Error ? e.message : String(e),
    );
  }
  for (const [key, n] of Object.entries(s.simulation!.counters)) {
    aggregate[key] = (aggregate[key] ?? 0) + n;
    const grouped = `policyPair:${white}/${black}:${key}`;
    aggregate[grouped] = (aggregate[grouped] ?? 0) + n;
  }
  sizes.push(Buffer.byteLength(JSON.stringify(s)));
  payloads.push(
    Buffer.byteLength(
      JSON.stringify({
        id: "00000000-0000-4000-8000-000000000000",
        version: s.revision + 1,
        playerSide: "white",
        waitingForOpponent: false,
        state: publicState(s),
      }),
    ),
  );
  results.push({
    seed,
    pair,
    white,
    black,
    tactical,
    plies: s.ply,
    terminal: s.terminal?.reason ?? "truncated",
    winner: s.terminal?.winner ?? null,
    counters: s.simulation!.counters,
  });
  if ((index + 1) % 50 === 0)
    console.log(
      `${index + 1}/${games} games; ${Math.round((performance.now() - start) / 1000)}s; invalid=${invalid}, stalls=${stalls}`,
    );
}
const stats = (v: number[]) => {
  const sorted = [...v].sort((a, b) => a - b);
  return {
    n: v.length,
    mean: v.reduce((a, b) => a + b, 0) / (v.length || 1),
    p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
  };
};
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
const report = {
  configVersion: CONFIG.version,
  games,
  cap,
  elapsedSeconds: (performance.now() - start) / 1000,
  tacticalGames: results.filter((r) => r.tactical).length,
  aggregate,
  breakdown,
  terminalCounts,
  whiteWins: w,
  blackWins: b,
  colorDifference: {
    mean,
    approx95: [mean - error95, mean + error95],
    method: "paired normal approximation; draws/truncations contribute zero",
  },
  rates: {
    refusal: [aggregate.refusal ?? 0, aggregate.eligibleCommands ?? 0],
    retreat: [aggregate.retreats ?? 0, aggregate.eligibleCommands ?? 0],
    plots: [aggregate.plots ?? 0, aggregate.eligibleKingdomTurns ?? 0],
    regicidePerMatch: [aggregate.regicides ?? 0, games],
    regicidePerAttempt: [
      aggregate.regicides ?? 0,
      aggregate.armedAttempts ?? 0,
    ],
  },
  resolverMs: stats(resolver),
  aiDecisionMs: stats(ai),
  finalStateBytes: stats(sizes),
  finalApiBytes: stats(payloads),
  invalid,
  stalls,
  errors,
  openingAnomalies,
  results,
};
mkdirSync("docs/progression/baseline-post-refactor", { recursive: true });
writeFileSync(
  "docs/progression/baseline-post-refactor/seeded-games.json",
  JSON.stringify(report, null, 2) + "\n",
);
const rate = (n: number, d: number) =>
  d
    ? `${n}/${d} (${((100 * n) / d).toFixed(3)}%)`
    : `${n}/0 (no eligible observations)`;
const lines = [
  "# Hidden Kingdom balance measurement",
  "",
  `Config ${CONFIG.version}; ${games} seeded games, ${pairs.length} color-swapped pairs; ${cap}-ply harness cap. ${report.tacticalGames} games use depth-one tactical search; other policies sample legal commands with material/protection/promotion preferences. Truncations are not gameplay draws.`,
  "",
  "| Measurement | Result |",
  "|---|---|",
];
for (const [key, [n, d]] of Object.entries(report.rates))
  lines.push(`| ${key}: numerator / eligible denominator | ${rate(n, d)} |`);
lines.push(
  `| Repeats / alternatives / extensions | ${aggregate.repeats ?? 0} / ${aggregate.alternativeOrders ?? 0} / ${aggregate.extensions ?? 0} |`,
  `| Opening anomalies / invalid / stalls / errors | ${openingAnomalies} / ${invalid} / ${stalls} / ${errors} |`,
);
for (const [key, value] of Object.entries({
  resolverMs: report.resolverMs,
  aiDecisionMs: report.aiDecisionMs,
  finalStateBytes: report.finalStateBytes,
  finalApiBytes: report.finalApiBytes,
}))
  lines.push(
    `| ${key}: mean / p95 | ${value.mean.toFixed(3)} / ${value.p95.toFixed(3)} |`,
  );
lines.push(
  "",
  `Terminal distribution: ${JSON.stringify(terminalCounts)}. White wins ${w}, Black wins ${b}; mean paired color difference ${mean.toFixed(4)}, approximate 95% interval [${report.colorDifference.approx95.map((x) => x.toFixed(4)).join(", ")}]. This policy sample does not establish fairness or human chess quality.`,
  "",
  "Raw counts by personality, side, phase, policy pairing and match: [seeded-games.json](balance/seeded-games.json). Payload samples are final states with full public history. The harness measures depth-one AI; difficulty budgets are measured separately.",
  "",
  "Tuning .2 changes only the refusal baseline from .005 to .04 after the original 1000-game run produced zero refusals across 95,932 eligible commands. Original .1 rules and results remain available. Conspiracy probabilities and prerequisites were not raised. Constructed court tests demonstrate staged reachability, failure and counterplay. A zero plot denominator means ordinary policies did not generate eligible kingdoms, not that self-play tested regicide.",
  "Configuration .3 adds a bounded -10 grievance only when a repeated losing order relies solely on an envied defender; this closes the otherwise unreachable -30 dispute threshold. See [rule decisions](hidden-kingdom-rules.md). Breakdown keys are leadership policy / commanded side / commanded personality / phase. Independent [AI timings](balance/ai-performance.json) and [browser worker observations](balance/browser-ai.json) measure difficulty budgets separately.",
  "",
  "Reproduce: `npm run simulate` on Node 22.13+ or 24. Optional SIM_GAMES is for shorter diagnostics; delivery uses 1000.",
  `Elapsed ${report.elapsedSeconds.toFixed(1)} seconds.`,
);
writeFileSync(
  "docs/progression/baseline-post-refactor/report.md",
  lines.join("\n") + "\n",
);
if (invalid || stalls || errors || openingAnomalies) process.exitCode = 1;
