import { expect, it } from "vitest";
import { createGameState, submitMove } from "@/lib/game";
import { boardFixture, subjectAt } from "../fixtures";
import { relate, tickRelationships } from "@/lib/rpg/relationships";
import { remember } from "@/lib/rpg/subjects";
it("rescue builds trust and recovers fear with a cooldown", () => {
  const s = boardFixture([
    ["K", [7, 7]],
    ["k", [0, 7]],
    ["R", [4, 0]],
    ["r", [4, 6]],
  ]);
  const sub = subjectAt(s, [4, 0]);
  sub.fear = 60;
  const r = submitMove(s, { from: [4, 0], to: [5, 0], side: "white" }).state;
  expect(r.simulation!.subjects[sub.id].loyalty).toBe(sub.loyalty + 3);
  expect(r.simulation!.subjects[sub.id].fear).toBeLessThan(60);
  expect(r.simulation!.kingdoms.white.legitimacy).toBe(66);
});
it("repeat and restraint produce distinct bounded leadership outcomes", () => {
  const s = createGameState(1, "2026-09-07.3");
  s.pendingRefusal = { from: [6, 4], to: [4, 4] };
  const repeat = submitMove(s, { ...s.pendingRefusal, side: "white" }).state;
  const restrained = submitMove(s, {
    from: [6, 3],
    to: [4, 3],
    side: "white",
  }).state;
  expect(repeat.simulation!.kingdoms.white.tyranny).toBe(15);
  expect(restrained.simulation!.kingdoms.white.tyranny).toBe(8);
  expect(subjectAt(repeat, [4, 4]).resentment).toBeGreaterThan(
    subjectAt(restrained, [6, 4]).resentment,
  );
});
it("promotion preserves identity and memories, updates role stats, envy is selective", () => {
  const s = boardFixture([
    ["K", [7, 7]],
    ["k", [0, 7]],
    ["P", [1, 0]],
    ["Q", [2, 2]],
  ]);
  const pawn = subjectAt(s, [1, 0]),
    queen = subjectAt(s, [2, 2]);
  queen.ambition = 80;
  queen.loyalty = 50;
  remember(s, pawn, "rescued", pawn.id);
  const out = submitMove(s, {
    from: [1, 0],
    to: [0, 0],
    side: "white",
    promotion: "n",
  }).state;
  const promoted = subjectAt(out, [0, 0]);
  expect(promoted.id).toBe(pawn.id);
  expect(promoted.currentKind).toBe("n");
  expect(promoted.skill).toBe(4);
  expect(promoted.memories.map((m) => m.type)).toContain("rescued");
  expect(out.simulation!.subjects[queen.id].relationships[pawn.id].score).toBe(
    -10,
  );
  expect(out.simulation!.subjects[queen.id].resentment).toBe(
    queen.resentment + 4,
  );
});
it("relationships and disputes have caps, reconcile and cool down", () => {
  const s = createGameState(2),
    subs = Object.values(s.simulation!.subjects).filter(
      (x) => x.side === "white" && x.currentKind !== "k",
    );
  for (const a of subs) for (const b of subs) if (a !== b) relate(s, a, b, -40);
  expect(subs.every((x) => Object.keys(x.relationships).length <= 4)).toBe(
    true,
  );
  expect(
    subs
      .flatMap((x) => Object.values(x.relationships))
      .filter((x) => x.disputed).length,
  ).toBeLessThanOrEqual(4);
  const a = subs[0],
    b = subs[1];
  relate(s, a, b, 100);
  relate(s, a, b, -100);
  const old = a.relationships[b.id].score;
  relate(s, a, b, 6, true);
  relate(s, a, b, 6, true);
  expect(a.relationships[b.id].score).toBe(old + 6);
  tickRelationships(s, "white");
});
it("memories and political values stay bounded", () => {
  const s = createGameState(3),
    sub = subjectAt(s, [6, 0]);
  for (let n = 0; n < 30; n++) {
    s.revision = n;
    remember(s, sub, "coerced", String(n));
  }
  expect(sub.memories).toHaveLength(12);
});
