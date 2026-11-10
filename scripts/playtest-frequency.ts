// Frequency playtest: the same games as scripts/playtest.ts (same seeds, same
// player styles, same computer opponent), but recorded ply by ply so the
// output says *when* and *how often* the hidden politics reach the player,
// not only how much of a game they cover. Prints one JSON summary per style;
// writes nothing.
//
//   npx tsx scripts/playtest-frequency.ts --style aware --difficulty normal --games 200
import { createGameState, getAllLegalMoves, submitMove } from "../lib/game";
import { publicState } from "../lib/game/publicState";
import { computerChoice } from "../lib/ai/computerChoice";
import { DIFFICULTY } from "../lib/ai/difficulty";
import { refusalFallback } from "../lib/ai/restraint";
import { ownPolitics } from "../lib/ai/politicalEvaluation";
import { DEFAULT_CONFIG } from "../lib/rpg/config";
import { hasEncounters } from "../lib/rpg/capabilities";
import { encounterPhase } from "../lib/rpg/encounters/state";
import { presence, type Channel } from "../lib/rpg/presence";
import { seedRng, draw, type RngState } from "../lib/rpg/rng";
import type { Difficulty } from "../lib/game";
import type { GameState, MoveAttempt, Side } from "../lib/game/types";
import { awareChoice, boardChoice } from "./board-policies";

const STYLES = ["aware", "engine", "reckless"] as const;
type Style = (typeof STYLES)[number];
const CHANNELS: readonly Channel[] = [
  "card",
  "warning",
  "hesitation",
  "unexpected",
  "line",
  "ambient",
];
// "Something new happened" as opposed to "a card or warning is still showing".
const EVENT_CHANNELS: readonly Channel[] = ["hesitation", "unexpected", "line"];
const PHASES = ["1-8", "9-16", "17-32", "33-48", "49-64", "65+"];

const flags: Record<string, string> = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i],
    value = process.argv[i + 1];
  if (
    !["--style", "--games", "--seed-start", "--difficulty"].includes(key) ||
    value === undefined
  )
    throw Error("Invalid option: " + key);
  flags[key] = value;
}
const styles = (flags["--style"] ?? STYLES.join(",")).split(",") as Style[],
  games = Number(flags["--games"] ?? 30),
  seedStart = Number(flags["--seed-start"] ?? 7000),
  difficulty = (flags["--difficulty"] ?? "normal") as Difficulty,
  cap = 200;
if (
  styles.some((s) => !STYLES.includes(s)) ||
  !Number.isSafeInteger(games) ||
  games < 1 ||
  !Number.isSafeInteger(seedStart) ||
  !(difficulty in DIFFICULTY)
)
  throw Error("Invalid style, games, seed or difficulty.");

/** The computer's move exactly as useComputerTurn asks the worker for it. */
function computerMove(
  s: GameState,
  aiRng: RngState,
  level = difficulty,
): MoveAttempt {
  const { depth, budgetMs, spreadCp } = DIFFICULTY[level];
  const result = computerChoice(
    {
      board: s.board,
      rights: s.rights,
      side: s.sideToMove,
      depth,
      budgetMs,
      own: ownPolitics(s, s.sideToMove),
      positions: s.positions,
      spreadCp,
    },
    () => draw(aiRng),
  );
  const move = result.moves[0] ?? refusalFallback(s)!;
  return { ...move, side: s.sideToMove };
}

function playerMove(s: GameState, style: Style, rng: RngState): MoveAttempt {
  // After a hesitation, a person repeats the order about half the time.
  if (s.pendingRefusal && draw(rng) < 0.5)
    return { ...s.pendingRefusal, side: s.sideToMove };
  if (style === "engine") return computerMove(s, rng, "normal");
  if (style === "reckless") return boardChoice(s, rng, "board-mistreatment");
  return awareChoice(publicState(s), rng);
}

type GameRecord = {
  plies: number;
  terminal: string;
  winner: string | null;
  /** Channels present after each completed ply; index 0 is ply 1. */
  perPly: Set<Channel>[];
  /** Presence as the player sees it when it is their turn (after Black moved). */
  whiteTurns: number;
  presentWhiteTurn: number;
  orders: { white: number; black: number };
  hesitations: { white: number; black: number };
  hesitationPlies: { white: number[]; black: number[] };
  /** Ply on which each request card first appeared, by side. */
  requestPlies: { white: number[]; black: number[] };
  families: Record<string, number>;
  warnings: number;
  plots: number;
  counters: Record<string, number>;
};

function play(seed: number, style: Style): GameRecord {
  const rng = seedRng(seed * 7 + 3),
    aiRng = seedRng(seed * 13 + 5);
  let s = createGameState(seed, DEFAULT_CONFIG.version);
  const seen = new Set<string>(),
    started = new Set<string>(),
    families: Record<string, number> = {};
  let lastWarning = "";
  const record: GameRecord = {
    plies: 0,
    terminal: "",
    winner: null,
    perPly: [],
    whiteTurns: 0,
    presentWhiteTurn: 0,
    orders: { white: 0, black: 0 },
    hesitations: { white: 0, black: 0 },
    hesitationPlies: { white: [], black: [] },
    requestPlies: { white: [], black: [] },
    families,
    warnings: 0,
    plots: 0,
    counters: {},
  };
  // A refusal does not advance the ply, so several submitMove calls can
  // belong to one ply; channels accumulate until the ply completes.
  let pending = new Set<Channel>(),
    flushedPly = 0,
    pendingMover: Side = "white";
  const flush = (finalPly: number) => {
    if (finalPly <= flushedPly) return;
    record.plies = finalPly;
    record.perPly.push(pending);
    if (pendingMover === "black") {
      record.whiteTurns++;
      if (pending.size) record.presentWhiteTurn++;
    }
    pending = new Set();
    flushedPly = finalPly;
  };
  for (
    let guard = 0;
    s.status === "active" && s.ply < cap && guard < 600;
    guard++
  ) {
    const side = s.sideToMove;
    const before = s;
    let r = submitMove(
      s,
      side === "white" ? playerMove(s, style, rng) : computerMove(s, aiRng),
    );
    if (!r.requestAccepted) {
      const fallback =
        refusalFallback(s) ?? getAllLegalMoves(s.board, side, s.rights)[0];
      if (!fallback) break;
      r = submitMove(s, fallback);
      if (!r.requestAccepted) break;
    }
    s = r.state;
    for (const c of presence(before, s).channels) pending.add(c);
    pendingMover = side;
    record.orders[side]++;
    if (r.resolution === "refused") {
      record.hesitations[side]++;
      record.hesitationPlies[side].push(before.ply + 1);
    }
    for (const e of publicState(s).encounters ?? [])
      if (!seen.has(e.id)) {
        seen.add(e.id);
        record.requestPlies[e.side].push(Math.max(s.ply, 1));
      }
    if (hasEncounters(s.simulation))
      for (const e of s.simulation.encounters.active)
        if (!started.has(e.id)) {
          started.add(e.id);
          families[e.family] = (families[e.family] ?? 0) + 1;
        }
    const warning = s.warning?.message ?? "";
    if (warning && warning !== lastWarning) record.warnings++;
    lastWarning = warning;
    flush(s.ply);
  }
  flush(s.ply);
  record.terminal = s.terminal?.reason ?? (s.ply >= cap ? "cap" : "unfinished");
  record.winner = s.terminal?.winner ?? null;
  record.plots = s.simulation?.plots.length ?? 0;
  record.counters = { ...s.simulation?.counters };
  return record;
}

const quantile = (xs: number[], q: number) => {
  if (!xs.length) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};
const spread = (xs: number[]) => ({
  n: xs.length,
  min: quantile(xs, 0),
  p10: quantile(xs, 0.1),
  median: quantile(xs, 0.5),
  p90: quantile(xs, 0.9),
  max: quantile(xs, 1),
});
const round = (n: number, d = 3) => Number(n.toFixed(d));
const ratio = (n: number, d: number) => (d ? round(n / d) : null);
const isEvent = (c: Set<Channel>) => EVENT_CHANNELS.some((e) => c.has(e));

/** Lengths of the runs of plies for which `hit` is false. */
function quietRuns(perPly: Set<Channel>[], hit: (c: Set<Channel>) => boolean) {
  const runs: number[] = [];
  let run = 0;
  for (const c of perPly)
    if (hit(c)) {
      if (run) runs.push(run);
      run = 0;
    } else run++;
  if (run) runs.push(run);
  return runs;
}
/** 1-based ply of the first ply for which `hit` is true, or null. */
const firstPly = (perPly: Set<Channel>[], hit: (c: Set<Channel>) => boolean) =>
  perPly.findIndex(hit) + 1 || null;
const present = (xs: (number | null)[]) =>
  xs.filter((x): x is number => x !== null);

for (const style of styles) {
  const records = Array.from({ length: games }, (_, i) =>
    play(seedStart + i, style),
  );
  const sum = (f: (r: GameRecord) => number) =>
    records.reduce((n, r) => n + f(r), 0);
  const share = (f: (r: GameRecord) => boolean) =>
    round(records.filter(f).length / games);
  const plies = sum((r) => r.plies);
  const pliesWith = (hit: (c: Set<Channel>) => boolean) =>
    sum((r) => r.perPly.filter(hit).length);
  const counter = (key: string) => sum((r) => r.counters[key] ?? 0);
  const gaps = (xs: number[]) => xs.slice(1).map((x, i) => x - xs[i]);
  const eventPlies = (r: GameRecord) =>
    r.perPly.flatMap((c, i) => (isEvent(c) ? [i + 1] : []));

  const phases = PHASES.map((label, phase) => {
    let n = 0,
      any = 0,
      event = 0;
    const byChannel = Object.fromEntries(CHANNELS.map((c) => [c, 0]));
    for (const r of records)
      r.perPly.forEach((c, i) => {
        if (encounterPhase(i + 1) !== phase) return;
        n++;
        if (c.size) any++;
        if (isEvent(c)) event++;
        for (const ch of c) byChannel[ch]++;
      });
    return {
      plies: label,
      gamesReaching: records.filter(
        (r) => r.plies >= [1, 9, 17, 33, 49, 65][phase],
      ).length,
      pliesPlayed: n,
      presence: ratio(any, n),
      eventPlies: ratio(event, n),
      channels: Object.fromEntries(
        CHANNELS.map((c) => [c, ratio(byChannel[c], n)]),
      ),
    };
  });

  console.log(
    JSON.stringify({
      config: DEFAULT_CONFIG.version,
      style,
      difficulty,
      games,
      seedStart,
      cap,
      result: {
        white: records.filter((r) => r.winner === "white").length,
        draw: records.filter((r) => !r.winner).length,
        black: records.filter((r) => r.winner === "black").length,
      },
      endings: records.reduce<Record<string, number>>(
        (n, r) => ((n[r.terminal] = (n[r.terminal] ?? 0) + 1), n),
        {},
      ),
      plies: { total: plies, perGame: spread(records.map((r) => r.plies)) },
      // Share of all plies after which each thing is on screen.
      plyShare: {
        presence: ratio(
          pliesWith((c) => c.size > 0),
          plies,
        ),
        presenceWithoutAmbient: ratio(
          pliesWith((c) => [...c].some((x) => x !== "ambient")),
          plies,
        ),
        presenceOnPlayerTurn: ratio(
          sum((r) => r.presentWhiteTurn),
          sum((r) => r.whiteTurns),
        ),
        eventPlies: ratio(pliesWith(isEvent), plies),
        ...Object.fromEntries(
          CHANNELS.map((c) => [
            c,
            ratio(
              pliesWith((x) => x.has(c)),
              plies,
            ),
          ]),
        ),
      },
      perGamePresence: spread(
        records.map((r) =>
          round(r.perPly.filter((c) => c.size).length / Math.max(1, r.plies)),
        ),
      ),
      // Mean count per game.
      perGame: {
        eventPlies: ratio(pliesWith(isEvent), games),
        hesitationsWhite: ratio(
          sum((r) => r.hesitations.white),
          games,
        ),
        hesitationsBlack: ratio(
          sum((r) => r.hesitations.black),
          games,
        ),
        requestsWhite: ratio(
          sum((r) => r.requestPlies.white.length),
          games,
        ),
        requestsBlack: ratio(
          sum((r) => r.requestPlies.black.length),
          games,
        ),
        requestsFulfilled: ratio(counter("encounter:fulfilled"), games),
        requestsExpired: ratio(counter("encounter:expired"), games),
        shakenWarnings: ratio(counter("shakenWarnings"), games),
        withdrawals: ratio(counter("retreats"), games),
        overruns: ratio(counter("extensions"), games),
        warnings: ratio(
          sum((r) => r.warnings),
          games,
        ),
        ambientLines: ratio(
          pliesWith((c) => c.has("ambient")),
          games,
        ),
        plots: ratio(
          sum((r) => r.plots),
          games,
        ),
      },
      // Share of games in which the thing happens at least once.
      gamesWith: {
        anyPresence: share((r) => r.perPly.some((c) => c.size > 0)),
        requestCard: share((r) => r.perPly.some((c) => c.has("card"))),
        playerRequest: share((r) => r.requestPlies.white.length > 0),
        anyHesitation: share(
          (r) => r.hesitations.white + r.hesitations.black > 0,
        ),
        playerHesitation: share((r) => r.hesitations.white > 0),
        playerHesitation2Plus: share((r) => r.hesitations.white >= 2),
        unexpectedMove: share((r) => r.perPly.some((c) => c.has("unexpected"))),
        withdrawal: share((r) => (r.counters.retreats ?? 0) > 0),
        overrun: share((r) => (r.counters.extensions ?? 0) > 0),
        shakenWarning: share((r) => (r.counters.shakenWarnings ?? 0) > 0),
        warning: share((r) => r.warnings > 0),
        ambientLine: share((r) => r.perPly.some((c) => c.has("ambient"))),
        complaint: share((r) => (r.families.complaint ?? 0) > 0),
        complaintStage2: share((r) => (r.counters.complaintStage2 ?? 0) > 0),
        plot: share((r) => r.plots > 0),
        regicide: share((r) => r.terminal === "regicide"),
      },
      // Player-side interruption rate: the only input the mechanic forces.
      playerOrders: {
        orders: sum((r) => r.orders.white),
        hesitations: sum((r) => r.hesitations.white),
        hesitationRate: ratio(
          sum((r) => r.hesitations.white),
          sum((r) => r.orders.white),
        ),
        computerOrders: sum((r) => r.orders.black),
        computerHesitations: sum((r) => r.hesitations.black),
        computerHesitationRate: ratio(
          sum((r) => r.hesitations.black),
          sum((r) => r.orders.black),
        ),
        pliesBetweenPlayerHesitations: spread(
          records.flatMap((r) => gaps(r.hesitationPlies.white)),
        ),
      },
      // Ply of the first occurrence, over the games in which it occurs.
      firstPly: {
        presence: spread(
          present(records.map((r) => firstPly(r.perPly, (c) => c.size > 0))),
        ),
        event: spread(present(records.map((r) => firstPly(r.perPly, isEvent)))),
        ...Object.fromEntries(
          CHANNELS.map((ch) => [
            ch,
            spread(
              present(records.map((r) => firstPly(r.perPly, (c) => c.has(ch)))),
            ),
          ]),
        ),
        playerRequest: spread(
          present(records.map((r) => r.requestPlies.white[0] ?? null)),
        ),
        playerHesitation: spread(
          present(records.map((r) => r.hesitationPlies.white[0] ?? null)),
        ),
      },
      // Plies between consecutive "something new happened" plies, pooled.
      pliesBetweenEvents: spread(records.flatMap((r) => gaps(eventPlies(r)))),
      pliesBetweenRequests: spread(
        records.flatMap((r) =>
          gaps(
            [...r.requestPlies.white, ...r.requestPlies.black].sort(
              (a, b) => a - b,
            ),
          ),
        ),
      ),
      // Longest stretch per game with nothing on screen / nothing new.
      longestRunWithoutPresence: spread(
        records.map((r) =>
          Math.max(0, ...quietRuns(r.perPly, (c) => c.size > 0)),
        ),
      ),
      longestRunWithoutPresenceAfterPly10: spread(
        records
          .filter((r) => r.plies > 10)
          .map((r) =>
            Math.max(0, ...quietRuns(r.perPly.slice(10), (c) => c.size > 0)),
          ),
      ),
      longestRunWithoutEvent: spread(
        records.map((r) => Math.max(0, ...quietRuns(r.perPly, isEvent))),
      ),
      phases,
      families: records.reduce<Record<string, number>>((n, r) => {
        for (const [k, v] of Object.entries(r.families)) n[k] = (n[k] ?? 0) + v;
        return n;
      }, {}),
      counters: Object.fromEntries(
        [
          "eligibleCommands",
          "encounterOffers",
          "encounter:fulfilled",
          "encounter:expired",
          "encounter:interrupted",
          "retreats",
          "extensions",
          "shakenWarnings",
          "complaintStage2",
          "plots",
          "armedAttempts",
        ].map((k) => [k, counter(k)]),
      ),
    }),
  );
}
