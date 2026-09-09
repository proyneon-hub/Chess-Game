import { expect, it } from "vitest";
import { v4Fixture } from "../progression-fixtures";
import { subjectAt } from "../fixtures";
import { submitMove } from "@/lib/game";
import { relate, tickRelationships } from "@/lib/rpg/relationships";
import { remember } from "@/lib/rpg/subjects";
import {
  emitObservation,
  relationshipObservations,
  relationshipTransitions,
  type Observation,
} from "@/lib/rpg/observations";
import { progression } from "@/lib/rpg/pressure";
import { politicalDiagnostics } from "../../scripts/political-diagnostics";
import { boardChoice } from "../../scripts/board-policies";
import { seedRng } from "@/lib/rpg/rng";
const fixture = () =>
  v4Fixture(
    [
      ["K", [7, 7]],
      ["k", [0, 7]],
      ["Q", [4, 3]],
      ["R", [7, 0]],
      ["r", [0, 0]],
    ],
    40,
  );
it("a causally established dispute has a factual observation and relevant refusal wording only", () => {
  const s = fixture(),
    before = structuredClone(s),
    a = subjectAt(s, [4, 3]),
    b = subjectAt(s, [7, 0]);
  remember(s, a, "rival_friction", b.id, 1, 32);
  relate(s, a, b, -20);
  expect(relationshipTransitions(before, s, "white")).toEqual([
    {
      kind: "dispute",
      a: a.id < b.id ? a.id : b.id,
      b: a.id < b.id ? b.id : a.id,
    },
  ]);
  emitObservation(s, "white", relationshipObservations(before, s, "white"));
  expect(s.events.at(-1)!.message).toMatch(
    /queen at d4.*rook at a1|rook at a1.*queen at d4/,
  );
  const relevant = submitMove(
    s,
    { from: [4, 3], to: [4, 0], side: "white" },
    { draw: () => 0 },
  );
  expect(relevant.message).toContain("watch");
  expect(relevant.message).toContain("a1");
  const unrelated = submitMove(
    s,
    { from: [4, 3], to: [4, 4], side: "white" },
    { draw: () => 0 },
  );
  expect(unrelated.message).not.toContain("watch");
});
it("only real recovery produces reconciliation; capture, eviction and cap removal are silent", () => {
  const s = fixture(),
    a = subjectAt(s, [4, 3]),
    b = subjectAt(s, [7, 0]);
  remember(s, a, "rival_friction", b.id, 1, 32);
  relate(s, a, b, -20);
  const before = structuredClone(s);
  relate(s, a, b, 12, true);
  expect(relationshipObservations(before, s, "white")[0].message).toContain(
    "eases",
  );
  for (const reason of ["capture", "eviction", "cap"]) {
    const after = structuredClone(before);
    if (reason === "capture")
      after.simulation!.subjects[b.id].status = "captured";
    if (reason === "eviction")
      delete after.simulation!.subjects[a.id].relationships[b.id];
    if (reason === "cap") {
      after.simulation!.subjects[a.id].relationships[b.id].disputed = false;
      after.simulation!.subjects[b.id].relationships[a.id].disputed = false;
    }
    expect(relationshipTransitions(before, after, "white")).toEqual([]);
  }
  const separated = structuredClone(before);
  const x = separated.simulation!.subjects[a.id],
    y = separated.simulation!.subjects[b.id];
  x.relationships[y.id].score = y.relationships[x.id].score = -10;
  x.relationships[y.id].separatedTurns = y.relationships[x.id].separatedTurns =
    4;
  // Move the pair far apart in this explicitly constructed transition fixture.
  separated.pieceIds[4][3] = null;
  separated.pieceIds[1][6] = a.id;
  tickRelationships(separated, "white");
  expect(relationshipTransitions(before, separated, "white")[0].kind).toBe(
    "reconciliation",
  );
});
it("one deterministic selector shares side/subject cooldowns and never narrates opening", () => {
  const s = fixture(),
    id = subjectAt(s, [4, 3]).id;
  const choices: Observation[] = [
    "trust",
    "neglect",
    "reconciliation",
    "dispute",
  ].map((kind) => ({
    kind: kind as Observation["kind"],
    subjectId: id,
    square: [4, 3],
    message: kind,
  }));
  const rng = structuredClone(s.simulation!.rngState);
  emitObservation(s, "white", choices);
  expect(s.events.map((e) => e.message)).toEqual(["dispute"]);
  emitObservation(s, "white", choices);
  expect(s.events).toHaveLength(1);
  s.simulation!.kingdoms.white.ownTurnsCompleted = 4;
  emitObservation(s, "white", choices);
  expect(s.events.at(-1)!.message).toBe("reconciliation");
  s.simulation!.kingdoms.white.ownTurnsCompleted = 8;
  emitObservation(s, "white", choices);
  expect(s.events.at(-1)!.message).toBe("dispute");
  expect(s.simulation!.rngState).toEqual(rng);
  s.ply = 8;
  s.simulation!.kingdoms.white.ownTurnsCompleted = 20;
  emitObservation(s, "white", choices);
  expect(s.events).toHaveLength(3);
  expect(
    Object.keys(progression(s).subjects[id].ambient).length,
  ).toBeLessThanOrEqual(4);
});
it("actual leadership restraint produces sparse positive feedback without invented dialogue", () => {
  const s = fixture();
  const refused = submitMove(
    s,
    { from: [4, 3], to: [4, 0], side: "white" },
    { draw: () => 0 },
  ).state;
  const r = submitMove(refused, { from: [4, 3], to: [4, 4], side: "white" });
  expect(
    r.state.events.some((e) =>
      e.message.includes("settles after the change of orders"),
    ),
  ).toBe(true);
  expect(r.state.events.map((e) => e.message).join(" ")).not.toMatch(
    /loyalty|resentment|[0-9]%|"/,
  );
});
it("transition diagnostics are read-only and board policies cannot depend on hidden politics", () => {
  const s = fixture(),
    m = {
      from: [4, 3] as [number, number],
      to: [4, 0] as [number, number],
      side: "white" as const,
    },
    result = submitMove(s, m, { draw: () => 0.99 });
  const before = JSON.stringify([s, result]);
  politicalDiagnostics(s, m, result);
  expect(JSON.stringify([s, result])).toBe(before);
  const changed = structuredClone(s);
  for (const sub of Object.values(changed.simulation!.subjects)) {
    sub.loyalty = 0;
    sub.fear = 100;
    sub.resentment = 100;
    sub.personality = "ambitious";
  }
  for (const policy of [
    "board-ordinary",
    "board-protective",
    "board-mistreatment",
  ] as const)
    expect(boardChoice(s, seedRng(45), policy)).toEqual(
      boardChoice(changed, seedRng(45), policy),
    );
});
