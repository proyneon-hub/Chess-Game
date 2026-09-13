import type { GameState } from "@/lib/game/types";
import { v4Fixture, constructedV4Court } from "./progression-fixtures";
import { initializeSimulation } from "@/lib/rpg/initialize";
import { initialEncounters } from "@/lib/rpg/encounters/state";
// Preloaded fixtures test branch correctness only, never natural frequency.
export function v5Fixture(...args: Parameters<typeof v4Fixture>): GameState {
  const s = v4Fixture(...args) as GameState;
  return {
    ...s,
    schemaVersion: 5,
    rulesetVersion: "hidden-kingdom-v5",
    configVersion: "2026-09-10.1",
    simulation: {
      ...initializeSimulation(s.board, s.pieceIds, 42, "2026-09-10.1"),
      turnContext: {
        ply: s.ply,
        sideToMove: s.sideToMove,
        refusalUsed: false,
        pendingRefusal: null,
      },
    },
  } as GameState;
}
export function constructedV5Court(): GameState {
  const old = constructedV4Court(),
    s = {
      ...old,
      schemaVersion: 5,
      rulesetVersion: "hidden-kingdom-v5",
      configVersion: "2026-09-10.1",
      ply: 70,
    } as GameState;
  const sim = old.simulation!;
  s.simulation = {
    ...sim,
    schemaVersion: 5,
    rulesetVersion: "hidden-kingdom-v5",
    configVersion: s.configVersion,
    progression: (sim as Extract<typeof sim, { schemaVersion: 4 }>).progression,
    encounters: initialEncounters(sim.subjects),
  };
  s.simulation.turnContext.ply = 70;
  return s;
}
