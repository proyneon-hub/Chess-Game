import { encounterDiagnostics } from "./encounter-diagnostics";
import { encounterPressureChoice } from "./encounter-pressure-policy";
import { gzipSync } from "node:zlib";
import {
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve, relative } from "node:path";
import { performance } from "node:perf_hooks";
import { createGameState, getAllLegalMoves, submitMove } from "../lib/game";
import { publicState } from "../lib/game/publicState";
import { validateState } from "../lib/game/validation";
import { boardChoice, type BoardPolicy } from "./board-policies";
import { pressureChoice } from "./progression-policies";
import { seedRng, draw } from "../lib/rpg/rng";
import { applyMove, sameSquare, findKing } from "../lib/chess";
import { evaluateBoard } from "../lib/ai";
import { guardCount } from "../lib/rpg/conspiracy";
import { exchangeLoss, locations, distance } from "../lib/rpg/context";
import {
  responseMoves,
  isDependentOrder,
} from "../lib/rpg/encounters/objectives";
import { agencyForecast } from "../lib/rpg/agency";
import { CONFIG } from "../lib/rpg/config";
import type { MoveAttempt } from "../lib/game/types";
import type { Encounter } from "../lib/rpg/encounters/types";
const flags = Object.fromEntries(
  process.argv
    .slice(2)
    .reduce<string[][]>(
      (a, x, i, v) => (i % 2 === 0 ? [...a, [x, v[i + 1]]] : a),
      [],
    ),
);
const games = Number(flags["--games"] ?? 10),
  start = Number(flags["--seed-start"] ?? 300000),
  policy = flags["--policy"] ?? "aware",
  out = resolve(flags["--out"] ?? "docs/v5-encounters/smoke"),
  config = flags["--config"] ?? CONFIG.version;
if (
  !Number.isInteger(games) ||
  games < 2 ||
  games % 2 ||
  !Number.isInteger(start) ||
  start < 0 ||
  ![
    "aware",
    "pressure",
    "sustained-pressure",
    "board-ordinary",
    "board-protective",
    "board-mistreatment",
  ].includes(policy) ||
  relative(process.cwd(), out).startsWith("..") ||
  existsSync(out)
)
  throw Error("Invalid options or existing output.");
mkdirSync(out, { recursive: true });
const sources: Record<string, string> = {};
function captureSources(dir: string) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) captureSources(path);
    else if (/\.(ts|tsx)$/.test(path))
      sources[path.replaceAll("\\", "/")] = readFileSync(path, "utf8");
  }
}
for (const dir of ["lib", "hooks", "components", "scripts"])
  captureSources(dir);
const sourceHashes = Object.fromEntries(
  Object.entries(sources).map(([path, text]) => [
    path,
    createHash("sha256").update(text).digest("hex"),
  ]),
);
writeFileSync(join(out, "sources.json.gz"), gzipSync(JSON.stringify(sources)));
writeFileSync(
  join(out, "metadata.json"),
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      config,
      policy,
      games,
      start,
      sourceHashes,
      definitions: {
        normalStart: true,
        forcedDraws: false,
        pressure:
          "Own-private-politics stress versus board-only ordinary; never cooperative.",
        aware:
          "Public labels and requests only; no private objectives or thresholds.",
        intervals:
          "Raw completed-ply intervals, including checks and periods with no supported candidate.",
        distinctSeeds:
          "Paired colors share one seed; never count them as independent seeds.",
      },
    },
    null,
    2,
  ),
);
const quantile = (xs: number[], q: number) =>
  xs.length
    ? [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) * q)]
    : null;
const records: Record<string, unknown>[] = [],
  times: number[] = [];
let failures = 0;
function awareChoice(
  s: ReturnType<typeof publicState>,
  rng: ReturnType<typeof seedRng>,
): MoveAttempt {
  const requests = (s.encounters ?? []).filter(
    (e) => e.side === s.sideToMove && !e.outcome,
  );
  const ranked = getAllLegalMoves(s.board, s.sideToMove, s.rights).map((m) => {
    const b = applyMove(s.board, m.from, m.to, m.promotion, s.rights),
      safe = exchangeLoss(b, m.to, m.side) < 100;
    let response = 0;
    for (const e of requests)
      for (const p of e.participants) {
        if (sameSquare(p.square, m.from) && safe)
          response = Math.max(response, 75);
        else if (
          s.board[p.square[0]][p.square[1]] &&
          exchangeLoss(s.board, p.square, m.side) -
            exchangeLoss(b, p.square, m.side) >=
            100
        )
          response = Math.max(response, 75);
      }
    return {
      m,
      score:
        evaluateBoard(b) * (m.side === "white" ? 1 : -1) +
        response +
        draw(rng) * 50,
    };
  });
  return ranked.sort((a, b) => b.score - a.score)[0].m;
}
for (let i = 0; i < games; i++) {
  const seed = start + Math.floor(i / 2),
    pair = i % 2,
    actorA = seedRng(seed * 2 + 1),
    actorB = seedRng(seed * 2 + 2);
  let s = createGameState(seed, config),
    attempts = 0,
    opening = 0,
    invalid = 0,
    duplicate = 0,
    unsupported = 0;
  const diagnostics: Record<string, number> = {};
  const encountered = new Map<string, Encounter>(),
    firstSeen = new Map<string, number>(),
    resolved = new Map<string, number>(),
    effects = new Set<string>(),
    relevant = new Set<string>(),
    trace: unknown[] = [],
    phase: Record<string, { eligible: number; refusals: number }> = {};
  while (s.status === "active" && s.ply < 240 && attempts++ < 500) {
    const primary = (s.sideToMove === "white") === (pair === 0);
    const rng = primary ? actorA : actorB;
    const selected = primary
      ? policy
      : ["pressure", "sustained-pressure"].includes(policy)
        ? "board-ordinary"
        : policy;
    const move =
      selected === "sustained-pressure"
        ? encounterPressureChoice(s, rng)
        : selected === "pressure"
          ? pressureChoice(s, rng)
          : selected === "aware"
            ? awareChoice(publicState(s), rng)
            : boardChoice(s, rng, selected as BoardPolicy);
    if (!s.pendingRefusal)
      for (const [key, value] of Object.entries(encounterDiagnostics(s)))
        diagnostics[key] = (diagnostics[key] ?? 0) + value;
    if (s.simulation?.schemaVersion === 5)
      for (const e of s.simulation.encounters.active)
        if (
          e.family === "dispute" &&
          "pair" in e.objective &&
          isDependentOrder(s, move, e.objective.pair)
        )
          relevant.add(e.id);
    const before = s,
      forecast = agencyForecast(s, move),
      phaseKey = `${Math.min(5, Math.floor(s.ply / 16))}:${forecast.contributions.fear > 0.01 ? "risky" : "calm"}`;
    phase[phaseKey] ??= { eligible: 0, refusals: 0 };
    if (!forecast.guaranteed) phase[phaseKey].eligible++;
    const t = performance.now(),
      r = submitMove(s, move);
    times.push(performance.now() - t);
    if (!r.accepted) {
      invalid++;
      break;
    }
    if (r.resolution === "refused") phase[phaseKey].refusals++;
    s = r.state;
    try {
      validateState(s);
    } catch (err) {
      invalid++;
      writeFileSync(
        join(out, `invalid-${i}.json`),
        JSON.stringify({ error: String(err), state: s }, null, 2),
      );
      break;
    }
    if (
      before.ply < 8 &&
      (r.special ||
        r.resolution === "refused" ||
        (s.simulation?.schemaVersion === 5 &&
          s.simulation.encounters.active.length))
    )
      opening++;
    if (
      attempts % 31 === 0 &&
      JSON.stringify(submitMove(before, move)) !== JSON.stringify(r)
    )
      duplicate++;
    if (s.simulation?.schemaVersion !== 5) throw Error("v5 required");
    for (const e of [
      ...s.simulation.encounters.active,
      ...s.simulation.encounters.recent,
    ]) {
      if (!encountered.has(e.id)) {
        firstSeen.set(e.id, s.ply);
        if (
          !responseMoves(s, e.side, e.objective).length &&
          e.outcome === "active"
        )
          unsupported++;
      }
      if (e.outcome === "fulfilled" && e.effective && !resolved.has(e.id))
        resolved.set(e.id, s.ply);
      if (e.effective) effects.add(e.id);
      if (e.family === "dispute" && e.outcome === "fulfilled" && e.effective)
        relevant.add(e.id);
      encountered.set(e.id, structuredClone(e));
    }
    const events = s.events.filter((e) => e.seq > before.eventSeq);
    trace.push({
      ply: s.ply,
      revision: s.revision,
      move,
      resolution: r.resolution,
      events,
      plots: s.simulation.plots.map((p) => ({
        ...p,
        participantsSurviving: [p.ringleader, p.accomplice].map(
          (id) => s.simulation!.subjects[id].status === "active",
        ),
        kingDistance: locations(s)[p.ringleader]
          ? distance(
              locations(s)[p.ringleader],
              findKing(s.board, p.side === "white")!,
            )
          : null,
        guards: guardCount(s, p),
      })),
      active: s.simulation.encounters.active.map((e) => ({
        id: e.id,
        family: e.family,
        stage: e.stage,
        deadline: e.deadline,
      })),
    });
  }
  const all = [...encountered.values()],
    starts = [...firstSeen.values()],
    counters = s.simulation!.counters;
  const record = {
    seed,
    pair,
    plies: s.ply,
    terminal: s.terminal?.reason ?? "truncated",
    invalid,
    opening,
    duplicate,
    unsupported,
    firstOffer: Math.min(...starts),
    offersBy16: starts.filter((p) => p <= 16).length,
    resolvedBy24: [...resolved.values()].filter((p) => p <= 24).length,
    offersBy40: starts.filter((p) => p <= 40).length,
    offersBy64: starts.filter((p) => p <= 64).length,
    familiesBy64: [
      ...new Set(all.filter((e) => e.createdPly <= 64).map((e) => e.family)),
    ],
    supportive: all.some(
      (e) =>
        e.createdPly <= 64 && ["petition", "solidarity"].includes(e.family),
    ),
    conflict: all.some(
      (e) => e.createdPly <= 64 && ["dispute", "complaint"].includes(e.family),
    ),
    disputes: all.filter((e) => e.family === "dispute").length,
    relevantDisputes: relevant.size,
    mechanicallyEffective: effects.size,
    intervals: starts.slice(1).map((p, j) => p - starts[j]),
    counters,
    phase,
    diagnostics,
    encounters: all,
  };
  records.push(record);
  failures += invalid + opening + duplicate + unsupported;
  writeFileSync(
    join(out, `${seed}-${pair}.json.gz`),
    gzipSync(JSON.stringify({ record, trace })),
  );
  if (i % 10 === 9) console.log(`${i + 1}/${games}, failures ${failures}`);
}
const rows = records as any[];
const at = (n: number) => rows.filter((r) => r.plies >= n),
  rate = (rs: any[], f: (r: any) => boolean) =>
    rs.length ? rs.filter(f).length / rs.length : null;
const aggregate: Record<string, number> = {};
for (const r of rows)
  for (const [key, value] of Object.entries(r.counters))
    aggregate[key] = (aggregate[key] ?? 0) + Number(value);
const report = {
  measurementVersion: 4,
  actorStreams: "A=2*seed+1; B=2*seed+2; swap colors on pair 1",
  config,
  policy,
  games,
  seedStart: start,
  seedEnd: start + games / 2 - 1,
  pairedColors: true,
  cap: 240,
  failures,
  truncated: rows.filter((r) => r.terminal === "truncated").length,
  atRisk: Object.fromEntries([8, 16, 24, 40, 64].map((n) => [n, at(n).length])),
  discovery16: rate(at(16), (r) => r.offersBy16 > 0),
  resolved24: rate(at(24), (r) => r.resolvedBy24 > 0),
  medianFirstOffer: quantile(
    rows.map((r) => r.firstOffer).filter(Number.isFinite),
    0.5,
  ),
  medianOffers40: quantile(
    at(40).map((r) => r.offersBy40),
    0.5,
  ),
  medianOffers64: quantile(
    at(64).map((r) => r.offersBy64),
    0.5,
  ),
  threeFamilies64: rate(at(64), (r) => r.familiesBy64.length >= 3),
  supportive64: rate(at(64), (r) => r.supportive),
  conflict64: rate(at(64), (r) => r.conflict),
  medianInterval: quantile(
    rows.flatMap((r) => r.intervals),
    0.5,
  ),
  p90Interval: quantile(
    rows.flatMap((r) => r.intervals),
    0.9,
  ),
  refusalRate: (aggregate.refusal ?? 0) / aggregate.eligibleCommands,
  retreatRate: (aggregate.retreats ?? 0) / aggregate.eligibleCommands,
  retreatSeeds: [
    ...new Set(
      rows.filter((r) => (r.counters.retreats ?? 0) > 0).map((r) => r.seed),
    ),
  ],
  attemptSeeds: [
    ...new Set(
      rows
        .filter((r) => (r.counters.armedAttempts ?? 0) > 0)
        .map((r) => r.seed),
    ),
  ],
  regicideRate: (aggregate.regicides ?? 0) / games,
  disputeRelevance:
    rows.reduce((n, r) => n + r.relevantDisputes, 0) /
    Math.max(
      1,
      rows.reduce((n, r) => n + r.disputes, 0),
    ),
  resolverP95: quantile(times, 0.95),
  aggregate,
  records: rows.map(({ encounters, ...r }) => r),
};
writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    { ...report, aggregate: undefined, records: undefined },
    null,
    2,
  ),
);
if (failures) process.exitCode = 1;
