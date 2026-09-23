// Player-experience playtest: White plays a human-like style against the real
// computer opponent (the worker's choice and budgets). Reports how often the
// hidden politics are visibly present to the player. Prints only; writes
// nothing (--trace excepted, which is diagnostic stdout, not a file).
//
//   npm run playtest -- --style aware,engine,reckless --games 30
import { createGameState, getAllLegalMoves, submitMove } from "../lib/game";
import { publicState } from "../lib/game/publicState";
import { computerChoice } from "../lib/ai/computerChoice";
import { DIFFICULTY } from "../lib/ai/difficulty";
import { refusalFallback } from "../lib/ai/restraint";
import { ownPolitics } from "../lib/ai/politicalEvaluation";
import { configFor, DEFAULT_CONFIG } from "../lib/rpg/config";
import { hasEncounters } from "../lib/rpg/capabilities";
import { presence, type Channel } from "../lib/rpg/presence";
import { seedRng, draw, type RngState } from "../lib/rpg/rng";
import type { Difficulty } from "../lib/game";
import type { GameState, MoveAttempt, Side } from "../lib/game/types";
import { awareChoice, boardChoice } from "./board-policies";

const STYLES = ["aware", "engine", "reckless"] as const;
type Style = (typeof STYLES)[number];
// "Something new happened," as opposed to "still visible from before":
// excludes bare persistence of an open card or a standing warning.
const EVENT_CHANNELS: readonly Channel[] = ["hesitation", "unexpected", "line"];

const flags: Record<string, string> = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i],
    value = process.argv[i + 1];
  if (
    ![
      "--style",
      "--games",
      "--seed-start",
      "--config",
      "--difficulty",
      "--json",
      "--trace",
    ].includes(key) ||
    value === undefined
  )
    throw Error("Invalid option: " + key);
  flags[key] = value;
}
const styles = (flags["--style"] ?? STYLES.join(",")).split(",") as Style[],
  games = Number(flags["--games"] ?? 30),
  seedStart = Number(flags["--seed-start"] ?? 7000),
  config = flags["--config"] ?? DEFAULT_CONFIG.version,
  difficulty = (flags["--difficulty"] ?? "normal") as Difficulty,
  traceSeed = flags["--trace"] === undefined ? null : Number(flags["--trace"]),
  cap = 200;
if (
  styles.some((s) => !STYLES.includes(s)) ||
  !Number.isSafeInteger(games) ||
  games < 1 ||
  !Number.isSafeInteger(seedStart) ||
  !configFor(config) ||
  !(difficulty in DIFFICULTY) ||
  (traceSeed !== null && !Number.isSafeInteger(traceSeed))
)
  throw Error("Invalid style, games, seed, config, difficulty or trace seed.");

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
  // The engine style always plays at Normal strength, whatever the opponent.
  if (style === "engine") return computerMove(s, rng, "normal");
  if (style === "reckless") return boardChoice(s, rng, "board-mistreatment");
  return awareChoice(publicState(s), rng);
}

type GameRecord = {
  plies: number;
  terminal: string;
  winner: string | null;
  presentPlies: number;
  pliesAfter10: number;
  presentAfter10: number;
  whiteTurns: number;
  presentWhiteTurn: number;
  channelPlies: Record<Channel, number>;
  whiteCardPlies: number;
  blackCardPlies: number;
  ambientOnlyPlies: number;
  eventPlies: number;
  hesitations: { white: number; black: number };
  autonomous: number;
  requests: { white: number; black: number };
  families: Record<string, number>;
  warnings: number;
  plots: number;
  counters: Record<string, number>;
};

const emptyChannelPlies = (): Record<Channel, number> => ({
  card: 0,
  warning: 0,
  hesitation: 0,
  unexpected: 0,
  line: 0,
  ambient: 0,
});

function play(seed: number, style: Style): GameRecord {
  const rng = seedRng(seed * 7 + 3),
    // Seeded stand-in for the worker's Math.random, per game, so a game
    // never depends on which games ran before it.
    aiRng = seedRng(seed * 13 + 5);
  let s = createGameState(seed, config);
  const seen = new Set<string>(),
    started = new Set<string>(),
    families: Record<string, number> = {};
  let lastWarning = "";
  const record: GameRecord = {
    plies: 0,
    terminal: "",
    winner: null,
    presentPlies: 0,
    pliesAfter10: 0,
    presentAfter10: 0,
    whiteTurns: 0,
    presentWhiteTurn: 0,
    channelPlies: emptyChannelPlies(),
    whiteCardPlies: 0,
    blackCardPlies: 0,
    ambientOnlyPlies: 0,
    eventPlies: 0,
    hesitations: { white: 0, black: 0 },
    autonomous: 0,
    requests: { white: 0, black: 0 },
    families,
    warnings: 0,
    plots: 0,
    counters: {},
  };
  const trace = traceSeed === seed;
  // Accumulated across every submitMove call for the ply currently in
  // progress (a refusal doesn't advance ply, so more than one call can
  // belong to one ply); flushed into `record` only once the ply advances.
  let pending = new Set<Channel>(),
    pendingCardSides = new Set<Side>(),
    flushedPly = 0,
    pendingMover: Side = "white",
    pendingLines: string[] = [];
  const flush = (finalPly: number) => {
    if (finalPly <= flushedPly) return;
    record.plies = finalPly;
    if (pending.size) {
      record.presentPlies++;
      for (const c of pending) record.channelPlies[c]++;
      if (pendingCardSides.has("white")) record.whiteCardPlies++;
      if (pendingCardSides.has("black")) record.blackCardPlies++;
      if (pending.size === 1 && pending.has("ambient"))
        record.ambientOnlyPlies++;
    }
    if (finalPly > 10) {
      record.pliesAfter10++;
      if (pending.size) record.presentAfter10++;
    }
    if (EVENT_CHANNELS.some((c) => pending.has(c))) record.eventPlies++;
    // The mover of the flushed ply decides whose turn it now is.
    if (pendingMover === "black") {
      record.whiteTurns++;
      if (pending.size) record.presentWhiteTurn++;
    }
    if (trace)
      console.log(
        `${finalPly} ${pendingMover} ${[...pending].join(",") || "-"} ${pendingLines.join(" / ")}`,
      );
    pending = new Set();
    pendingCardSides = new Set();
    pendingLines = [];
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
      // Mirror submitWithFallback: a rejected choice falls back to a legal move.
      const fallback =
        refusalFallback(s) ?? getAllLegalMoves(s.board, side, s.rights)[0];
      if (!fallback) break;
      r = submitMove(s, fallback);
      if (!r.requestAccepted) break;
    }
    s = r.state;
    const { channels, cardSides } = presence(before, s);
    for (const c of channels) pending.add(c);
    for (const side2 of cardSides) pendingCardSides.add(side2);
    pendingMover = side;
    if (trace)
      for (const e of s.events)
        if (e.seq > before.eventSeq) pendingLines.push(e.message);
    if (r.resolution === "refused") record.hesitations[side]++;
    if (r.resolution === "autonomous") record.autonomous++;
    for (const e of publicState(s).encounters ?? [])
      if (!seen.has(e.id)) {
        seen.add(e.id);
        record.requests[e.side]++;
      }
    if (hasEncounters(s.simulation))
      for (const e of s.simulation.encounters.active)
        if (!started.has(e.id)) {
          started.add(e.id);
          families[e.family] = (families[e.family] ?? 0) + 1;
        }
    // Distinct new/changed warnings, not persistence (see channelPlies.warning
    // for how many plies a standing warning stayed visible).
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

const median = (xs: number[]) =>
  xs.length
    ? [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)]
    : 0;
const pct = (n: number, d: number) =>
  d ? `${((100 * n) / d).toFixed(0)}%` : "n/a";
const per = (n: number, d: number) => (d ? (n / d).toFixed(2) : "n/a");
const pctOf = (f: number) => `${(100 * f).toFixed(0)}%`;

const rows: Record<string, string>[] = [];
for (const style of styles) {
  const records = Array.from({ length: games }, (_, i) =>
    play(seedStart + i, style),
  );
  const sum = (f: (r: GameRecord) => number) =>
    records.reduce((n, r) => n + f(r), 0);
  const plies = sum((r) => r.plies),
    reached = (ply: number) => records.filter((r) => r.plies >= ply);
  const complaints = (rs: GameRecord[]) =>
    rs.filter((r) => (r.families.complaint ?? 0) > 0).length;
  // Presence with any channel except a lone "ambient" (filler flavor text
  // alone shouldn't count toward the headline number).
  const corePresent = sum((r) => r.presentPlies - r.ambientOnlyPlies);
  rows.push({
    style,
    "W/D/L": `${records.filter((r) => r.winner === "white").length}/${records.filter((r) => !r.winner).length}/${records.filter((r) => r.winner === "black").length}`,
    "median plies": String(median(records.map((r) => r.plies))),
    "reach 40": pct(reached(40).length, games),
    presence: pct(
      sum((r) => r.presentPlies),
      plies,
    ),
    "presence >10": pct(
      sum((r) => r.presentAfter10),
      sum((r) => r.pliesAfter10),
    ),
    "presence W-turn": pct(
      sum((r) => r.presentWhiteTurn),
      sum((r) => r.whiteTurns),
    ),
    "core presence": pct(corePresent, plies),
    "cards W|B": `${pct(
      sum((r) => r.whiteCardPlies),
      plies,
    )}|${pct(
      sum((r) => r.blackCardPlies),
      plies,
    )}`,
    warning: pct(
      sum((r) => r.channelPlies.warning),
      plies,
    ),
    hesitation: pct(
      sum((r) => r.channelPlies.hesitation),
      plies,
    ),
    unexpected: pct(
      sum((r) => r.channelPlies.unexpected),
      plies,
    ),
    lines: pct(
      sum((r) => r.channelPlies.line),
      plies,
    ),
    ambient: pct(
      sum((r) => r.channelPlies.ambient),
      plies,
    ),
    "median game presence": pctOf(
      median(records.map((r) => (r.plies ? r.presentPlies / r.plies : 0))),
    ),
    "games ≥60%": pct(
      records.filter((r) => r.plies && r.presentPlies / r.plies >= 0.6).length,
      games,
    ),
    "event plies": pct(
      sum((r) => r.eventPlies),
      plies,
    ),
    "hesitations/game W|B": `${per(
      sum((r) => r.hesitations.white),
      games,
    )}|${per(
      sum((r) => r.hesitations.black),
      games,
    )}`,
    "games w/ hesitation": pct(
      records.filter((r) => r.hesitations.white + r.hesitations.black > 0)
        .length,
      games,
    ),
    "autonomous/game": per(
      sum((r) => r.autonomous),
      games,
    ),
    "games w/ withdrawal": pct(
      records.filter((r) => r.autonomous > 0).length,
      games,
    ),
    "shaken/game": per(
      sum((r) => r.counters.shakenWarnings ?? 0),
      games,
    ),
    "requests/game W|B": `${per(
      sum((r) => r.requests.white),
      games,
    )}|${per(
      sum((r) => r.requests.black),
      games,
    )}`,
    "complaints (reach 50)": pct(complaints(reached(50)), reached(50).length),
    "warnings (reach 60)": pct(
      reached(60).filter((r) => r.warnings > 0).length,
      reached(60).length,
    ),
    "complaint stage 2": String(sum((r) => r.counters.complaintStage2 ?? 0)),
    families: Object.entries(
      records.reduce<Record<string, number>>((n, r) => {
        for (const [k, v] of Object.entries(r.families)) n[k] = (n[k] ?? 0) + v;
        return n;
      }, {}),
    )
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${v}`)
      .join(", "),
    plots: String(sum((r) => r.plots)),
    // Court turns past the phase gate, and what most often blocked them.
    "court blockers": (() => {
      const total: Record<string, number> = {};
      for (const r of records)
        for (const [k, v] of Object.entries(r.counters))
          if (k.startsWith("court-blocker:") && k !== "court-blocker:phase")
            total[k.slice(14)] = (total[k.slice(14)] ?? 0) + v;
      return Object.entries(total)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([k, v]) => `${k} ${v}`)
        .join(", ");
    })(),
    regicides: String(records.filter((r) => r.terminal === "regicide").length),
    endings: Object.entries(
      records.reduce<Record<string, number>>(
        (n, r) => ((n[r.terminal] = (n[r.terminal] ?? 0) + 1), n),
        {},
      ),
    )
      .map(([k, v]) => `${k} ${v}`)
      .join(", "),
  });
}
console.log(
  `config ${config}; ${difficulty} computer as Black; ${games} games per style from seed ${seedStart}; ${cap}-ply cap`,
);
if (flags["--json"] === "true")
  for (const row of rows) console.log(JSON.stringify(row));
else console.table(rows);
