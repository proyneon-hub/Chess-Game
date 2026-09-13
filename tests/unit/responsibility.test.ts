import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import records from "../goldens/pre-v4.json";
import { createGameState, submitMove } from "@/lib/game";
import type { GameState, MoveAttempt } from "@/lib/game/types";
import { v4Fixture } from "../progression-fixtures";
import { subjectAt } from "../fixtures";
import { agencyForecast } from "@/lib/rpg/agency";
import { harmfulEpisodes, progression } from "@/lib/rpg/pressure";
import { validateState } from "@/lib/game/validation";
import { migrateState } from "@/lib/game/migrate";
import { publicState } from "@/lib/game/publicState";
import { leadershipView, materializeView } from "@/lib/ai/leadershipView";
import { recordTurn, undoTurn } from "@/lib/game/undo";
import { chooseAfterRefusal } from "@/lib/ai/restraint";
const order: MoveAttempt = { from: [5, 0], to: [4, 0], side: "white" };
const rook = () =>
  v4Fixture(
    [
      ["K", [7, 7]],
      ["k", [0, 7]],
      ["R", [5, 0]],
      ["p", [2, 1]],
    ],
    40,
  );
function hero(s: GameState, m = order) {
  subjectAt(s, m.from).morale = 80;
  const f = agencyForecast(s, m);
  expect(f.heroism).toBeGreaterThan(0);
  return submitMove(s, m, {
    draw: () => f.refusal + f.retreat + f.heroism / 2,
  });
}
for (const record of records)
  it(`v3 remains immutable: ${record.name}`, () => {
    let s = structuredClone(record.initial) as unknown as GameState,
      index = 0;
    for (const [i, m] of record.actions.entries()) {
      const r = submitMove(
        s,
        m as MoveAttempt,
        record.forced ? { draw: () => record.forced![index++] ?? 0.99 } : {},
      );
      expect(createHash("sha256").update(JSON.stringify(r)).digest("hex")).toBe(
        record.hashes[i],
      );
      s = r.state;
    }
    expect(index).toBe(record.drawCount);
  });
it("v4 saves retain strict migration preserves older rules and hazards remain private", () => {
  const s = createGameState(2, "2026-09-09.1");
  expect(s.schemaVersion).toBe(4);
  validateState(s);
  for (let i = 1; i <= 6; i++) {
    const old = createGameState(90123, `2026-09-08.${i}`);
    expect(migrateState(old)).toEqual(old);
    expect(old).toEqual(
      records.find((r) => r.name === `2026-09-08.${i}:seeded-100-actions`)!
        .initial,
    );
  }
  expect(JSON.stringify(publicState(s))).not.toMatch(
    /hazard|progression|rngState|configVersion/,
  );
  delete progression(s).subjects[s.pieceIds[6][0]!].hazard;
  expect(() => validateState(s)).toThrow();
});
it("safe command / autonomous danger creates physical fear and a hazard, never blame", () => {
  const s = rook(),
    sub = subjectAt(s, order.from),
    r = hero(s);
  validateState(r.state);
  const after = r.state.simulation!.subjects[sub.id],
    q = progression(r.state).subjects[sub.id];
  expect(r.state.lastMove).toEqual([
    [5, 0],
    [3, 0],
  ]);
  expect(after.loyalty).toBe(sub.loyalty);
  expect(after.resentment).toBe(sub.resentment);
  expect(after.fear).toBeGreaterThan(sub.fear);
  expect(after.fatigue).toBeGreaterThan(sub.fatigue);
  expect(q.episodes).toEqual([]);
  expect(q.hazard?.square).toEqual([3, 0]);
  expect(harmfulEpisodes(r.state, sub.id, 32, true)).toEqual([]);
  expect(JSON.stringify(publicState(r.state))).not.toContain("hazard");
  expect(hero(s)).toEqual(r);
  expect(subjectAt(s, order.from).loyalty).toBe(sub.loyalty);
});
it("explicit danger still costs trust; retreat costs trust without fictional exposure", () => {
  const s = rook(),
    sub = subjectAt(s, order.from),
    m = { ...order, to: [3, 0] as [number, number] };
  const commanded = submitMove(s, m, { draw: () => 0.99 });
  expect(commanded.state.simulation!.subjects[sub.id].loyalty).toBe(
    sub.loyalty - 4,
  );
  expect(
    progression(commanded.state).subjects[sub.id].episodes[0].closedOwnTurn,
  ).toBeNull();
  sub.fear = 80;
  sub.loyalty = 50;
  const f = agencyForecast(s, m);
  expect(f.retreat).toBe(0.01);
  const r = submitMove(s, m, { draw: () => f.refusal + f.retreat / 2 });
  validateState(r.state);
  expect(r.resolution).toBe("autonomous");
  expect(r.state.simulation!.subjects[sub.id].loyalty).toBe(46);
  expect(r.state.simulation!.subjects[sub.id].resentment).toBe(
    sub.resentment + 8,
  );
  expect(r.state.simulation!.subjects[sub.id].fear).toBeLessThanOrEqual(80);
  expect(progression(r.state).subjects[sub.id].episodes[0].closedOwnTurn).toBe(
    1,
  );
  expect(progression(r.state).subjects[sub.id].hazard).toBeNull();
});
it("heroic check and terminal history retain causal wording and intended/actual squares", () => {
  const s = v4Fixture(
    [
      ["K", [7, 7]],
      ["k", [3, 7]],
      ["R", [5, 0]],
    ],
    40,
  );
  const r = hero(s);
  expect(r.message).toContain("farther than ordered. Check!");
  expect(r.state.events.at(-1)).toMatchObject({
    intended: [4, 0],
    actual: [3, 0],
    message: r.message,
  });
  const terminal = rook();
  terminal.rights.halfmove = 149;
  const t = hero(terminal);
  expect(t.resolution).toBe("terminal");
  expect(t.message).toBe(t.state.result);
  expect(t.state.moves.at(-1)!.message).toContain("farther than ordered");
  expect(t.state.events.at(-1)!.message).toContain("farther than ordered");
});
it("failed intended protection earns nothing; unexpected protection credits the piece only", () => {
  for (const row of [4, 3]) {
    const s = v4Fixture(
      [
        ["K", [7, 6]],
        ["k", [0, 7]],
        ["R", [5, 0]],
        ["N", [row, 3]],
        ["r", [row, 7]],
      ],
      40,
    );
    const ally = subjectAt(s, [row, 3]),
      mover = subjectAt(s, [5, 0]);
    const r = hero(s);
    validateState(r.state);
    const a = r.state.simulation!.subjects[ally.id];
    expect(a.loyalty).toBe(ally.loyalty);
    expect(r.state.simulation!.kingdoms.white.cohesion).toBe(65);
    expect(r.state.simulation!.counters.protections ?? 0).toBe(0);
    if (row === 3) {
      expect(a.relationships[mover.id].score).toBe(4);
      expect(r.state.simulation!.counters.autonomousProtections).toBe(1);
    } else expect(a.relationships[mover.id]).toBeUndefined();
  }
});
it("a later neglectful order can take responsibility for an autonomous hazard", () => {
  const s = rook(),
    id = subjectAt(s, [5, 0]).id;
  let a = hero(s).state;
  a = submitMove(
    a,
    { from: [0, 7], to: [0, 6], side: "black" },
    { draw: () => 0.99 },
  ).state;
  a = submitMove(
    a,
    { from: [7, 7], to: [7, 6], side: "white" },
    { draw: () => 0.99 },
  ).state;
  validateState(a);
  expect(progression(a).subjects[id].episodes.map((e) => e.cause)).toEqual([
    "neglected_under_threat",
  ]);
  expect(harmfulEpisodes(a, id, 32, true)).toHaveLength(1);
  expect(a.simulation!.subjects[id].loyalty).toBe(
    subjectAt(s, [5, 0]).loyalty - 5,
  );
});
it("own-only AI projections preserve the v4 attribution boundary and omit hidden enemy state", () => {
  const s = rook();
  subjectAt(s, [5, 0]).morale = 80;
  const view = leadershipView(s, "white");
  expect(JSON.stringify(view)).not.toContain("rngState");
  const projection = hero(materializeView(view));
  expect(
    projection.state.simulation!.subjects[subjectAt(s, [5, 0]).id].loyalty,
  ).toBe(subjectAt(s, [5, 0]).loyalty);
  expect(
    progression(projection.state).subjects[subjectAt(s, [5, 0]).id].episodes,
  ).toEqual([]);
});
it("v4 undo restores hazards, observations and RNG before replaying the same action", () => {
  const s = rook();
  subjectAt(s, [5, 0]).morale = 80;
  const result = hero(s),
    h = recordTurn({ start: s, completed: [] }, result);
  const restored = undoTurn(h, result.state);
  expect(restored.game).toEqual(s);
  expect(hero(restored.game)).toEqual(result);
  expect(
    progression(restored.game).subjects[subjectAt(s, [5, 0]).id].hazard,
  ).toBeNull();
});
it("v4 restraint completes a refused turn through the shared reducer without extra draws", () => {
  const s = rook(),
    m = { ...order, to: [3, 0] as [number, number] };
  subjectAt(s, [5, 0]).fear = 80;
  const refused = submitMove(s, m, { draw: () => 0 }).state;
  const choice = chooseAfterRefusal(refused)!;
  const before = structuredClone(refused.simulation!.rngState);
  const r = submitMove(refused, choice.move);
  expect(r.turnConsumed).toBe(true);
  expect(r.state.simulation!.rngState).toEqual(before);
  validateState(r.state);
});
it("an autonomous loss clears its hazard on the victim clock without manufacturing blame", () => {
  const s = rook(),
    id = subjectAt(s, [5, 0]).id;
  const exposed = hero(s).state;
  const r = submitMove(
    exposed,
    { from: [2, 1], to: [3, 0], side: "black" },
    { draw: () => 0.99 },
  );
  validateState(r.state);
  expect(r.state.simulation!.subjects[id].status).toBe("captured");
  expect(progression(r.state).subjects[id]).toMatchObject({
    hazard: null,
    episodes: [],
  });
  expect(r.state.simulation!.kingdoms.white.ownTurnsCompleted).toBe(1);
  expect(r.state.simulation!.kingdoms.white.legitimacy).toBe(65);
});
