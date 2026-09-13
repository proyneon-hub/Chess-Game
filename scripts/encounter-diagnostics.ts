import type { GameState } from "../lib/game/types";
import { dependentMove } from "../lib/rpg/encounters/objectives";
import { encounters } from "../lib/rpg/encounters/state";
import { courtEligibility } from "../lib/rpg/courtEligibility";
export function encounterDiagnostics(s: GameState): Record<string, number> {
  const state = encounters(s),
    side = s.sideToMove,
    sim = s.simulation!,
    own = sim.kingdoms[side].ownTurnsCompleted;
  const out: Record<string, number> = {};
  const add = (key: string) => (out[key] = (out[key] ?? 0) + 1);
  for (const sub of Object.values(sim.subjects).filter(
    (x) => x.side === side && x.status === "active" && x.currentKind !== "k",
  )) {
    const harms = state.sides[side].harms.filter(
      (h) => h.subject === sub.id && own - h.own <= 10,
    );
    if (harms.length >= 2) {
      add("two-harm-actions");
      if (sub.personality === "proud" || sub.ambition >= 60) {
        add("two-harms-personality");
        for (const id of new Set(harms.flatMap((h) => h.involved))) {
          if (sim.subjects[id]?.status !== "active") {
            add("involved-partner-captured");
            continue;
          }
          if (!sub.relationships[id]) {
            add("involved-relationship-evicted");
            continue;
          }
          add("causal-pair");
          if (dependentMove(s, [sub.id, id])) add("dependent-order");
        }
      }
    }
    if (sub.fear >= 40) add("fear40");
    if (sub.fear >= 50) add("fear50");
    if (state.subjects[sub.id].warningOwn !== null) {
      add("warned-survivor");
      if (sub.fear >= 50) add("warned-fear50");
    }
  }
  if (sim.kingdoms[side].tyranny >= 25) add("complaint-tyranny");
  if (sim.kingdoms[side].legitimacy <= 55) add("complaint-legitimacy");
  if (sim.kingdoms[side].tyranny >= 25 && sim.kingdoms[side].legitimacy <= 55)
    add("complaint-government");
  const court = courtEligibility(s, side);
  for (const blocker of court.blockers) add(`court:${blocker}`);
  return out;
}
