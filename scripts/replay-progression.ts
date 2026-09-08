// CLI-only causal walkthrough. Ordinary execution is scripted; plot rolls are
// suppressed, so this output is never natural-occurrence evidence.
import fixture from "../tests/goldens/natural-progression-v3.json";
import { createGameState, submitMove } from "../lib/game";
import type { MoveAttempt } from "../lib/game/types";
import { validateState } from "../lib/game/validation";
let s = createGameState(fixture.seed, fixture.configVersion);
const milestones = new Set<string>();
for (const action of fixture.actions) {
  const r = submitMove(s, action as MoveAttempt, { draw: () => 0.99 });
  if (!r.turnConsumed) throw Error(`Illegal fixture at ply ${s.ply}`);
  s = r.state;
  validateState(s);
  for (const key of [
    "exposures",
    "neglect",
    "rescues",
    "protections",
    "rivalFriction",
    "disputes",
    "eligibleKingdomTurns",
  ])
    if (!milestones.has(key) && (s.simulation!.counters[key] ?? 0) > 0) {
      milestones.add(key);
      console.log(
        JSON.stringify({
          first: key,
          ply: s.ply,
          command: action,
          kingdoms: s.simulation!.kingdoms,
        }),
      );
    }
}
if (!milestones.has("disputes") || !milestones.has("eligibleKingdomTurns"))
  throw Error("Causal walkthrough did not reach its gates.");
console.log(
  JSON.stringify({
    evidence: "scripted cooperative causal reachability",
    seed: fixture.seed,
    config: fixture.configVersion,
    plies: s.ply,
    counters: s.simulation!.counters,
  }),
);
