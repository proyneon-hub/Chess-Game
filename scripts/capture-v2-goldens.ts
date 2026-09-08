// One-time pre-refactor evidence capture. Never regenerate to accept new behavior.
import { writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { createGameState, submitMove } from "../lib/game";
import { boardFixture, subjectAt } from "../tests/fixtures";
import { lateCourt } from "../tests/scenarios";
import { initializeRpgState } from "../lib/rpgChess";
import { seedRng, draw } from "../lib/rpg/rng";
import type { GameState, MoveAttempt } from "../lib/game/types";
const records: unknown[] = [];
function capture(
  name: string,
  initial: GameState,
  actions: MoveAttempt[],
  forced?: number[],
) {
  let state = structuredClone(initial),
    index = 0;
  const hashes = actions.map((action) => {
    const outcome = submitMove(
      state,
      action,
      forced ? { draw: () => forced[index++] ?? 0.99 } : {},
    );
    state = outcome.state;
    return createHash("sha256").update(JSON.stringify(outcome)).digest("hex");
  });
  records.push({ name, initial, actions, forced, hashes, drawCount: index });
}
const move = (
  from: [number, number],
  to: [number, number],
  side: "white" | "black",
): MoveAttempt => ({ from, to, side });
for (const version of ["2026-09-07.1", "2026-09-07.2", "2026-09-07.3"]) {
  const pin = (s: GameState) => {
    s.configVersion = version;
    s.simulation!.configVersion = version;
    return s;
  };
  capture(
    `${version}:seeded-opening`,
    pin(createGameState(12345, "2026-09-07.3")),
    [
      move([6, 4], [4, 4], "white"),
      move([1, 4], [3, 4], "black"),
      move([7, 6], [5, 5], "white"),
      move([0, 1], [2, 2], "black"),
      move([7, 5], [4, 2], "white"),
      move([0, 6], [2, 5], "black"),
      move([6, 3], [5, 3], "white"),
      move([0, 5], [3, 2], "black"),
      move([7, 4], [7, 6], "white"),
      move([0, 4], [0, 6], "black"),
    ],
  );
  const refusal = pin(
    boardFixture([
      ["K", [7, 4]],
      ["k", [0, 4]],
      ["Q", [4, 3]],
      ["r", [0, 0]],
    ]),
  );
  Object.assign(subjectAt(refusal, [4, 3]), {
    fear: 100,
    resentment: 100,
    loyalty: 0,
  });
  capture(
    `${version}:refusal-repeat`,
    refusal,
    [move([4, 3], [4, 4], "white"), move([4, 3], [4, 4], "white")],
    [0, 0.99],
  );
  const promotion = pin(
    boardFixture([
      ["K", [7, 4]],
      ["k", [0, 4]],
      ["P", [1, 0]],
      ["r", [0, 7]],
    ]),
  );
  capture(`${version}:promotion`, promotion, [
    { ...move([1, 0], [0, 0], "white"), promotion: "n" },
  ]);
  const court = pin(lateCourt());
  const actions: MoveAttempt[] = [];
  for (let i = 0; i < 9; i++)
    actions.push(
      move(
        [i % 2 ? 0 : 7, Math.floor(i / 2) % 2],
        [i % 2 ? 0 : 7, 1 - (Math.floor(i / 2) % 2)],
        i % 2 ? "black" : "white",
      ),
    );
  capture(
    `${version}:court`,
    court,
    actions,
    Array.from({ length: 30 }, (_, i) => (i % 2 ? 0.0 : 0.99)),
  );
}
const legacy = createGameState(12345, "2026-09-07.3");
legacy.schemaVersion = 1;
legacy.rulesetVersion = "legacy-v1";
legacy.configVersion = "legacy-safety-1";
legacy.simulation = null;
const init = seedRng(12345);
legacy.rpgState = initializeRpgState(legacy.board, legacy.pieceIds, () =>
  draw(init),
);
legacy.legacyRng = seedRng(12345);
capture("legacy:seeded", legacy, [
  move([6, 4], [4, 4], "white"),
  move([1, 4], [3, 4], "black"),
]);
capture(
  "legacy:refusal-repeat",
  legacy,
  [move([6, 4], [4, 4], "white"), move([6, 4], [4, 4], "white")],
  [0, 0.99],
);
mkdirSync("tests/goldens", { recursive: true });
writeFileSync(
  "tests/goldens/pre-v3.json",
  JSON.stringify(records, null, 2) + "\n",
  { flag: "wx" },
);
console.log(`Captured ${records.length} immutable legacy/v2 cases.`);
