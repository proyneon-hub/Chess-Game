import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import records from "../goldens/pre-v3.json";
import { submitMove, createGameState } from "@/lib/game";
import type { GameState, MoveAttempt } from "@/lib/game/types";
for (const record of records)
  it(`historical golden: ${record.name}`, () => {
    let state = structuredClone(record.initial) as unknown as GameState,
      index = 0;
    for (const [i, action] of record.actions.entries()) {
      const result = submitMove(
        state,
        action as MoveAttempt,
        record.forced ? { draw: () => record.forced![index++] ?? 0.99 } : {},
      );
      expect(
        createHash("sha256").update(JSON.stringify(result)).digest("hex"),
      ).toBe(record.hashes[i]);
      state = result.state;
    }
    expect(index).toBe(record.drawCount);
  });

it("historical v2 initialization still matches captured pre-change states", () => {
  for (const record of records.filter(
    (r) => r.name.includes(":seeded-opening") && r.name.startsWith("2026"),
  ))
    expect(createGameState(12345, record.initial.configVersion)).toEqual(
      record.initial,
    );
});
