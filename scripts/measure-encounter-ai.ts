import { writeFileSync } from "node:fs";
import { createGameState, getAllLegalMoves } from "../lib/game";
import { searchMoves } from "../lib/ai/search";
import { ownPolitics } from "../lib/ai/politicalEvaluation";
import { encounters } from "../lib/rpg/encounters/state";
import { constructedV5Court } from "../tests/encounter-fixtures";
import type { GameState } from "../lib/game/types";
// Synthetic benchmark fixtures, explicitly excluded from gameplay frequency.
const samples: { name: string; state: GameState }[] = [
  { name: "quiet", state: createGameState(731) },
];
const multiple = createGameState(731);
multiple.ply = 40;
multiple.simulation!.turnContext.ply = 40;
multiple.simulation!.kingdoms.white.ownTurnsCompleted = 20;
encounters(multiple).serial = 2;
encounters(multiple).active = [
  multiple.pieceIds[7][1]!,
  multiple.pieceIds[7][6]!,
].map((id, i) => ({
  id: `encounter-${i + 1}`,
  family: "confidence",
  phase: 3,
  side: "white",
  participants: [id],
  causes: [],
  createdPly: 40,
  createdOwn: 20,
  deadline: 23,
  objective: { kind: "confidence", subject: id },
  stage: 1,
  stageOwn: 20,
  outcome: "active",
  consumed: [],
  parent: null,
  interacted: false,
  effective: false,
}));
samples.push({ name: "two requests", state: multiple });
const dispute = structuredClone(multiple),
  pair = [dispute.pieceIds[7][1]!, dispute.pieceIds[6][0]!] as [string, string];
encounters(dispute).active = [
  {
    ...encounters(dispute).active[0],
    family: "dispute",
    participants: pair,
    objective: { kind: "mediate", pair, separated: 0 },
  },
];
samples.push({ name: "dispute", state: dispute });
const court = constructedV5Court();
court.simulation!.plots = [
  {
    side: "white",
    ringleader: court.pieceIds[5][3]!,
    accomplice: court.pieceIds[5][5]!,
    stage: "armed",
    stageEnteredOwnTurn: 9,
    warningEventIds: [1, 2, 3],
    warningOwnTurns: [7, 8, 9],
    separatedTurns: 0,
    deferredTurns: 0,
  },
];
samples.push({ name: "warned court", state: court });
const results = [];
for (const { name, state } of samples)
  for (const depth of [2, 4]) {
    const before = JSON.stringify(state),
      r = searchMoves({
        board: state.board,
        rights: state.rights,
        side: state.sideToMove,
        depth,
        budgetMs: depth === 2 ? 250 : 1000,
        own: ownPolitics(state, state.sideToMove),
      });
    const legal = getAllLegalMoves(state.board, state.sideToMove, state.rights);
    results.push({
      name,
      depth,
      elapsedMs: r.elapsedMs,
      completedDepth: r.completedDepth,
      nodes: r.nodes,
      legal:
        r.moves.length > 0 &&
        r.moves.every((m) =>
          legal.some((x) => JSON.stringify(x) === JSON.stringify(m)),
        ),
      pure: before === JSON.stringify(state),
    });
  }
writeFileSync(
  process.argv[2] ?? "docs/v5-encounters/ai-performance.json",
  JSON.stringify(
    {
      node: process.version,
      classification: "synthetic performance fixtures, not frequency evidence",
      results,
    },
    null,
    2,
  ),
  { flag: "wx" },
);
console.log(JSON.stringify(results, null, 2));
if (results.some((r) => !r.legal || !r.pure)) process.exitCode = 1;
