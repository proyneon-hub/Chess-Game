// Player-experience playtest: White plays a human-like style against the real
// computer opponent (the worker's choice and budgets). Reports how often the
// hidden politics become visible to the player. Prints only; writes nothing.
//
//   npm run playtest -- --style aware,engine,reckless --games 30
import { createGameState, getAllLegalMoves, submitMove } from "../lib/game";
import { publicState } from "../lib/game/publicState";
import { computerChoice } from "../lib/ai/computerChoice";
import { DIFFICULTY } from "../lib/ai/difficulty";
import { refusalFallback } from "../lib/ai/restraint";
import { ownPolitics } from "../lib/ai/politicalEvaluation";
import { configFor, DEFAULT_CONFIG } from "../lib/rpg/config";
import { seedRng, draw, type RngState } from "../lib/rpg/rng";
import type { Difficulty } from "../lib/game";
import type { GameState, MoveAttempt } from "../lib/game/types";
import { awareChoice, boardChoice } from "./board-policies";

const STYLES = ["aware", "engine", "reckless"] as const;
type Style = (typeof STYLES)[number];

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
  cap = 200;
if (
  styles.some((s) => !STYLES.includes(s)) ||
  !Number.isSafeInteger(games) ||
  games < 1 ||
  !Number.isSafeInteger(seedStart) ||
  !configFor(config) ||
  !(difficulty in DIFFICULTY)
)
  throw Error("Invalid style, games, seed, config or difficulty.");

// Seeded stand-in for the worker's Math.random, so runs are reproducible.
const aiRng = seedRng(seedStart * 13 + 5);
/** The computer's move exactly as useComputerTurn asks the worker for it. */
function computerMove(s: GameState, level = difficulty): MoveAttempt {
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
  if (style === "engine") return computerMove(s, "normal");
  if (style === "reckless") return boardChoice(s, rng, "board-mistreatment");
  return awareChoice(publicState(s), rng);
}

type GameRecord = {
  plies: number;
  terminal: string;
  winner: string | null;
  signalPlies: number;
  hesitations: { white: number; black: number };
  autonomous: number;
  requests: { white: number; black: number };
  families: Record<string, number>;
  warnings: number;
  plots: number;
};

function play(seed: number, style: Style): GameRecord {
  const rng = seedRng(seed * 7 + 3);
  let s = createGameState(seed, config);
  const seen = new Set<string>(),
    started = new Set<string>(),
    families: Record<string, number> = {};
  const record: GameRecord = {
    plies: 0,
    terminal: "",
    winner: null,
    signalPlies: 0,
    hesitations: { white: 0, black: 0 },
    autonomous: 0,
    requests: { white: 0, black: 0 },
    families,
    warnings: 0,
    plots: 0,
  };
  let lastWarning = "";
  for (
    let guard = 0;
    s.status === "active" && s.ply < cap && guard < 600;
    guard++
  ) {
    const side = s.sideToMove;
    let r = submitMove(
      s,
      side === "white" ? playerMove(s, style, rng) : computerMove(s),
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
    let signal = false;
    if (r.resolution === "refused") {
      record.hesitations[side]++;
      signal = true;
    }
    if (r.resolution === "autonomous") {
      record.autonomous++;
      signal = true;
    }
    if (r.special) signal = true;
    for (const e of publicState(s).encounters ?? [])
      if (!seen.has(e.id)) {
        seen.add(e.id);
        record.requests[e.side]++;
        signal = true;
      }
    if (s.simulation?.schemaVersion === 5)
      for (const e of s.simulation.encounters.active)
        if (!started.has(e.id)) {
          started.add(e.id);
          families[e.family] = (families[e.family] ?? 0) + 1;
        }
    const warning = s.warning?.message ?? "";
    if (warning && warning !== lastWarning) {
      record.warnings++;
      signal = true;
    }
    lastWarning = warning;
    if (signal) record.signalPlies++;
  }
  record.plies = s.ply;
  record.terminal = s.terminal?.reason ?? (s.ply >= cap ? "cap" : "unfinished");
  record.winner = s.terminal?.winner ?? null;
  record.plots = s.simulation?.plots.length ?? 0;
  return record;
}

const median = (xs: number[]) =>
  xs.length
    ? [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) / 2)]
    : 0;
const pct = (n: number, d: number) =>
  d ? `${((100 * n) / d).toFixed(0)}%` : "n/a";
const per = (n: number, d: number) => (d ? (n / d).toFixed(2) : "n/a");

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
  rows.push({
    style,
    "W/D/L": `${records.filter((r) => r.winner === "white").length}/${records.filter((r) => !r.winner).length}/${records.filter((r) => r.winner === "black").length}`,
    "median plies": String(median(records.map((r) => r.plies))),
    "reach 40": pct(reached(40).length, games),
    "signal plies": pct(
      sum((r) => r.signalPlies),
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
    plots: String(sum((r) => r.plots)),
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
