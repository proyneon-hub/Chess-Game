// Run once against the unmodified v3 reducer. Never regenerate to accept changes.
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createGameState, getAllLegalMoves, submitMove } from "../lib/game";
import { v3Fixture, constructedV3Court } from "../tests/progression-fixtures";
import { subjectAt } from "../tests/fixtures";
import { agencyForecast } from "../lib/rpg/agency";
import type { GameState, MoveAttempt } from "../lib/game/types";
const records: unknown[] = [];
function capture(
  name: string,
  initial: GameState,
  actions?: MoveAttempt[],
  forced?: number[],
) {
  let state = structuredClone(initial),
    index = 0;
  const used: MoveAttempt[] = [],
    hashes: string[] = [];
  for (
    let i = 0;
    i < (actions?.length ?? 100) && state.status === "active";
    i++
  ) {
    const choices = getAllLegalMoves(
      state.board,
      state.sideToMove,
      state.rights,
    );
    const action = actions?.[i] ?? choices[(i * 31 + 17) % choices.length];
    const result = submitMove(
      state,
      action,
      forced ? { draw: () => forced[index++] ?? 0.99 } : {},
    );
    used.push(action);
    hashes.push(
      createHash("sha256").update(JSON.stringify(result)).digest("hex"),
    );
    state = result.state;
  }
  records.push({
    name,
    initial,
    actions: used,
    forced,
    hashes,
    drawCount: index,
  });
}
for (let v = 1; v <= 6; v++) {
  const version = `2026-09-08.${v}`;
  capture(`${version}:seeded-100-actions`, createGameState(90123, version));
  for (const check of [false, true]) {
    const s = v3Fixture(
      check
        ? [
            ["K", [7, 7]],
            ["k", [3, 7]],
            ["R", [5, 0]],
          ]
        : [
            ["K", [7, 7]],
            ["k", [0, 7]],
            ["R", [5, 0]],
            ["p", [2, 1]],
          ],
      40,
    );
    s.configVersion = version;
    s.simulation!.configVersion = version;
    subjectAt(s, [5, 0]).morale = 80;
    const m: MoveAttempt = { from: [5, 0], to: [4, 0], side: "white" };
    const f = agencyForecast(s, m);
    capture(
      `${version}:hero-${check ? "check" : "blame"}`,
      s,
      [m],
      [f.refusal + f.retreat + f.heroism / 2],
    );
    capture(`${version}:commanded-danger`, s, [{ ...m, to: [3, 0] }], [0.99]);
    capture(`${version}:refusal-repeat`, s, [m, m], [0, 0.99]);
  }
  const court = constructedV3Court();
  court.configVersion = version;
  court.simulation!.configVersion = version;
  capture(
    `${version}:constructed-court`,
    court,
    undefined,
    Array(150).fill(0.99),
  );
}
writeFileSync(
  "tests/goldens/pre-v4.json",
  JSON.stringify(records, null, 2) + "\n",
  { flag: "wx" },
);
console.log(`Captured ${records.length} immutable v3 cases.`);
