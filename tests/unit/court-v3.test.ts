import { expect, it } from "vitest";
import { constructedV3Court as constructed } from "../progression-fixtures";
import { subjectAt } from "../fixtures";
import { progression } from "@/lib/rpg/pressure";
import { scheduleCourt, activePlot } from "@/lib/rpg/conspiracy";
import { courtEligibility } from "@/lib/rpg/courtEligibility";
import { refreshDisputes, relate } from "@/lib/rpg/relationships";
import { remember } from "@/lib/rpg/subjects";
const tick = (s: ReturnType<typeof constructed>, draw = 0) => {
  s.ply += 2;
  s.revision++;
  s.simulation!.kingdoms.white.ownTurnsCompleted++;
  scheduleCourt(s, "white", () => draw, false);
};
it("constructed v3 branch: grave episodes and the same consecutive pair are required", () => {
  const s = constructed();
  expect(courtEligibility(s, "white").blockers).toContain("streak");
  tick(s);
  expect(activePlot(s)).toBeUndefined();
  progression(s).subjects[subjectAt(s, [5, 3]).id].episodes = [];
  tick(s);
  expect(activePlot(s)).toBeUndefined();
  expect(progression(s).sides.white.pairs).toEqual({});
});
it("constructed v3 branch: three warnings precede resolution and recovery respects v3 entry thresholds", () => {
  for (const success of [true, false]) {
    const s = constructed();
    tick(s);
    tick(s);
    expect(activePlot(s)?.stage).toBe("gathering");
    tick(s);
    tick(s);
    expect(s.events).toHaveLength(3);
    expect(s.terminal).toBeNull();
    tick(s, success ? 0 : 0.99);
    expect(s.board[7][4]).toBe("K");
    expect(s.terminal?.reason ?? null).toBe(success ? "regicide" : null);
  }
  const s = constructed();
  tick(s);
  tick(s);
  s.simulation!.kingdoms.white.legitimacy = 55;
  tick(s);
  expect(activePlot(s)?.stage).toBe("preparing");
  s.simulation!.kingdoms.white.legitimacy = 61;
  tick(s);
  expect(activePlot(s)).toBeUndefined();
});
it("constructed v3 disputes require causal memories for bonded and unrelated pairs, then reconcile", () => {
  for (const starting of [0, 10]) {
    const s = constructed(),
      a = subjectAt(s, [5, 3]),
      b = subjectAt(s, [5, 5]);
    relate(s, a, b, starting);
    relate(s, a, b, -50);
    refreshDisputes(s, "white");
    expect(a.grievance).toBeNull();
    remember(s, a, "rival_friction", b.id);
    refreshDisputes(s, "white");
    expect(a.grievance).toBe(b.id);
    for (let i = 0; i < 9; i++) {
      s.simulation!.kingdoms.white.ownTurnsCompleted += 4;
      relate(s, a, b, 6, true);
    }
    expect(a.grievance).toBeNull();
  }
});
