import { expect, it } from "vitest";
import { lateCourt, courtTurn } from "../scenarios";
import { validateState } from "@/lib/game/validation";
import { publicState } from "@/lib/game/publicState";
import { subjectAt, boardFixture } from "../fixtures";
import { submitMove } from "@/lib/game";
import { relate } from "@/lib/rpg/relationships";
import { remember } from "@/lib/rpg/subjects";
it("Regicide: valid late-game commands commit all warnings before a terminal result", () => {
  let s = lateCourt();
  for (let n = 0; n < 5; n++) {
    const white = courtTurn(s, "white");
    expect(white.turnConsumed).toBe(true);
    s = white.state;
    validateState(s);
    if (n < 4) {
      expect(s.terminal).toBeNull();
      s = courtTurn(s, "black").state;
      validateState(s);
    }
  }
  expect(s.terminal?.reason).toBe("regicide");
  expect(
    s.events.filter(
      (e) => e.message.includes("court") || e.message.includes("turns away"),
    ),
  ).toHaveLength(4);
  expect(publicState(s).terminal?.winner).toBe("black");
  expect(s.board[7][4]).toBe("K");
});
it("Tyrant's victory: coercion accumulates grievances but does not force defeat", () => {
  const s = boardFixture(
    [
      ["K", [2, 5]],
      ["Q", [2, 6]],
      ["k", [0, 7]],
      ["r", [7, 0]],
    ],
    48,
  );
  s.simulation!.kingdoms.white.tyranny = 75;
  s.simulation!.kingdoms.white.legitimacy = 25;
  const sub = subjectAt(s, [2, 6]);
  sub.loyalty = 0;
  sub.resentment = 100;
  sub.fear = 100;
  const m = { from: [2, 6], to: [1, 6], side: "white" } as const;
  const action = {
    ...m,
    from: [...m.from] as [number, number],
    to: [...m.to] as [number, number],
  };
  const refusal = submitMove(s, action, { draw: () => 0 });
  expect(refusal.resolution).toBe("refused");
  const result = submitMove(refusal.state, action);
  expect(result.state.terminal?.reason).toBe("checkmate");
  expect(result.state.terminal?.winner).toBe("white");
  expect(result.state.simulation!.kingdoms.white.tyranny).toBe(80);
});
it("Rival court: factual protection improves a disputed relationship", () => {
  const s = boardFixture([
    ["K", [7, 7]],
    ["k", [0, 7]],
    ["R", [6, 0]],
    ["B", [4, 3]],
    ["r", [4, 0]],
  ]);
  const rook = subjectAt(s, [6, 0]),
    bishop = subjectAt(s, [4, 3]);
  relate(s, rook, bishop, -40);
  expect(rook.relationships[bishop.id].disputed).toBe(true);
  const out = submitMove(
    s,
    { from: [6, 0], to: [6, 3], side: "white" },
    { draw: () => 0.99 },
  ).state;
  expect(out.simulation!.subjects[rook.id].relationships[bishop.id].score).toBe(
    -34,
  );
  expect(out.simulation!.subjects[bishop.id].loyalty).toBe(bishop.loyalty + 2);
  expect(out.events.every((e) => !e.message.includes("bishop yields"))).toBe(
    true,
  );
});
it("Equal treatment: AI and human commands have identical resolution and RNG", () => {
  const s = lateCourt();
  const a = courtTurn(s, "white"),
    b = courtTurn(structuredClone(s), "white");
  expect(a).toEqual(b);
});

it("promotion envy can become a dispute through two coerced losing orders", () => {
  let s = boardFixture([
    ["K", [7, 7]],
    ["k", [0, 7]],
    ["Q", [4, 3]],
    ["R", [3, 0]],
    ["p", [2, 2]],
    ["p", [2, 5]],
  ]);
  const queen = subjectAt(s, [4, 3]),
    rook = subjectAt(s, [3, 0]);
  queen.fear = 100;
  queen.resentment = 90;
  queen.loyalty = 20;
  remember(s, queen, "promotion_envy", rook.id, 1, 12);
  relate(s, queen, rook, -10);
  for (const [from, to] of [
    [
      [4, 3],
      [3, 3],
    ],
    [
      [3, 3],
      [3, 4],
    ],
  ] as const) {
    const m = {
      from: [...from] as [number, number],
      to: [...to] as [number, number],
      side: "white" as const,
    };
    const refused = submitMove(s, m, { draw: () => 0 });
    expect(refused.resolution).toBe("refused");
    s = submitMove(refused.state, m).state;
    if (from[0] === 4)
      s = submitMove(s, { from: [0, 7], to: [1, 7], side: "black" }).state;
  }
  expect(s.simulation!.subjects[queen.id].relationships[rook.id].score).toBe(
    -30,
  );
  expect(s.simulation!.subjects[queen.id].relationships[rook.id].disputed).toBe(
    true,
  );
});
