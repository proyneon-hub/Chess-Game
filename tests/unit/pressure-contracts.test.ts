import { expect, it } from "vitest";
import { v3Fixture } from "../progression-fixtures";
import { subjectAt } from "../fixtures";
import { createGameState, submitMove } from "@/lib/game";
import type { GameState, MoveAttempt } from "@/lib/game/types";
import type { Square } from "@/lib/chess";
import { relate } from "@/lib/rpg/relationships";
import { progression } from "@/lib/rpg/pressure";
import { derivePoliticalFacts } from "@/lib/rpg/facts";
import { numericSubjectFields, remember } from "@/lib/rpg/subjects";
import { recordTurn, undoTurn } from "@/lib/game/undo";
import { agencyForecast } from "@/lib/rpg/agency";
import { ownPolitics } from "@/lib/ai/politicalEvaluation";
import { materializeView } from "@/lib/ai/leadershipView";

// Constructed edge cases; these are not naturally occurring gameplay evidence.
function episode(s: GameState, sq: Square, own = 0) {
  const id = s.pieceIds[sq[0]][sq[1]]!;
  progression(s).subjects[id].episodes.push({
    id: `${id}:fixture`,
    subjectId: id,
    cause: "avoidable_exposure",
    openedOwnTurn: own,
    lastAppliedOwnTurn: own,
    squareAtOpening: sq,
    attackerIds: [],
    defenderIds: [],
    sourceActionRevision: 0,
    closedOwnTurn: null,
    rewarded: false,
    causes: ["avoidable_exposure"],
  });
  return progression(s).subjects[id].episodes[0];
}
function go(s: GameState, from: Square, to: Square) {
  const r = submitMove(
    s,
    { from, to, side: s.sideToMove },
    { draw: () => 0.99 },
  );
  expect(r.turnConsumed).toBe(true);
  return r.state;
}
it("neglect selects at most two stable IDs and requires a persistent avoidable threat", () => {
  const s = v3Fixture([
    ["K", [7, 7]],
    ["k", [0, 7]],
    ["Q", [4, 0]],
    ["Q", [4, 2]],
    ["Q", [4, 4]],
    ["r", [0, 0]],
    ["r", [0, 2]],
    ["r", [0, 4]],
    ["P", [6, 6]],
  ]);
  for (const sq of [
    [4, 0],
    [4, 2],
    [4, 4],
  ] as Square[])
    episode(s, sq);
  const m: MoveAttempt = { from: [6, 6], to: [5, 6], side: "white" };
  const after = go(s, m.from, m.to);
  const neglected = derivePoliticalFacts(s, after, m).filter(
    (f) => f.kind === "neglect",
  );
  const expected = [s.pieceIds[4][0], s.pieceIds[4][2], s.pieceIds[4][4]]
    .sort()
    .slice(0, 2);
  expect(neglected.map((f) => f.subjectId)).toEqual(expected);
  expect(after.simulation!.counters.neglect).toBe(2);
  const reversed = structuredClone(s);
  reversed.simulation!.subjects = Object.fromEntries(
    Object.entries(reversed.simulation!.subjects).reverse(),
  );
  expect(derivePoliticalFacts(reversed, after, m)).toEqual(
    derivePoliticalFacts(s, after, m),
  );
  const safe = structuredClone(after);
  safe.board[0][0] = safe.board[0][2] = safe.board[0][4] = null;
  expect(
    derivePoliticalFacts(s, safe, m).some((f) => f.kind === "neglect"),
  ).toBe(false);
});
it("moving defenders, changing attackers and alternating exposed squares retain one episode", () => {
  let s = v3Fixture([
    ["K", [7, 7]],
    ["k", [0, 7]],
    ["Q", [4, 3]],
    ["r", [0, 0]],
    ["r", [0, 1]],
    ["B", [7, 3]],
    ["P", [6, 6]],
  ]);
  s = go(s, [4, 3], [4, 0]);
  const id = s.pieceIds[4][0]!,
    original = progression(s).subjects[id].episodes[0].id;
  s = go(s, [0, 0], [1, 0]);
  s = go(s, [7, 3], [6, 4]);
  s = go(s, [1, 0], [2, 0]);
  s = go(s, [4, 0], [4, 1]);
  expect(progression(s).subjects[id].episodes.map((e) => e.id)).toEqual([
    original,
  ]);
  const invalid = submitMove(s, { from: [4, 1], to: [4, 1], side: "black" });
  expect(invalid.requestAccepted).toBe(false);
  expect(invalid.state).toEqual(s);
});
it("protection cannot repeat its reward when the same defender returns against the same attacker", () => {
  let s = v3Fixture([
    ["K", [7, 7]],
    ["k", [0, 7]],
    ["R", [4, 0]],
    ["r", [0, 0]],
    ["B", [7, 1]],
    ["P", [6, 6]],
    ["p", [1, 6]],
  ]);
  s = go(s, [7, 1], [6, 2]); // bishop now defends a4, reducing the exchange loss
  expect(s.simulation!.counters.protections).toBe(1);
  const protectedState = structuredClone(s);
  s = go(s, [1, 6], [2, 6]);
  s = go(s, [6, 2], [7, 1]);
  s = go(s, [2, 6], [3, 6]);
  s = go(s, [6, 6], [5, 6]);
  s = go(s, [0, 7], [0, 6]);
  s = go(s, [5, 6], [4, 6]);
  s = go(s, [0, 6], [0, 7]);
  s = go(s, [7, 1], [6, 2]);
  expect(s.simulation!.counters.protections).toBe(
    protectedState.simulation!.counters.protections,
  );
});
it("capture witnesses use their own clock, history expires on that side, and combined deltas remain capped", () => {
  const s = v3Fixture(
    [
      ["K", [7, 7]],
      ["k", [0, 7]],
      ["R", [4, 0]],
      ["q", [4, 3]],
      ["b", [3, 4]],
      ["n", [5, 4]],
    ],
    40,
  );
  s.simulation!.kingdoms.white.ownTurnsCompleted = 20;
  s.simulation!.kingdoms.black.ownTurnsCompleted = 5;
  const victim = subjectAt(s, [4, 3]),
    witness = subjectAt(s, [3, 4]);
  episode(s, [4, 3], 4);
  relate(s, witness, victim, 10);
  remember(s, witness, "expires", victim.id, 1, 1);
  const after = go(s, [4, 0], [4, 3]);
  expect(progression(after).subjects[victim.id].episodes[0].closedOwnTurn).toBe(
    5,
  );
  expect(progression(after).subjects[witness.id].lastHarm).toBe(5);
  expect(
    after.simulation!.subjects[witness.id].memories.find(
      (m) => m.type === "ally_lost",
    )?.createdOwnTurn,
  ).toBe(5);
  expect(
    after.simulation!.subjects[witness.id].memories.some(
      (m) => m.type === "expires",
    ),
  ).toBe(true);
  for (const [id, sub] of Object.entries(after.simulation!.subjects))
    for (const field of numericSubjectFields)
      expect(
        Math.abs(sub[field] - s.simulation!.subjects[id][field]),
      ).toBeLessThanOrEqual(12);
  const done = go(after, [0, 7], [1, 7]);
  expect(
    done.simulation!.subjects[witness.id].memories.some(
      (m) => m.type === "expires",
    ),
  ).toBe(false);
});
it("undo restores episodes, RNG and ambient cooldowns for deterministic replay", () => {
  const s = v3Fixture([
    ["K", [7, 7]],
    ["k", [0, 7]],
    ["Q", [4, 3]],
    ["r", [0, 0]],
  ]);
  const m: MoveAttempt = { from: [4, 3], to: [4, 0], side: "white" };
  const r = submitMove(s, m, { draw: () => 0.99 });
  const h = recordTurn({ start: s, completed: [] }, r);
  const restored = undoTurn(h, r.state).game;
  expect(restored).toEqual(s);
  expect(submitMove(restored, m, { draw: () => 0.99 })).toEqual(r);
});
it("AI and resolver share non-guaranteed forecasts, calm caps and check guarantees without private enemy input", () => {
  const s = v3Fixture([
    ["K", [7, 7]],
    ["k", [0, 7]],
    ["Q", [4, 3]],
    ["r", [0, 0]],
  ]);
  const m: MoveAttempt = { from: [4, 3], to: [4, 0], side: "white" };
  Object.assign(subjectAt(s, m.from), {
    fear: 80,
    resentment: 40,
    loyalty: 50,
  });
  const view = ownPolitics(s, "white")!.view!,
    saved = structuredClone(s);
  expect(JSON.stringify(view)).not.toContain("rngState");
  expect(agencyForecast(materializeView(view), m)).toEqual(
    agencyForecast(s, m),
  );
  expect(agencyForecast(s, m).guaranteed).toBe(false);
  expect(s).toEqual(saved);
  const check = v3Fixture([
    ["K", [7, 7]],
    ["k", [0, 7]],
    ["Q", [4, 3]],
    ["r", [7, 0]],
  ]);
  expect(agencyForecast(check, { ...m, to: [7, 3] }).guaranteed).toBe(true);
  const calm = createGameState(1);
  calm.ply = 16;
  calm.simulation!.turnContext.ply = 16;
  expect(
    agencyForecast(calm, { from: [6, 4], to: [4, 4], side: "white" }).refusal,
  ).toBeLessThanOrEqual(0.008);
});
