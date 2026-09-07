import { expect, it } from "vitest";
import { boardFixture, subjectAt } from "../fixtures";
import { activePlot, scheduleCourt } from "@/lib/rpg/conspiracy";
import { remember } from "@/lib/rpg/subjects";
import type { GameState } from "@/lib/game/types";
export function courtFixture() {
  const s = boardFixture(
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
  k.tyranny = 80;
  k.legitimacy = 25;
  const a = subjectAt(s, [5, 3]),
    b = subjectAt(s, [5, 5]);
  a.resentment = 90;
  a.loyalty = 20;
  a.ambition = 85;
  b.resentment = 80;
  b.loyalty = 30;
  remember(s, a, "coerced", a.id, 1, 12);
  return s;
}
const tick = (s: GameState, roll = 0, check = false) => {
  s.simulation!.kingdoms.white.ownTurnsCompleted++;
  s.ply += 2;
  s.revision++;
  scheduleCourt(s, "white", () => roll, check);
};
it("conspiracy requires all thresholds, coercion, proximity, and two consecutive turns", () => {
  for (const mutate of [
    (s: GameState) => {
      s.ply = 0;
    },
    (s: GameState) => {
      s.simulation!.kingdoms.white.tyranny = 59;
    },
    (s: GameState) => {
      s.simulation!.kingdoms.white.legitimacy = 41;
    },
    (s: GameState) => {
      subjectAt(s, [5, 3]).resentment = 74;
    },
    (s: GameState) => {
      subjectAt(s, [5, 3]).loyalty = 31;
    },
    (s: GameState) => {
      subjectAt(s, [5, 3]).ambition = 64;
    },
    (s: GameState) => {
      subjectAt(s, [5, 3]).memories = [];
    },
    (s: GameState) => {
      subjectAt(s, [5, 5]).resentment = 64;
    },
    (s: GameState) => {
      subjectAt(s, [5, 5]).loyalty = 41;
    },
  ]) {
    const s = courtFixture();
    mutate(s);
    tick(s);
    tick(s);
    expect(activePlot(s)).toBeUndefined();
  }
  const s = courtFixture();
  tick(s);
  expect(activePlot(s)).toBeUndefined();
  tick(s);
  expect(activePlot(s)?.stage).toBe("gathering");
});
it("three committed warnings and three response turns precede regicide with king retained", () => {
  const s = courtFixture();
  tick(s);
  tick(s);
  expect(s.events).toHaveLength(1);
  tick(s);
  expect(activePlot(s)?.stage).toBe("preparing");
  tick(s);
  expect(activePlot(s)?.stage).toBe("armed");
  expect(s.terminal).toBeNull();
  tick(s);
  expect(s.terminal).toEqual({
    reason: "regicide",
    winner: "black",
    terminalPly: s.ply,
  });
  expect(s.board[7][4]).toBe("K");
  expect(s.events).toHaveLength(4);
  const snapshot = structuredClone(s);
  tick(s);
  expect(s.events).toEqual(snapshot.events);
  expect(s.simulation!.plots).toEqual(snapshot.simulation!.plots);
});
it("forced failed attempt has no casualty and cannot repeat", () => {
  const s = courtFixture();
  for (let n = 0; n < 4; n++) tick(s);
  const before = JSON.stringify(s.board);
  tick(s, 0.99);
  expect(s.terminal).toBeNull();
  expect(JSON.stringify(s.board)).toBe(before);
  expect(s.events.at(-1)?.message).toContain("guard breaks");
  for (let n = 0; n < 5; n++) tick(s);
  expect(s.simulation!.plots).toHaveLength(1);
  expect(s.simulation!.counters.armedAttempts).toBe(1);
});
it("two loyal guards thwart; captured conspirators and separation thwart", () => {
  for (const mode of ["guards", "captured", "separated"]) {
    const s = courtFixture();
    for (let n = 0; n < 4; n++) tick(s);
    if (mode === "guards") {
      s.board[0][7] = "k";
      s.pieceIds[0][7] = s.pieceIds[0][4];
      s.board[0][4] = null;
      s.pieceIds[0][4] = null;
      const rook = subjectAt(s, [7, 0]);
      s.board[7][0] = null;
      s.pieceIds[7][0] = null;
      s.board[6][4] = "R";
      s.pieceIds[6][4] = rook.id;
      const guard = { ...structuredClone(rook), id: "test_guard" };
      s.simulation!.subjects[guard.id] = guard;
      s.board[7][5] = "R";
      s.pieceIds[7][5] = guard.id;
    } else if (mode === "captured") {
      subjectAt(s, [5, 5]).status = "captured";
      s.board[5][5] = null;
      s.pieceIds[5][5] = null;
    } else {
      const id = s.pieceIds[5][5];
      s.pieceIds[5][5] = null;
      s.board[5][5] = null;
      s.pieceIds[1][7] = id;
      s.board[1][7] = "N";
      tick(s, 0, true);
    }
    tick(s, 0, mode === "separated");
    expect(s.simulation!.plots[0].stage).toBe("thwarted");
    expect(s.terminal).toBeNull();
  }
});
it("check deferral expires after two own turns and missing warning cannot kill", () => {
  const s = courtFixture();
  for (let n = 0; n < 4; n++) tick(s);
  tick(s, 0, true);
  expect(activePlot(s)?.deferredTurns).toBe(1);
  tick(s, 0, true);
  expect(s.simulation!.plots[0].stage).toBe("thwarted");
  const t = courtFixture();
  for (let n = 0; n < 4; n++) tick(t);
  t.events.shift();
  tick(t);
  expect(t.terminal).toBeNull();
});
