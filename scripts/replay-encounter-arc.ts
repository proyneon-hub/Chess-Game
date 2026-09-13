import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createGameState, submitMove, getAllLegalMoves } from "../lib/game";
import type { MoveAttempt } from "../lib/game/types";
import { validateState } from "../lib/game/validation";
import { encounters } from "../lib/rpg/encounters/state";
import { publicState } from "../lib/game/publicState";
import { agencyForecast } from "../lib/rpg/agency";
import { pressureChoice, cooperativeReply } from "./progression-policies";
import { seedRng } from "../lib/rpg/rng";
// Cooperative scripted causal-path demonstration. Never cohort evidence.
// Actual initialization/gameplay RNG; never injected stats, clocks or rolls.
const seed = Number(process.argv[2] ?? 42),
  output = process.argv[3];
const fixture = JSON.parse(
  readFileSync("tests/goldens/natural-progression-v3.json", "utf8"),
);
let s = createGameState(seed);
const rng = seedRng(seed),
  trace = [];
for (
  let i = 0;
  i < fixture.actions.length + 120 && s.status === "active" && s.ply < 240;
  i++
) {
  const scripted = fixture.actions[i] as MoveAttempt | undefined;
  const choices = getAllLegalMoves(s.board, s.sideToMove, s.rights);
  let m =
    scripted &&
    scripted.side === s.sideToMove &&
    choices.find((c) => JSON.stringify(c) === JSON.stringify(scripted));
  if (!m)
    m =
      s.sideToMove === "white"
        ? pressureChoice(s, rng, true)
        : cooperativeReply(s, rng);
  const before = s;
  let r = submitMove(s, m);
  if (r.resolution === "refused") {
    trace.push({
      move: m,
      public: publicState(r.state),
      resolution: r.resolution,
    });
    r = submitMove(r.state, m);
  }
  if (!r.turnConsumed) throw Error("Replay stalled");
  s = r.state;
  validateState(s);
  trace.push({
    move: m,
    public: publicState(s),
    resolution: r.resolution,
    encounters: encounters(s).active,
    forecast: agencyForecast(before, m),
  });
}
const summary = {
  seed,
  classification:
    "cooperative normal-start causal replay; not frequency evidence",
  plies: s.ply,
  counters: s.simulation!.counters,
  terminal: s.terminal,
};
console.log(JSON.stringify(summary));
if (output) {
  mkdirSync("docs/v5-encounters/replays", { recursive: true });
  writeFileSync(output, JSON.stringify({ summary, trace }), { flag: "wx" });
}
