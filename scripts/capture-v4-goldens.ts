// Execute only against the unmodified v4 engine; refuse to overwrite evidence.
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createGameState, getAllLegalMoves, submitMove } from "../lib/game";
const records = [];
for (let config = 1; config <= 7; config++) {
  for (const seed of [101, 92017, 110456]) {
    let state = createGameState(seed, `2026-09-09.${config}`);
    const initial = structuredClone(state),
      actions = [],
      hashes = [];
    for (let i = 0; i < 160 && state.status === "active"; i++) {
      const moves = getAllLegalMoves(
        state.board,
        state.sideToMove,
        state.rights,
      );
      const action = moves[(i * 31 + seed) % moves.length];
      const result = submitMove(state, action);
      actions.push(action);
      hashes.push(
        createHash("sha256").update(JSON.stringify(result)).digest("hex"),
      );
      state = result.state;
    }
    records.push({ initial, actions, hashes });
  }
}
writeFileSync("tests/goldens/pre-v5.json", JSON.stringify(records) + "\n", {
  flag: "wx",
});
console.log(`Captured ${records.length} immutable v4 replays.`);
