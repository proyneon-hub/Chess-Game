import { expect, it } from "vitest";
import { capabilities, hasEncounters } from "@/lib/rpg/capabilities";
import { createGameState } from "@/lib/game";
import { V2_CONFIG, V3_CONFIG, V4_CONFIG, CONFIG } from "@/lib/rpg/config";

// Saved games keep their generation, so these rows must never change.
it("each generation's capabilities are fixed", () => {
  const on = (v: number) =>
    Object.entries(capabilities({ schemaVersion: v }))
      .filter(([, x]) => x)
      .map(([k]) => k)
      .sort();
  const legacy = ["disputeRefusals", "plotRoll", "riskyMoveFear"];
  expect(on(1)).toEqual(legacy);
  expect(on(2)).toEqual(legacy);
  expect(on(3)).toEqual([...legacy, "progression"].sort());
  expect(on(4)).toEqual(
    [
      ...legacy,
      "observationsAtLeadership",
      "progression",
      "responsibility",
    ].sort(),
  );
  expect(on(5)).toEqual([
    "encounters",
    "graceInclusive",
    "progression",
    "responsibility",
    "turnLevelDeltaCap",
  ]);
  expect(() => capabilities({ schemaVersion: 6 })).toThrow();
});

it("type guards follow each config's generation", () => {
  for (const [config, encounters] of [
    [V2_CONFIG, false],
    [V3_CONFIG, false],
    [V4_CONFIG, false],
    [CONFIG, true],
  ] as const)
    expect(hasEncounters(createGameState(1, config.version).simulation)).toBe(
      encounters,
    );
});
