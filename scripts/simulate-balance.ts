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
import { configFor } from "../lib/rpg/config";
import { pressureChoice } from "./progression-policies";
import { chooseAfterRefusal } from "../lib/ai/restraint";
import { progression, harmfulEpisodes } from "../lib/rpg/pressure";
import { assessOrder } from "../lib/rpg/facts";
import { agencyForecast } from "../lib/rpg/agency";
import { politicalDiagnostics } from "./political-diagnostics";
import { boardChoice, type BoardPolicy } from "./board-policies";
import { parseOptions } from "./sim/options";
import { buildReport, writeReport, type SimResult } from "./sim/report";
const options = parseOptions(process.argv, process.env),
  { version, suite, seedStart, games, traceSeed } = options;
const timingNodes: number[] = [],
  restraintCosts: number[] = [],
  leadershipTimes: number[] = [];
let privacyFailures = 0,
  terminalViolations = 0,
  duplicateMutations = 0;
const measuredMetrics = [
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
  "rivalFriction",
  "disputes",
  "disputeResolutions",
  "exposures",
  "harmEpisodes",
  "repeatedRisk",
  "neglect",
  "rescues",
  "protections",
  "envy",
  "ambient",
];
const policies = ["neutral", "protective", "coercive", "ambition"],
  cap = 240;
const aggregate: Record<string, number> = {},
  resolver: number[] = [],
  ai: number[] = [],
  sizes: number[] = [],
  payloads: number[] = [];
const breakdown: Record<string, Record<string, number>> = {};
const results: SimResult[] = [];
const start = performance.now();
let invalid = 0,
  stalls = 0,
  errors = 0,
  openingAnomalies = 0;
for (let index = 0; index < games; index++) {
  const pair = Math.floor(index / 2),
    seed = seedStart + pair,
    policy = suite.startsWith("board-")
      ? suite
      : suite === "pressure"
        ? "pressure"
        : policies[pair % 4],
    other = suite.startsWith("board-")
      ? "board-ordinary"
      : suite === "pressure"
        ? "tactical"
        : policies[(pair + 1) % 4];
  const white = index % 2 ? other : policy,
    black = index % 2 ? policy : other,
    tactical =
      !suite.startsWith("board-") && suite !== "pressure" && pair % 10 === 0,
    policyRng = seedRng(seed);
  let s = createGameState(seed, version),
    attempts = 0;
  let firstEventPly: number | null = null;
  const rareEvents: unknown[] = [];
  const replay =
    traceSeed === seed
      ? ([] as {
          command: unknown;
          resolution: unknown;
          ply: number;
          events: unknown[];
        }[])
      : undefined;
  const diagnostics: Record<string, number> = {},
    plotTransitions: unknown[] = [];
  const extrema = {
    maxTyranny: 10,
    minLegitimacy: 65,
    minCohesion: 65,
    minLoyalty: 65,
    maxFear: 10,
    maxResentment: 10,
  };
  const gates: Record<string, boolean> = {};
  const maxStorage = { episodes: 0, memories: 0, relationships: 0 };
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
      if (policy.startsWith("board-"))
        move = boardChoice(s, policyRng, policy as BoardPolicy);
      else if (policy === "pressure") move = pressureChoice(s, policyRng);
      else if (s.pendingRefusal && policy === "coercive")
        move = { ...s.pendingRefusal, side: s.sideToMove };
      else if (policy === "tactical") {
        const start = performance.now();
        // Bounded novice tactical opponent: material/PST plus destination safety
        // over eight seeded legal candidates. It captures threatened subjects
        // whenever a capture wins this sample; no victim exemption exists.
        const sample = Array.from(
          { length: Math.min(8, choices.length) },
          () => choices[Math.floor(draw(policyRng) * choices.length)],
        );
        move = sample
          .map((m) => {
            const board = applyMove(
              s.board,
              m.from,
              m.to,
              m.promotion,
              s.rights,
            );
            return {
              m,
              score:
                evaluateBoard(board) * (m.side === "white" ? 1 : -1) -
                exchangeLoss(board, m.to, m.side),
            };
          })
          .sort((a, b) => b.score - a.score)[0].m;
        timingNodes.push(sample.length);
        ai.push(performance.now() - start);
      } else if (tactical) {
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
        timingNodes.push(ranked.nodes);
        move =
          ranked.moves[
            policy === "tactical"
              ? 0
              : Math.floor(draw(policyRng) * Math.min(3, ranked.moves.length))
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
      if (
        s.pendingRefusal &&
        !policy.startsWith("board-") &&
        !["coercive", "pressure"].includes(policy)
      ) {
        if (s.schemaVersion >= 3) {
          const started = performance.now();
          const leadership = chooseAfterRefusal(s);
          leadershipTimes.push(performance.now() - started);
          if (leadership) {
            move = leadership.move;
            if (leadership.restraint)
              restraintCosts.push(leadership.tacticalCost);
            const metric = leadership.restraint ? "aiRestraint" : "aiCoercion";
            aggregate[metric] = (aggregate[metric] ?? 0) + 1;
          }
        } else
          move =
            choices.find(
              (m) =>
                m.from.join() !== s.pendingRefusal!.from.join() ||
                m.to.join() !== s.pendingRefusal!.to.join(),
            ) ?? move;
      }
      const commanded =
        s.simulation!.subjects[s.pieceIds[move.from[0]][move.from[1]]!];
      const cfg = configFor(version)!.progression;
      const calm =
        !!cfg &&
        s.ply >= 8 &&
        !s.pendingRefusal &&
        commanded.currentKind !== "k" &&
        commanded.fear <= 25 &&
        commanded.resentment <= 20 &&
        !commanded.grievance &&
        harmfulEpisodes(s, commanded.id, cfg.harmWindow).length === 0 &&
        assessOrder(s, move).residual < 100 &&
        !agencyForecast(s, move).guaranteed;
      const before = s,
        t = performance.now(),
        r = submitMove(s, move);
      resolver.push(performance.now() - t);
      if (!r.requestAccepted) {
        stalls++;
        break;
      }
      s = r.state;
      replay?.push({
        command: move,
        resolution: r.resolution,
        ply: s.ply,
        events: s.events.filter((e) => e.seq > before.eventSeq),
      });
      const diagnostic = politicalDiagnostics(before, move, r);
      for (const [key, n] of Object.entries(diagnostic.counts))
        diagnostics[key] = (diagnostics[key] ?? 0) + n;
      plotTransitions.push(...diagnostic.plots);
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
      if (
        before.pendingRefusal &&
        before.schemaVersion >= 3 &&
        !["coercive", "pressure"].includes(policy)
      ) {
        const same =
          move.from.join() === before.pendingRefusal.from.join() &&
          move.to.join() === before.pendingRefusal.to.join() &&
          (move.promotion ?? "q") === (before.pendingRefusal.promotion ?? "q");
        const key = same ? "aiCoercion" : "aiRestraint";
        counts[key] = (counts[key] ?? 0) + 1;
      }
      if (calm) {
        aggregate.calmCommands = (aggregate.calmCommands ?? 0) + 1;
        counts.calmCommands = (counts.calmCommands ?? 0) + 1;
        if (r.resolution === "refused") {
          aggregate.calmRefusals = (aggregate.calmRefusals ?? 0) + 1;
          counts.calmRefusals = (counts.calmRefusals ?? 0) + 1;
        }
      }
      for (const metric of new Set([
        ...measuredMetrics,
        ...Object.keys(s.simulation!.counters).filter(
          (k) =>
            k !== "attempts" &&
            !k.startsWith("eligible:") &&
            !k.startsWith("refused:"),
        ),
      ])) {
        const n =
          (s.simulation!.counters[metric] ?? 0) -
          (before.simulation!.counters[metric] ?? 0);
        if (n) counts[metric] = (counts[metric] ?? 0) + n;
      }
      if (
        firstEventPly === null &&
        (r.resolution === "refused" ||
          r.resolution === "autonomous" ||
          r.special)
      )
        firstEventPly = before.ply + 1;
      for (const kind of ["disputes", "plots"]) {
        if (
          s.schemaVersion >= 3 &&
          (s.simulation!.counters[kind] ?? 0) >
            (before.simulation!.counters[kind] ?? 0)
        ) {
          const ids = new Set(
            s.simulation!.plots.flatMap((p) => [p.ringleader, p.accomplice]),
          );
          for (const sub of Object.values(s.simulation!.subjects))
            if (sub.grievance) {
              ids.add(sub.id);
              ids.add(sub.grievance);
            }
          rareEvents.push({
            kind,
            ply: s.ply,
            revision: s.revision,
            command: move,
            kingdoms: structuredClone(s.simulation!.kingdoms),
            participants: [...ids].map((id) => ({
              subject: structuredClone(s.simulation!.subjects[id]),
              episodes: structuredClone(
                progression(s).subjects[id]?.episodes ?? [],
              ),
            })),
            plots: structuredClone(s.simulation!.plots),
          });
        }
      }
      if (r.turnConsumed) {
        for (const k of Object.values(s.simulation!.kingdoms)) {
          extrema.maxTyranny = Math.max(extrema.maxTyranny, k.tyranny);
          extrema.minLegitimacy = Math.min(extrema.minLegitimacy, k.legitimacy);
          extrema.minCohesion = Math.min(extrema.minCohesion, k.cohesion);
          if (k.tyranny >= (cfg?.plotTyranny ?? 40)) gates.tyranny = true;
          if (k.legitimacy <= (cfg?.plotLegitimacy ?? 50))
            gates.legitimacy = true;
        }
        for (const sub of Object.values(s.simulation!.subjects).filter(
          (x) => x.currentKind !== "k" && x.status === "active",
        )) {
          extrema.minLoyalty = Math.min(extrema.minLoyalty, sub.loyalty);
          extrema.maxFear = Math.max(extrema.maxFear, sub.fear);
          extrema.maxResentment = Math.max(
            extrema.maxResentment,
            sub.resentment,
          );
          if (sub.loyalty <= (cfg?.leaderLoyalty ?? 45))
            gates.leaderLoyalty = true;
          if (sub.resentment >= (cfg?.leaderResentment ?? 60))
            gates.leaderResentment = true;
          if (sub.ambition >= (cfg?.leaderAmbition ?? 60))
            gates.ambition = true;
          maxStorage.memories = Math.max(
            maxStorage.memories,
            sub.memories.length,
          );
          maxStorage.relationships = Math.max(
            maxStorage.relationships,
            Object.keys(sub.relationships).length,
          );
        }
        if (s.schemaVersion >= 3)
          for (const q of Object.values(progression(s).subjects))
            maxStorage.episodes = Math.max(
              maxStorage.episodes,
              q.episodes.length,
            );
      }
      if (
        s.terminal?.reason === "regicide" &&
        !s.simulation!.plots.some(
          (p) => p.stage === "resolved" && p.warningEventIds.length === 3,
        )
      )
        terminalViolations++;
      if (
        index % 20 === 0 &&
        attempts % 30 === 0 &&
        JSON.stringify(submitMove(before, move).state) !== JSON.stringify(s)
      )
        duplicateMutations++;
      if (
        before.ply < 8 &&
        (!["executed", "terminal"].includes(r.resolution ?? "") ||
          s.terminal?.reason === "regicide" ||
          r.special ||
          (s.schemaVersion >= 3 && (s.simulation!.counters.ambient ?? 0) > 0))
      )
        openingAnomalies++;
      try {
        validateState(s);
      } catch {
        invalid++;
        break;
      }
      if (
        /"(?:rngState|subjects|pieceIds|kingdoms|loyalty|personality|privateEvents|rpgState|progression|episodes|forecast|attackerIds|defenderIds)"/.test(
          JSON.stringify(publicState(s)),
        )
      ) {
        privacyFailures++;
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
    firstEventPly,
    extrema,
    gates,
    maxStorage,
    rareEvents,
    diagnostics,
    plotTransitions,
    ...(replay ? { replay } : {}),
  });
  if ((index + 1) % 50 === 0)
    console.log(
      `${index + 1}/${games} games; ${Math.round((performance.now() - start) / 1000)}s; invalid=${invalid}, stalls=${stalls}`,
    );
}
const failed = writeReport(
  options,
  buildReport(options, {
    cap,
    elapsedSeconds: (performance.now() - start) / 1000,
    results,
    aggregate,
    breakdown,
    resolver,
    ai,
    leadershipTimes,
    sizes,
    payloads,
    timingNodes,
    restraintCosts,
    invalid,
    stalls,
    errors,
    openingAnomalies,
    privacyFailures,
    terminalViolations,
    duplicateMutations,
  }),
);
if (failed) process.exitCode = 1;
