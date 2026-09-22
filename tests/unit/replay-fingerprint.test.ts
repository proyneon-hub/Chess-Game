import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { createGameState, getAllLegalMoves, submitMove } from "@/lib/game";
import { publicState } from "@/lib/game/publicState";
import { searchMoves } from "@/lib/ai/search";
import {
  V2_CONFIG,
  V3_CONFIG,
  V4_CONFIG,
  CONFIG,
  PLAYTEST_CONFIG,
  V6_CONFIG,
} from "@/lib/rpg/config";
import { seedRng, draw } from "@/lib/rpg/rng";
import type { GameState } from "@/lib/game/types";

// Refactoring safety net. Seeded random play across every rules generation
// must reproduce these hashes exactly: any difference means saved games would
// replay differently. Hashes use sorted keys, so reordering object fields is
// not a change. If a rules change is intentional, it needs a new config
// version; update the pins only in that commit and say so in its message.
// The state and search pins match the code before the September 2026 review
// (2b94021); the public pin differs from it only by the public event
// renumbering that stopped hidden rolls leaking.
const PINS = {
  plies: 3200,
  state: "d27a53db85da12cb",
  public: "9c22eb7d2feb102b",
  search: "819bf1282628ab25",
  searchNodes: 56113,
};

const canonical = (v: unknown): string =>
  JSON.stringify(v, (_, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, x[k]]),
        )
      : x,
  );
function* play(version: string, seed: number, plies: number) {
  let s: GameState = createGameState(seed * 7919 + 13, version);
  const rng = seedRng(seed);
  for (let ply = 0; ply < plies && s.status === "active"; ply++) {
    const moves = getAllLegalMoves(s.board, s.sideToMove, s.rights),
      move = moves[Math.floor(draw(rng) * moves.length)];
    let r = submitMove(s, move);
    if (!r.turnConsumed) r = submitMove(r.state, move);
    s = r.state;
    yield s;
  }
}
const generations = [
  V2_CONFIG.version,
  V3_CONFIG.version,
  V4_CONFIG.version,
  CONFIG.version,
];

it("seeded play replays identically across rule generations", () => {
  const state = createHash("sha256"),
    pub = createHash("sha256");
  let plies = 0;
  for (const version of generations)
    for (let seed = 0; seed < 8; seed++) {
      let last: GameState | undefined;
      for (const s of play(version, seed, 100)) {
        state.update(canonical(s));
        last = s;
        plies++;
      }
      pub.update(canonical(publicState(last!)));
    }
  expect({
    plies,
    state: state.digest("hex").slice(0, 16),
    public: pub.digest("hex").slice(0, 16),
  }).toEqual({ plies: PINS.plies, state: PINS.state, public: PINS.public });
}, 60000);

// Configs added after the pins above: playtest tuning (generation 5) and
// generation 6. Same rule: a change here needs a new config version.
const LATER_PINS = {
  plies: 1600,
  state: "7e6ce9c4b64c92ea",
  public: "78f537891841d9fe",
};
it("seeded play replays identically for later configs", () => {
  const state = createHash("sha256"),
    pub = createHash("sha256");
  let plies = 0;
  for (const version of [PLAYTEST_CONFIG.version, V6_CONFIG.version])
    for (let seed = 0; seed < 8; seed++) {
      let last: GameState | undefined;
      for (const s of play(version, seed, 100)) {
        state.update(canonical(s));
        last = s;
        plies++;
      }
      pub.update(canonical(publicState(last!)));
    }
  expect({
    plies,
    state: state.digest("hex").slice(0, 16),
    public: pub.digest("hex").slice(0, 16),
  }).toEqual(LATER_PINS);
}, 60000);

it("fixed-depth search returns identical rankings", () => {
  const h = createHash("sha256");
  let nodes = 0;
  for (let seed = 0; seed < 3; seed++) {
    let n = 0;
    for (const s of play(CONFIG.version, seed, 50))
      if (n++ % 10 === 5) {
        const r = searchMoves({
          board: s.board,
          rights: s.rights,
          side: s.sideToMove,
          depth: 3,
          budgetMs: 1e9,
          own: null,
        });
        h.update(canonical([r.moves, r.completedDepth]));
        nodes += r.nodes;
      }
  }
  expect({ search: h.digest("hex").slice(0, 16), searchNodes: nodes }).toEqual({
    search: PINS.search,
    searchNodes: PINS.searchNodes,
  });
}, 60000);
