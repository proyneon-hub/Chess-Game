// Battle Chess balance run: the computer plays itself through the real
// reducer on seeded games, and the script reports how often battles happen,
// how they end and who wins. Prints only.
//
//   npx tsx scripts/battle-balance.ts --games 100 --white normal --black normal
//
// --white/--black  easy | normal | advanced, or dN for a bare depth (d3)
// --nodes N        stop each search on a node count instead of the clock, so
//                  results repeat exactly whatever else the machine is doing
// --swap true      play every seed twice, with the two levels trading colours
// --rules '{...}'  try a stat table without registering a config, e.g.
//                  '{"minDamage":2,"stats":{"k":{"hp":16}}}'
import { createGameState, submitMove, movesFor } from "../lib/game";
import { DIFFICULTY } from "../lib/ai/difficulty";
import { DEFAULT_CONFIG } from "../lib/battle/config";
import { initialUnits, unitGrid } from "../lib/battle/resolve";
import { searchBattle } from "../lib/battle/search";
import { seedRng, draw } from "../lib/game/rng";
import type { Difficulty } from "../lib/game";
import { type BattleOutcome, type BattleRules } from "../lib/battle/stats";
import type { Side } from "../lib/chess";

const flags: Record<string, string> = {};
for (let i = 2; i < process.argv.length; i += 2)
  flags[process.argv[i]] = process.argv[i + 1];
const games = Number(flags["--games"] ?? 50),
  seedStart = Number(flags["--seed-start"] ?? 7000),
  nodes = flags["--nodes"] ? Number(flags["--nodes"]) : undefined,
  swap = flags["--swap"] === "true",
  names = [flags["--white"] ?? "normal", flags["--black"] ?? "normal"],
  cap = 300;
const base = DEFAULT_CONFIG.battle,
  override = JSON.parse(flags["--rules"] ?? "{}") as Partial<BattleRules>,
  rules: BattleRules = {
    ...base,
    ...override,
    stats: Object.fromEntries(
      Object.entries(base.stats).map(([k, v]) => [
        k,
        { ...v, ...override.stats?.[k] },
      ]),
    ),
  };
const level = (
  name: string,
): { depth: number; budgetMs: number; spreadCp?: number } =>
  /^d\d+$/.test(name)
    ? { depth: Number(name.slice(1)), budgetMs: 1000 }
    : DIFFICULTY[name as Difficulty];
if (names.some((n) => !level(n))) throw Error("Unknown level.");

const median = (xs: number[]) =>
  xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 0;
const outcomes: Record<BattleOutcome, number> = {
    defeated: 0,
    wounded: 0,
    repelled: 0,
    fell: 0,
  },
  endings: Record<string, number> = {},
  byColour = { white: 0, black: 0, draw: 0 },
  byLevel: Record<string, number> = {},
  depths: Record<string, number[]> = {},
  plies: number[] = [],
  battles: number[] = [],
  firstBattle: number[] = [],
  kingHits: number[] = [],
  longestQuiet: number[] = [];
let searchMs = 0,
  searches = 0;
function play(seed: number, players: Record<Side, string>) {
  const ai = seedRng(seed * 13 + 5);
  let s = createGameState(seed, DEFAULT_CONFIG.version),
    first = 0,
    quiet = 0,
    worst = 0;
  s.battle.units = initialUnits(s.board, s.pieceIds, rules);
  const hits = { K: 0, k: 0 };
  while (s.status === "active" && s.ply < cap) {
    const name = players[s.sideToMove],
      l = level(name);
    const choice = searchBattle(
      {
        rules: "battle",
        board: s.board,
        rights: s.rights,
        side: s.sideToMove,
        units: unitGrid(s),
        depth: l.depth,
        budgetMs: nodes ? 600000 : l.budgetMs,
        maxNodes: nodes,
        // A little spread keeps mirror games from repeating each other.
        spreadCp: l.spreadCp ?? 15,
        positions: s.positions,
        battle: rules,
      },
      () => draw(ai),
    );
    (depths[name] ??= []).push(choice.completedDepth);
    searchMs += choice.elapsedMs;
    searches++;
    const r = submitMove(s, choice.moves[0] ?? movesFor(s)[0], { rules });
    if (!r.requestAccepted) throw Error("Search chose an unavailable move.");
    s = r.state;
    const b = s.battle.last;
    if (b?.ply === s.ply) {
      outcomes[b.outcome]++;
      if (!first) first = s.ply;
      if (b.damage && (b.defender === "K" || b.defender === "k"))
        hits[b.defender]++;
      quiet = 0;
    } else worst = Math.max(worst, ++quiet);
  }
  const reason = s.terminal?.reason ?? "cap",
    winner = s.terminal?.winner ?? null;
  endings[reason] = (endings[reason] ?? 0) + 1;
  byColour[winner ?? "draw"]++;
  const key = winner ? players[winner] : "draw";
  byLevel[key] = (byLevel[key] ?? 0) + 1;
  plies.push(s.ply);
  battles.push(s.battle.count);
  firstBattle.push(first);
  longestQuiet.push(worst);
  if (reason === "king-defeated")
    kingHits.push(hits[winner === "white" ? "k" : "K"]);
}
for (let g = 0; g < games; g++) {
  play(seedStart + g, { white: names[0], black: names[1] });
  if (swap) play(seedStart + g, { white: names[1], black: names[0] });
}
const total = Object.values(outcomes).reduce((a, b) => a + b, 0),
  played = plies.length,
  sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0),
  pct = (n: number, d: number) => `${((100 * n) / d).toFixed(0)}%`,
  decisive = byColour.white + byColour.black;
console.log(
  JSON.stringify({
    config: DEFAULT_CONFIG.version,
    rules: flags["--rules"] ?? "default",
    games: played,
    white: names[0],
    black: names[1],
    swap,
    nodes: nodes ?? "clock",
    byColour,
    whiteShareOfDecisive: pct(byColour.white, decisive),
    ...(names[0] !== names[1] ? { byLevel } : {}),
    endings,
    medianPlies: median(plies),
    battlesPerGame: (total / played).toFixed(1),
    fewestBattles: Math.min(...battles),
    battleShareOfPlies: pct(total, sum(plies)),
    firstBattlePly: `${median(firstBattle)} median, ${Math.max(...firstBattle)} latest`,
    medianLongestQuietStretch: median(longestQuiet),
    outcomes: Object.fromEntries(
      Object.entries(outcomes).map(([k, v]) => [k, pct(v, total)]),
    ),
    medianHitsToDefeatKing: median(kingHits),
    depthReached: Object.fromEntries(
      Object.entries(depths).map(([k, v]) => [
        k,
        `${median(v)} median, ${Math.min(...v)} least`,
      ]),
    ),
    meanSearchMs: (searchMs / searches).toFixed(0),
  }),
);
