import { expect, it } from "vitest";
import { v5Fixture } from "../encounter-fixtures";
import { subjectAt } from "../fixtures";
import { submitMove } from "@/lib/game";
import { encounters } from "@/lib/rpg/encounters/state";
import {
  effectiveDefenders,
  evaluateObjective,
  projectBoard,
  defensiveWards,
} from "@/lib/rpg/encounters/objectives";
import { agencyForecast } from "@/lib/rpg/agency";
import { validateState } from "@/lib/game/validation";
import type { Encounter, Objective } from "@/lib/rpg/encounters/types";
import type { GameState, MoveAttempt } from "@/lib/game/types";
function offer(
  s: GameState,
  id: string,
  objective: Objective,
  family: Encounter["family"] = "protection",
) {
  const e: Encounter = {
    id: "encounter-1",
    family,
    phase: 2,
    side: "white",
    participants: [id],
    causes: [],
    createdPly: 20,
    createdOwn: 0,
    deadline: 3,
    objective,
    stage: 1,
    stageOwn: 0,
    outcome: "active",
    consumed: [],
    parent: null,
    interacted: false,
    effective: false,
  };
  encounters(s).active = [e];
  encounters(s).serial = 1;
  return e;
}
it("capturing the actual attacker fulfills protection and creates a usable, one-use helper token", () => {
  const s = v5Fixture(
      [
        ["K", [7, 7]],
        ["k", [0, 7]],
        ["R", [4, 0]],
        ["N", [5, 2]],
        ["p", [3, 1]],
      ],
      20,
    ),
    id = s.pieceIds[4][0]!;
  Object.assign(subjectAt(s, [4, 0]), {
    fear: 70,
    resentment: 70,
    loyalty: 20,
  });
  offer(s, id, {
    kind: "protect",
    subject: id,
    initialLoss: 500,
    defenders: effectiveDefenders(s, id),
  });
  const protectedState = submitMove(
    s,
    { side: "white", from: [5, 2], to: [3, 1] },
    { draw: () => 0.99 },
  ).state;
  expect(encounters(protectedState).recent[0].outcome).toBe("fulfilled");
  expect(
    encounters(protectedState).modifiers.some((m) => m.kind === "support"),
  ).toBe(true);
  // Recreate the same threat after an earlier rewarded rescue: the response
  // still closes the request, but cannot mint another bonus for oscillation.
  const repeated = structuredClone(s);
  repeated.simulation!.subjects[id].memories = structuredClone(
    protectedState.simulation!.subjects[id].memories,
  );
  const repeatedResult = submitMove(
    repeated,
    { side: "white", from: [5, 2], to: [3, 1] },
    { draw: () => 0.99 },
  ).state;
  expect(encounters(repeatedResult).recent[0].outcome).toBe("fulfilled");
  expect(encounters(repeatedResult).modifiers).toEqual([]);
  const ready = submitMove(
    protectedState,
    { side: "black", from: [0, 7], to: [0, 6] },
    { draw: () => 0.99 },
  ).state;
  const m: MoveAttempt = { side: "white", from: [4, 0], to: [5, 0] },
    f = agencyForecast(ready, m);
  expect(f.contributions.encounterApplied).toBeCloseTo(-0.03);
  const invalid = submitMove(ready, { ...m, to: [5, 1] });
  expect(invalid.accepted).toBe(false);
  expect(invalid.state).toBe(ready);
  const refused = submitMove(ready, m, { draw: () => 0 });
  expect(refused.resolution).toBe("refused");
  expect(encounters(refused.state).modifiers).toEqual(
    encounters(ready).modifiers,
  );
  const done = submitMove(ready, m, { draw: () => 0.99 });
  expect(
    encounters(done.state).modifiers.filter((x) => x.kind === "support"),
  ).toEqual([]);
  expect(done.state.simulation!.counters["modifierApplied:support"]).toBe(1);
  validateState(done.state);
});
it("relief requires another piece to assume an actual defensive duty", () => {
  const s = v5Fixture(
      [
        ["K", [7, 7]],
        ["k", [0, 7]],
        ["R", [7, 0]],
        ["B", [4, 0]],
        ["r", [0, 0]],
        ["Q", [6, 1]],
        ["P", [6, 6]],
      ],
      20,
    ),
    id = s.pieceIds[7][0]!;
  subjectAt(s, [7, 0]).fatigue = 12;
  const objective: Objective = {
    kind: "relieve",
    subject: id,
    initialLoss: 0,
    defenders: [],
    wards: defensiveWards(s, id),
  };
  expect(objective.wards).toContain(s.pieceIds[4][0]);
  offer(s, id, objective, "relief");
  const unrelated: MoveAttempt = { side: "white", from: [6, 6], to: [5, 6] };
  expect(
    evaluateObjective(s, projectBoard(s, unrelated), unrelated, objective)
      .success,
  ).toBe(false);
  const helping: MoveAttempt = { side: "white", from: [6, 1], to: [6, 0] };
  expect(
    evaluateObjective(s, projectBoard(s, helping), helping, objective).success,
  ).toBe(true);
  const r = submitMove(s, helping, { draw: () => 0.99 });
  expect(encounters(r.state).recent[0].outcome).toBe("fulfilled");
  expect(encounters(r.state).modifiers[0].helper).toBe(s.pieceIds[6][1]);
  validateState(r.state);
});
it("an already-removed threat cannot award protection on an unrelated later move", () => {
  const s = v5Fixture(
      [
        ["K", [7, 7]],
        ["k", [0, 7]],
        ["R", [4, 0]],
        ["P", [6, 6]],
      ],
      20,
    ),
    id = s.pieceIds[4][0]!;
  const objective: Objective = {
      kind: "protect",
      subject: id,
      initialLoss: 500,
      defenders: [],
    },
    m: MoveAttempt = { side: "white", from: [6, 6], to: [5, 6] };
  expect(evaluateObjective(s, projectBoard(s, m), m, objective).success).toBe(
    false,
  );
});

it("Black receives three complete response moves and success wins over final-turn expiry", () => {
  let s = v5Fixture(
    [
      ["K", [7, 7]],
      ["k", [0, 7]],
      ["n", [0, 1]],
      ["R", [7, 0]],
    ],
    20,
  );
  s.sideToMove = "black";
  s.simulation!.turnContext.sideToMove = "black";
  const id = s.pieceIds[0][1]!,
    e = offer(s, id, { kind: "confidence", subject: id }, "confidence");
  e.side = "black";
  for (const m of [
    { side: "black", from: [0, 7], to: [0, 6] },
    { side: "white", from: [7, 7], to: [7, 6] },
    { side: "black", from: [0, 6], to: [0, 5] },
    { side: "white", from: [7, 6], to: [7, 5] },
  ] as MoveAttempt[]) {
    const r = submitMove(s, m, { draw: () => 0.99 });
    expect(r.turnConsumed).toBe(true);
    s = r.state;
    expect(encounters(s).active.some((x) => x.id === e.id)).toBe(true);
  }
  const r = submitMove(
    s,
    { side: "black", from: [0, 1], to: [2, 2] },
    { draw: () => 0.99 },
  );
  expect(encounters(r.state).recent.find((x) => x.id === e.id)?.outcome).toBe(
    "fulfilled",
  );
  expect(r.state.simulation!.kingdoms.black.ownTurnsCompleted).toBe(3);
  validateState(r.state);
});
