import { createGameState, submitMove } from "../lib/game";
import { pressureChoice, cooperativeReply } from "./progression-policies";
import { seedRng } from "../lib/rpg/rng";
import { validateState } from "../lib/game/validation";
import { writeFileSync, mkdirSync } from "node:fs";
const results = [];
for (let seed = 20000; seed < 20010; seed++) {
  let s = createGameState(seed),
    rng = seedRng(seed),
    actions = [];
  while (s.status === "active" && s.ply < 240) {
    const m =
      s.sideToMove === "white"
        ? pressureChoice(s, rng, true)
        : cooperativeReply(s, rng);
    actions.push(m);
    const r = submitMove(s, m, { draw: () => 0.99 });
    if (!r.requestAccepted) throw Error(r.message);
    s = r.state;
    validateState(s);
  }
  const subs = Object.values(s.simulation!.subjects).filter(
    (x) => x.side === "white",
  );
  results.push({
    seed,
    ply: s.ply,
    counters: s.simulation!.counters,
    kingdom: s.simulation!.kingdoms.white,
    subjects: subs.map((x) => ({
      id: x.id,
      loyalty: x.loyalty,
      resentment: x.resentment,
    })),
    actions,
  });
  console.log(
    JSON.stringify({
      seed,
      ply: s.ply,
      kingdom: s.simulation!.kingdoms.white,
      disputes: s.simulation!.counters.disputes ?? 0,
      eligible: s.simulation!.counters.eligibleKingdomTurns ?? 0,
      harm: s.simulation!.counters.exposures,
      neglect: s.simulation!.counters.neglect,
    }),
  );
}
mkdirSync(".test-services/progression", { recursive: true });
writeFileSync(
  ".test-services/progression/probe.json",
  JSON.stringify(results, null, 2),
);
