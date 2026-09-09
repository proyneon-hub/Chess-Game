import { boardFixture } from "./fixtures";
import { initializeSimulation } from "@/lib/rpg/initialize";
export function v3Fixture(...args: Parameters<typeof boardFixture>) {
  const s = boardFixture(...args);
  s.schemaVersion = 3;
  s.rulesetVersion = "hidden-kingdom-v3";
  s.configVersion = "2026-09-08.1";
  s.simulation = initializeSimulation(s.board, s.pieceIds, 42, s.configVersion);
  s.simulation.turnContext.ply = s.ply;
  return s;
}

import { subjectAt } from "./fixtures";
import { progression } from "@/lib/rpg/pressure";
// Hostile branch fixture, never counted as natural occurrence.
export function constructedV3Court() {
  const s = v3Fixture(
    [
      ["K", [7, 4]],
      ["k", [0, 4]],
      ["B", [5, 3]],
      ["N", [5, 5]],
      ["R", [7, 0]],
      ["r", [0, 0]],
    ],
    40,
  );
  const k = s.simulation!.kingdoms.white;
  k.ownTurnsCompleted = 10;
  k.tyranny = 60;
  k.legitimacy = 40;
  for (const sq of [
    [5, 3],
    [5, 5],
  ] as [number, number][]) {
    const sub = subjectAt(s, sq);
    Object.assign(sub, { loyalty: 35, resentment: 70, ambition: 80 });
    progression(s).subjects[sub.id].episodes = [7, 9].map((turn) => ({
      id: `${sub.id}:${turn}`,
      subjectId: sub.id,
      cause: "coerced",
      openedOwnTurn: turn,
      lastAppliedOwnTurn: turn,
      squareAtOpening: sq,
      attackerIds: [],
      defenderIds: [],
      sourceActionRevision: turn,
      closedOwnTurn: turn,
      rewarded: false,
      causes: ["coerced"],
    }));
  }
  s.revision = 10;
  return s;
}

export function v4Fixture(...args: Parameters<typeof v3Fixture>) {
  const s = v3Fixture(...args);
  s.schemaVersion = 4;
  s.rulesetVersion = "hidden-kingdom-v4";
  s.configVersion = "2026-09-09.1";
  s.simulation = initializeSimulation(s.board, s.pieceIds, 42, s.configVersion);
  s.simulation.turnContext.ply = s.ply;
  return s;
}
export function constructedV4Court() {
  const s = constructedV3Court();
  s.schemaVersion = 4;
  s.rulesetVersion = "hidden-kingdom-v4";
  s.configVersion = "2026-09-09.1";
  s.simulation = {
    ...s.simulation!,
    schemaVersion: 4,
    rulesetVersion: "hidden-kingdom-v4",
    configVersion: s.configVersion,
    progression: progression(s),
  };
  for (const q of Object.values(progression(s).subjects)) q.hazard = null;
  return s;
}
