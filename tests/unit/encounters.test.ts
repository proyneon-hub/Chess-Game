import { expect, it } from "vitest";
import { createGameState, getAllLegalMoves, submitMove } from "@/lib/game";
import type { GameState, MoveAttempt } from "@/lib/game/types";
import { encounters } from "@/lib/rpg/encounters/state";
import {
  responseMoves,
  evaluateObjective,
  projectBoard,
} from "@/lib/rpg/encounters/objectives";
import { publicState } from "@/lib/game/publicState";
import { validateState } from "@/lib/game/validation";
import { recordTurn, undoTurn } from "@/lib/game/undo";
import { agencyForecast } from "@/lib/rpg/agency";
import { leadershipView, materializeView } from "@/lib/ai/leadershipView";
import { boardChoice } from "../../scripts/board-policies";
import { seedRng } from "@/lib/rpg/rng";
function discovery(seed = 42) {
  const rng = seedRng(seed);
  let s = createGameState(seed);
  while (s.ply < 18 && s.status === "active" && !encounters(s).active.length) {
    const r = submitMove(s, boardChoice(s, rng, "board-protective"));
    expect(r.accepted).toBe(true);
    s = r.state;
    if (s.ply <= 8) {
      expect(publicState(s).encounters).toEqual([]);
      expect(r.special).toBe(false);
      expect(encounters(s).sides.white.harms).toEqual([]);
      expect(encounters(s).sides.black.harms).toEqual([]);
    }
  }
  expect(encounters(s).active.length).toBeGreaterThan(0);
  return s;
}
it("offers actionable normal-start opportunities, both colors get full windows", () => {
  for (const seed of [1, 2, 42, 77, 300001]) {
    let s = discovery(seed);
    const initial = encounters(s).active[0];
    expect(initial.createdPly).toBeGreaterThanOrEqual(10);
    expect(initial.deadline - initial.createdOwn).toBe(3);
    if (s.sideToMove !== initial.side)
      s = submitMove(s, getAllLegalMoves(s.board, s.sideToMove, s.rights)[0], {
        draw: () => 0.99,
      }).state;
    const e = encounters(s).active.find((e) => e.id === initial.id);
    if (!e) continue;
    const moves = responseMoves(s, e.side, e.objective);
    expect(moves.length).toBeGreaterThan(0);
    const before = structuredClone(s),
      result = submitMove(s, moves[0], { draw: () => 0.99 });
    expect(
      encounters(result.state).recent.find((x) => x.id === e.id)?.outcome,
    ).toBe("fulfilled");
    expect(
      encounters(result.state).recent.find((x) => x.id === e.id)?.effective,
    ).toBe(true);
    expect(s).toEqual(before);
    expect(submitMove(s, moves[0], { draw: () => 0.99 })).toEqual(result);
    validateState(result.state);
  }
});
it("neutral expiry waits for three eligible own moves and creates no card penalty", () => {
  let s = discovery(42);
  const original = encounters(s).active[0];
  while (
    s.status === "active" &&
    encounters(s).active.some((e) => e.id === original.id)
  ) {
    const e = encounters(s).active.find((e) => e.id === original.id)!;
    const move = getAllLegalMoves(s.board, s.sideToMove, s.rights).find(
      (m) =>
        m.side !== e.side ||
        !evaluateObjective(s, projectBoard(s, m), m, e.objective).success,
    )!;
    expect(move).toBeDefined();
    s = submitMove(s, move, { draw: () => 0.99 }).state;
    const own = s.simulation!.kingdoms[e.side].ownTurnsCompleted;
    if (own < e.deadline)
      expect(encounters(s).recent.find((x) => x.id === e.id)?.outcome).not.toBe(
        "expired",
      );
  }
  const closed = encounters(s).recent.find((e) => e.id === original.id)!;
  expect(["expired", "interrupted"]).toContain(closed.outcome);
  expect(closed.consumed).toEqual([]);
});
it("restores all effects, director clocks and RNG on undo; repeated forecasts are pure", () => {
  const s = discovery(42),
    m = getAllLegalMoves(s.board, s.sideToMove, s.rights)[0],
    before = structuredClone(s);
  expect(agencyForecast(s, m)).toEqual(agencyForecast(s, m));
  expect(s).toEqual(before);
  const r = submitMove(s, m, { draw: () => 0.99 }),
    history = recordTurn({ start: s, completed: [] }, r);
  expect(undoTurn(history, r.state).game).toEqual(s);
});
it("own AI projection retains own requests and no enemy private encounter records", () => {
  let s = discovery(42);
  while (s.ply < 24)
    s = submitMove(s, getAllLegalMoves(s.board, s.sideToMove, s.rights)[0], {
      draw: () => 0.99,
    }).state;
  const view = materializeView(leadershipView(s, "white"));
  expect(encounters(view).active.every((e) => e.side === "white")).toBe(true);
  expect(encounters(view).recent.every((e) => e.side === "white")).toBe(true);
  expect(encounters(view).sides.black.harms).toEqual([]);
  for (const [id, sub] of Object.entries(view.simulation!.subjects))
    if (sub.side === "black")
      expect(encounters(view).subjects[id].warningOwn).toBeNull();
});
it("rejects malformed nested objectives and modifier state", () => {
  const s = discovery();
  for (const mutate of [
    (x: GameState) => {
      encounters(x).active[0].deadline = -1;
    },
    (x: GameState) => {
      encounters(x).active[0].participants = ["private-injected"];
    },
    (x: GameState) => {
      encounters(x).subjects[
        Object.keys(encounters(x).subjects)[0]
      ].dangerTurns = [2, 1];
    },
  ]) {
    const copy = structuredClone(s);
    mutate(copy);
    expect(() => validateState(copy)).toThrow();
  }
});
