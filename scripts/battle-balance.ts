// Battle Chess balance run: the computer plays itself through the real
// reducer on seeded games, and the script reports how often battles happen
// and how they end. Prints only.
//
//   npx tsx scripts/battle-balance.ts --games 100 --white normal --black normal
import { createGameState, submitMove, movesFor } from "../lib/game";
import { computerChoice } from "../lib/ai/computerChoice";
import { DIFFICULTY } from "../lib/ai/difficulty";
import { unitGrid } from "../lib/battle/resolve";
import { BATTLE_CONFIG } from "../lib/rpg/config";
import { seedRng, draw } from "../lib/rpg/rng";
import type { Difficulty } from "../lib/game";
import type { BattleOutcome } from "../lib/battle/stats";

const flags: Record<string, string> = {};
for (let i = 2; i < process.argv.length; i += 2)
  flags[process.argv[i]] = process.argv[i + 1];
const games = Number(flags["--games"] ?? 50),
  seedStart = Number(flags["--seed-start"] ?? 7000),
  levels = {
    white: (flags["--white"] ?? "normal") as Difficulty,
    black: (flags["--black"] ?? "normal") as Difficulty,
  },
  cap = 300;
const median = (xs: number[]) =>
  xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 0;
const outcomes: Record<BattleOutcome, number> = {
    defeated: 0,
    wounded: 0,
    repelled: 0,
    fell: 0,
  },
  endings: Record<string, number> = {},
  wins = { white: 0, black: 0, draw: 0 },
  plies: number[] = [],
  battles: number[] = [],
  firstBattle: number[] = [],
  kingHits: number[] = [],
  longestQuiet: number[] = [];
for (let g = 0; g < games; g++) {
  const seed = seedStart + g,
    ai = seedRng(seed * 13 + 5);
  let s = createGameState(seed, BATTLE_CONFIG.version),
    first = 0,
    quiet = 0,
    worst = 0;
  const hits = { K: 0, k: 0 };
  while (s.status === "active" && s.ply < cap) {
    const { depth, budgetMs, spreadCp } = DIFFICULTY[levels[s.sideToMove]];
    const choice = computerChoice(
      {
        rules: "battle",
        board: s.board,
        rights: s.rights,
        side: s.sideToMove,
        units: unitGrid(s),
        depth,
        budgetMs,
        // A little spread keeps mirror games from repeating each other.
        spreadCp: spreadCp ?? 15,
        positions: s.positions,
      },
      () => draw(ai),
    );
    const r = submitMove(s, choice.moves[0] ?? movesFor(s)[0]);
    if (!r.requestAccepted) throw Error("Search chose an unavailable move.");
    s = r.state;
    const b = s.battle!.last;
    if (b?.ply === s.ply) {
      outcomes[b.outcome]++;
      if (!first) first = s.ply;
      if (b.damage && (b.defender === "K" || b.defender === "k"))
        hits[b.defender]++;
      quiet = 0;
    } else worst = Math.max(worst, ++quiet);
  }
  const reason = s.terminal?.reason ?? "cap";
  endings[reason] = (endings[reason] ?? 0) + 1;
  wins[s.terminal?.winner ?? "draw"]++;
  plies.push(s.ply);
  battles.push(s.battle!.count);
  firstBattle.push(first);
  longestQuiet.push(worst);
  if (reason === "king-defeated")
    kingHits.push(hits[s.terminal!.winner === "white" ? "k" : "K"]);
}
const total = Object.values(outcomes).reduce((a, b) => a + b, 0),
  sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0),
  pct = (n: number, d: number) => `${((100 * n) / d).toFixed(0)}%`;
console.log(
  JSON.stringify(
    {
      config: BATTLE_CONFIG.version,
      games,
      levels,
      wins,
      endings,
      medianPlies: median(plies),
      battlesPerGame: (total / games).toFixed(1),
      fewestBattles: Math.min(...battles),
      battleShareOfPlies: pct(total, sum(plies)),
      medianFirstBattlePly: median(firstBattle),
      latestFirstBattlePly: Math.max(...firstBattle),
      medianLongestQuietStretch: median(longestQuiet),
      outcomes: Object.fromEntries(
        Object.entries(outcomes).map(([k, v]) => [k, pct(v, total)]),
      ),
      medianHitsToDefeatKing: median(kingHits),
    },
    null,
    1,
  ),
);
