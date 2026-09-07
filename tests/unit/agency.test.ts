import { expect, it } from "vitest";
import { createGameState, submitMove } from "@/lib/game";
import { boardFixture, scripted, subjectAt } from "../fixtures";
import { refusalProbability } from "@/lib/rpg/agency";
import { recordTurn, undoTurn } from "@/lib/game/undo";
it("opening suppression consumes no gameplay draws for eight plies", () => {
  let s = createGameState(3);
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
  ];
  for (const [from, to] of moves) {
    const r = submitMove(
      s,
      {
        from: from as [number, number],
        to: to as [number, number],
        side: s.sideToMove,
      },
      {
        draw: () => {
          throw Error("opening roll");
        },
      },
    );
    expect(r.resolution).toBe("executed");
    s = r.state;
  }
  expect(s.ply).toBe(8);
});
it("one refusal changes revision but not ply; repeat executes without a roll", () => {
  const s = createGameState(2);
  s.ply = 16;
  const sub = subjectAt(s, [6, 4]);
  sub.loyalty = 0;
  sub.resentment = 100;
  sub.fear = 100;
  const m = { from: [6, 4], to: [4, 4], side: "white" } as const;
  const action = {
    ...m,
    from: [...m.from] as [number, number],
    to: [...m.to] as [number, number],
  };
  const r = submitMove(s, action, { draw: () => 0 });
  expect(r.resolution).toBe("refused");
  expect(r.requestAccepted).toBe(true);
  expect(r.state.ply).toBe(16);
  expect(r.state.revision).toBe(s.revision + 1);
  expect(r.state.events.at(-1)?.message).toContain("hesitates");
  expect(r.state.simulation!.kingdoms).toEqual(s.simulation!.kingdoms);
  const next = submitMove(r.state, action, {
    draw: () => {
      throw Error("reroll");
    },
  });
  expect(next.turnConsumed).toBe(true);
  expect(next.state.simulation!.kingdoms.white.tyranny).toBe(15);
});
it("safe retreat moves only the commanded bishop and is logged", () => {
  const s = boardFixture([
    ["K", [7, 7]],
    ["k", [0, 7]],
    ["B", [4, 3]],
    ["r", [2, 0]],
  ]);
  const sub = subjectAt(s, [4, 3]);
  sub.fear = 90;
  sub.loyalty = 30;
  const m = { from: [4, 3], to: [2, 5], side: "white" } as const;
  const move = {
    ...m,
    from: [...m.from] as [number, number],
    to: [...m.to] as [number, number],
  };
  const p = refusalProbability(s, move).probability;
  const r = submitMove(s, move, { draw: scripted(p + 0.001) });
  expect(r.resolution).toBe("autonomous");
  expect(r.state.board[2][0]).toBe("r");
  expect(r.state.lastMove?.[1]).not.toEqual(move.to);
  expect(r.state.events.at(-1)?.intended).toEqual(move.to);
});
it("heroic knight geometry is bounded and cannot capture", () => {
  const s = boardFixture([
    ["K", [7, 7]],
    ["k", [0, 7]],
    ["N", [5, 2]],
  ]);
  subjectAt(s, [5, 2]).morale = 90;
  const m = { from: [5, 2], to: [3, 3], side: "white" } as const;
  const action = {
    ...m,
    from: [...m.from] as [number, number],
    to: [...m.to] as [number, number],
  };
  const r = submitMove(s, action, { draw: scripted(0.9, 0.99, 0.1) });
  expect(r.state.board[2][4]).toBe("N");
  expect(r.state.simulation!.kingdoms.white.extensionsUsed).toBe(1);
  s.board[2][4] = "k";
  s.board[0][7] = null;
  const blocked = submitMove(s, action, { draw: scripted(0.9, 0.99, 0.1) });
  expect(blocked.state.board[2][4]).toBe("k");
});
it("king and check escape orders are guaranteed", () => {
  const s = boardFixture([
    ["K", [7, 4]],
    ["k", [0, 0]],
    ["r", [0, 4]],
    ["R", [6, 0]],
  ]);
  const r = submitMove(
    s,
    { from: [6, 0], to: [6, 4], side: "white" },
    {
      draw: () => {
        throw Error("check refusal");
      },
    },
  );
  expect(r.turnConsumed).toBe(true);
});
it("undo cancels pending refusal first and replay preserves RNG and outcomes", () => {
  const s = createGameState(1);
  s.ply = 16;
  subjectAt(s, [6, 4]).loyalty = 0;
  subjectAt(s, [6, 4]).resentment = 100;
  const m = { from: [6, 4], to: [4, 4], side: "white" } as const;
  const action = {
    ...m,
    from: [...m.from] as [number, number],
    to: [...m.to] as [number, number],
  };
  const r = submitMove(s, action, { draw: () => 0 });
  const h = { start: s, completed: [] };
  expect(undoTurn(h, r.state).game).toEqual(s);
  const completed = submitMove(r.state, action);
  const hist = recordTurn(h, completed);
  expect(undoTurn(hist, completed.state).game).toEqual(s);
  expect(submitMove(s, action)).toEqual(
    submitMove(undoTurn(hist, completed.state).game, action),
  );
});
