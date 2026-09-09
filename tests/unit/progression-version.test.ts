import { expect, it } from "vitest";
import { createGameState, submitMove } from "@/lib/game";
import { migrateState } from "@/lib/game/migrate";
import { publicState } from "@/lib/game/publicState";
import { validateState } from "@/lib/game/validation";
import { progression } from "@/lib/rpg/pressure";
it("v3 defaults, old matches and private episode state have explicit version boundaries", () => {
  const s = createGameState(1, "2026-09-08.6");
  expect(s.schemaVersion).toBe(3);
  expect(s.rulesetVersion).toBe("hidden-kingdom-v3");
  validateState(s);
  expect(migrateState(s)).toEqual(s);
  expect(JSON.stringify(publicState(s))).not.toMatch(
    /progression|episode|subjects|rngState|configVersion/,
  );
  for (const v of ["2026-09-07.1", "2026-09-07.2", "2026-09-07.3"]) {
    const old = createGameState(1, v);
    validateState(old);
    expect(old.schemaVersion).toBe(2);
    expect(old.simulation).not.toHaveProperty("progression");
  }
  const wrong = structuredClone(s);
  wrong.configVersion = "2026-09-07.3";
  expect(() => migrateState(wrong)).toThrow();
  expect(
    submitMove(wrong, { from: [6, 4], to: [4, 4], side: "white" })
      .requestAccepted,
  ).toBe(false);
  progression(s).subjects[s.pieceIds[6][0]!].episodes.push({} as never);
  expect(() => validateState(s)).toThrow();
});
