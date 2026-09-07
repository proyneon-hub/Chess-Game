import { expect, it } from "vitest";
import { createGameState } from "@/lib/game";
import { migrateState } from "@/lib/game/migrate";
import { configFor } from "@/lib/rpg/config";
import { refusalProbability } from "@/lib/rpg/agency";
import { subjectAt } from "../fixtures";
it("saved configuration versions retain their numeric formula", () => {
  const current = createGameState(1),
    old = structuredClone(current);
  old.configVersion = "2026-09-07.1";
  old.simulation!.configVersion = old.configVersion;
  subjectAt(old, [6, 4]).resentment = 90;
  subjectAt(current, [6, 4]).resentment = 90;
  const m = {
    from: [6, 4] as [number, number],
    to: [4, 4] as [number, number],
    side: "white" as const,
  };
  expect(
    refusalProbability(current, m).probability -
      refusalProbability(old, m).probability,
  ).toBeCloseTo(0.035);
  expect(migrateState(old).configVersion).toBe(old.configVersion);
  expect(configFor("2026-09-07.1")?.coercedRivalGrievance).toBe(0);
  expect(configFor("__proto__")).toBeUndefined();
});
it("low-pressure high-loyalty commands stay within two percent", () => {
  for (let seed = 0; seed < 100; seed++) {
    const s = createGameState(seed);
    s.ply = 16;
    expect(
      refusalProbability(s, { from: [6, 4], to: [4, 4], side: "white" })
        .probability,
    ).toBeLessThanOrEqual(0.02);
  }
});
