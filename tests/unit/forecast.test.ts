import { expect, it } from "vitest";
import { createGameState, submitMove } from "@/lib/game";
import { agencyForecast } from "@/lib/rpg/agency";
import { v3Fixture } from "../progression-fixtures";
import { subjectAt } from "../fixtures";
import { getLegalMoves } from "@/lib/chess";
import { progression } from "@/lib/rpg/pressure";
const move = {
  from: [4, 3] as [number, number],
  to: [4, 0] as [number, number],
  side: "white" as const,
};
const fixture = () => {
  const s = v3Fixture([
    ["K", [7, 7]],
    ["k", [0, 7]],
    ["Q", [4, 3]],
    ["r", [0, 0]],
    ["p", [2, 1]],
  ]);
  Object.assign(subjectAt(s, move.from), { fear: 50, resentment: 40 });
  return s;
};
it("forecast matches resolver thresholds, consumes no RNG, and enforces guarantees", () => {
  const s = fixture(),
    snapshot = structuredClone(s),
    f = agencyForecast(s, move);
  expect(s).toEqual(snapshot);
  expect(f.refusal).toBeGreaterThan(0);
  expect(submitMove(s, move, { draw: () => f.refusal / 2 }).resolution).toBe(
    "refused",
  );
  const accepted = submitMove(s, move, { draw: () => f.refusal + 0.00001 });
  expect(accepted.turnConsumed).toBe(true);
  const refused = submitMove(s, move, { draw: () => 0 }).state;
  expect(agencyForecast(refused, move).guaranteed).toBe(true);
  expect(
    submitMove(refused, move, {
      draw: () => {
        throw Error("must not roll");
      },
    }).turnConsumed,
  ).toBe(true);
  const opening = createGameState(1);
  expect(
    agencyForecast(opening, { from: [6, 4], to: [4, 4], side: "white" })
      .refusal,
  ).toBe(0);
});
it("morale, cohesion, prestige, skill and power have appropriate bounded probability effects", () => {
  for (const field of [
    "morale",
    "skill",
    "power",
    "cohesion",
    "prestige",
  ] as const) {
    const low = fixture(),
      high = fixture();
    if (field === "cohesion" || field === "prestige") {
      low.simulation!.kingdoms.white[field] = 0;
      high.simulation!.kingdoms.white[field] = 100;
    } else {
      subjectAt(low, move.from)[field] = field === "morale" ? 0 : 1;
      subjectAt(high, move.from)[field] = field === "morale" ? 100 : 5;
    }
    const delta =
      agencyForecast(low, move).refusal - agencyForecast(high, move).refusal;
    expect(delta).toBeGreaterThanOrEqual(0);
    if (field === "power") expect(delta).toBe(0);
    else expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThanOrEqual(
      field === "skill" ? 0.005001 : field === "prestige" ? 0.010001 : 0.020001,
    );
    expect(getLegalMoves(low.board, ...move.from, true, low.rights)).toEqual(
      getLegalMoves(high.board, ...move.from, true, high.rights),
    );
  }
  const capture = { ...move, to: [2, 1] as [number, number] };
  const s = fixture(),
    f = agencyForecast(s, capture);
  subjectAt(s, move.from).skill = 1;
  expect(agencyForecast(s, capture).refusal).toBe(f.refusal);
  subjectAt(s, move.from).power = 1;
  expect(agencyForecast(s, capture).refusal - f.refusal).toBeCloseTo(0.005);
});
it("retreat and heroism occupy disjoint intervals with bounded budgets and one draw", () => {
  const s = fixture();
  Object.assign(subjectAt(s, move.from), { fear: 80, loyalty: 50 });
  const f = agencyForecast(s, move);
  expect(f.retreat).toBe(0.01);
  let draws = 0;
  const r = submitMove(s, move, {
    draw: () => {
      draws++;
      return f.refusal + 0.005;
    },
  });
  expect(r.resolution).toBe("autonomous");
  expect(draws).toBe(1);
  expect(progression(r.state).sides.white.retreats).toBe(1);
  progression(s).sides.white.retreats = 2;
  expect(agencyForecast(s, move).retreat).toBe(0);
  const hero = v3Fixture([
    ["K", [7, 7]],
    ["k", [0, 7]],
    ["R", [5, 0]],
    ["p", [1, 0]],
  ]);
  subjectAt(hero, [5, 0]).morale = 80;
  const m = {
      ...move,
      from: [5, 0] as [number, number],
      to: [4, 0] as [number, number],
    },
    g = agencyForecast(hero, m);
  expect(g.heroism).toBeGreaterThan(0);
  expect(
    submitMove(hero, m, { draw: () => g.refusal + g.retreat + g.heroism / 2 })
      .special,
  ).toBe(true);
});

it("en passant uses capture power rather than noncapture skill", () => {
  const s = v3Fixture([
    ["K", [7, 7]],
    ["k", [0, 7]],
    ["P", [3, 4]],
    ["p", [3, 3]],
    ["r", [2, 0]],
  ]);
  s.rights.enPassant = [2, 3];
  const sub = subjectAt(s, [3, 4]);
  Object.assign(sub, { fear: 50, resentment: 50, skill: 5, power: 5 });
  const m = {
    from: [3, 4] as [number, number],
    to: [2, 3] as [number, number],
    side: "white" as const,
  };
  const initial = agencyForecast(s, m).refusal;
  sub.skill = 1;
  expect(agencyForecast(s, m).refusal).toBe(initial);
  sub.power = 1;
  expect(agencyForecast(s, m).refusal - initial).toBeCloseTo(0.005);
  expect(submitMove(s, m, { draw: () => 0.99 }).state.board[3][3]).toBeNull();
});
