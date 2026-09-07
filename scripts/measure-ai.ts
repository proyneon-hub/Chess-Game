import { writeFileSync, mkdirSync } from "node:fs";
import { createGameState, getAllLegalMoves, submitMove } from "../lib/game";
import { searchMoves } from "../lib/ai/search";
import { ownPolitics } from "../lib/ai/politicalEvaluation";
import { draw, seedRng } from "../lib/rpg/rng";
const samples: ReturnType<typeof createGameState>[] = [];
let s = createGameState(731),
  rng = seedRng(910);
for (let n = 0; n < 30; n++) {
  if (n % 5 === 0) samples.push(s);
  const moves = getAllLegalMoves(s.board, s.sideToMove, s.rights);
  s = submitMove(s, moves[Math.floor(draw(rng) * moves.length)], {
    classic: true,
  }).state;
}
const report = [
  { difficulty: "normal", depth: 2, budgetMs: 250 },
  { difficulty: "advanced", depth: 4, budgetMs: 1000 },
].map((options) => {
  const results = samples.map((s) => {
    const r = searchMoves({
      board: s.board,
      rights: s.rights,
      side: s.sideToMove,
      ...options,
      own: ownPolitics(s, s.sideToMove),
    });
    return {
      ply: s.ply,
      elapsedMs: r.elapsedMs,
      completedDepth: r.completedDepth,
      nodes: r.nodes,
      legal: !!r.moves.length,
    };
  });
  return {
    ...options,
    results,
    meanMs: results.reduce((n, r) => n + r.elapsedMs, 0) / results.length,
    p95Ms: results.map((r) => r.elapsedMs).sort((a, b) => a - b)[
      Math.floor(results.length * 0.95)
    ],
  };
});
mkdirSync("docs/balance", { recursive: true });
writeFileSync(
  "docs/balance/ai-performance.json",
  JSON.stringify({ node: process.version, samples: 6, report }, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    report.map(({ difficulty, meanMs, p95Ms, results }) => ({
      difficulty,
      meanMs,
      p95Ms,
      depths: results.map((r) => r.completedDepth),
    })),
    null,
    2,
  ),
);
