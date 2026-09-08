import { expect, it } from "vitest";
import { submitMove, createGameState } from "@/lib/game";
import { assessOrder, derivePoliticalFacts } from "@/lib/rpg/facts";
import { progression } from "@/lib/rpg/pressure";
import { subjectAt } from "../fixtures";
import { v3Fixture } from "../progression-fixtures";
import { validateState } from "@/lib/game/validation";
import { numericSubjectFields } from "@/lib/rpg/subjects";
import { cohesionRecovery, prestigeConfidence } from "@/lib/rpg/leadershipV3";
const fixture = () =>
  v3Fixture([
    ["K", [7, 7]],
    ["k", [0, 7]],
    ["Q", [4, 3]],
    ["r", [0, 0]],
    ["R", [7, 1]],
    ["P", [6, 2]],
    ["p", [1, 6]],
  ]);
const execute = (
  s: ReturnType<typeof createGameState>,
  from: [number, number],
  to: [number, number],
) => {
  const r = submitMove(
    s,
    { from, to, side: s.sideToMove },
    { draw: () => 0.99 },
  );
  expect(r.turnConsumed).toBe(true);
  validateState(r.state);
  return r.state;
};
it("obeyed avoidable exposure changes trust without prior refusal, then repeated neglect has one episode", () => {
  const before = fixture(),
    id = before.pieceIds[4][3]!;
  let s = execute(before, [4, 3], [4, 0]);
  expect(s.pendingRefusal).toBeNull();
  expect(s.simulation!.subjects[id].loyalty).toBe(
    before.simulation!.subjects[id].loyalty - 2,
  );
  expect(s.simulation!.subjects[id].resentment).toBe(
    before.simulation!.subjects[id].resentment + 5,
  );
  expect(s.simulation!.kingdoms.white.tyranny).toBe(10);
  expect(s.simulation!.plots).toHaveLength(0);
  const episode = progression(s).subjects[id].episodes[0].id;
  s = execute(s, [0, 0], [1, 0]);
  s = execute(s, [6, 2], [5, 2]);
  expect(progression(s).subjects[id].episodes[0].id).toBe(episode);
  expect(progression(s).subjects[id].episodes[0].causes).toContain(
    "neglected_under_threat",
  );
  expect(s.simulation!.counters.neglect).toBe(1);
  s = execute(s, [1, 0], [2, 0]);
  s = execute(s, [5, 2], [4, 2]);
  expect(s.simulation!.counters.neglect).toBe(1);
});
it("check-giving sacrifices, check escapes, promotion and positive exchanges are exempt from blame", () => {
  const s = fixture();
  expect(
    assessOrder(s, { from: [4, 3], to: [0, 3], side: "white" }).exempt,
  ).toBe(true);
  const capture = v3Fixture([
    ["K", [7, 7]],
    ["k", [0, 7]],
    ["R", [4, 3]],
    ["q", [4, 0]],
    ["r", [0, 0]],
  ]);
  const result = execute(capture, [4, 3], [4, 0]);
  expect(result.simulation!.counters.exposures ?? 0).toBe(0);
  expect(
    assessOrder(capture, { from: [4, 3], to: [4, 0], side: "white" }).residual,
  ).toBe(0);
  const check = v3Fixture([
    ["K", [7, 7]],
    ["k", [0, 6]],
    ["Q", [4, 3]],
    ["r", [7, 0]],
    ["r", [0, 0]],
  ]);
  const rescued = execute(check, [4, 3], [7, 3]);
  expect(rescued.simulation!.counters.exposures ?? 0).toBe(0);
  const promotion = v3Fixture([
    ["K", [7, 7]],
    ["k", [0, 6]],
    ["P", [1, 0]],
    ["r", [0, 3]],
  ]);
  expect(
    assessOrder(promotion, {
      from: [1, 0],
      to: [0, 0],
      side: "white",
      promotion: "n",
    }).exempt,
  ).toBe(true);
});
it("quick danger/rescue oscillation yields no rescue reward and facts are pure", () => {
  const initial = fixture();
  let s = execute(initial, [4, 3], [4, 0]);
  s = execute(s, [0, 0], [1, 0]);
  s = execute(s, [4, 0], [4, 3]);
  s = execute(s, [1, 0], [2, 0]);
  s = execute(s, [6, 2], [5, 2]);
  expect(s.simulation!.counters.rescues ?? 0).toBe(0);
  const before = JSON.stringify(initial);
  derivePoliticalFacts(initial, s, { from: [4, 3], to: [4, 0], side: "white" });
  expect(JSON.stringify(initial)).toBe(before);
});
it("all combined action deltas stay within v3 caps and opening has no adverse accumulation", () => {
  let s = createGameState(3);
  const initial = structuredClone(s);
  const moves = [
    [
      [6, 4],
      [4, 4],
    ],
    [
      [1, 4],
      [3, 4],
    ],
    [
      [7, 6],
      [5, 5],
    ],
    [
      [0, 1],
      [2, 2],
    ],
    [
      [7, 5],
      [4, 2],
    ],
    [
      [0, 6],
      [2, 5],
    ],
    [
      [6, 3],
      [5, 3],
    ],
    [
      [0, 5],
      [3, 2],
    ],
  ] as [number, number][][];
  for (const [from, to] of moves) s = execute(s, from, to);
  for (const [id, sub] of Object.entries(s.simulation!.subjects))
    for (const field of numericSubjectFields)
      expect(sub[field]).toBe(initial.simulation!.subjects[id][field]);
  expect(
    Object.values(progression(s).subjects).flatMap((q) => q.episodes),
  ).toHaveLength(0);
  s = execute(s, [7, 1], [5, 2]);
  expect(s.simulation!.counters.neglect ?? 0).toBe(0);
  expect(s.simulation!.counters.repeatedRisk ?? 0).toBe(0);
  expect(s.simulation!.counters.ambient ?? 0).toBe(0);
  const before = fixture(),
    after = execute(before, [4, 3], [4, 0]);
  for (const [id, sub] of Object.entries(after.simulation!.subjects))
    for (const field of numericSubjectFields)
      expect(
        Math.abs(sub[field] - before.simulation!.subjects[id][field]),
      ).toBeLessThanOrEqual(12);
  for (const side of ["white", "black"] as const)
    for (const field of [
      "tyranny",
      "legitimacy",
      "cohesion",
      "prestige",
    ] as const)
      expect(
        Math.abs(
          after.simulation!.kingdoms[side][field] -
            before.simulation!.kingdoms[side][field],
        ),
      ).toBeLessThanOrEqual(6);
});
it("cohesion and prestige have bounded recovery/event consumers", () => {
  expect(cohesionRecovery(0)).toBe(-1);
  expect(cohesionRecovery(100)).toBe(1);
  expect(prestigeConfidence(0)).toBe(-2);
  expect(prestigeConfidence(100)).toBe(2);
  const test = (prestige: number) => {
    const s = v3Fixture([
      ["K", [7, 7]],
      ["k", [0, 7]],
      ["R", [4, 3]],
      ["q", [4, 0]],
    ]);
    s.simulation!.kingdoms.white.prestige = prestige;
    return subjectAt(execute(s, [4, 3], [4, 0]), [4, 0]).morale;
  };
  expect(test(100) - test(0)).toBe(4);
});
