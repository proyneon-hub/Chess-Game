import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import records from "../goldens/pre-v5.json";
import { createGameState, submitMove } from "@/lib/game";
import type { GameState, MoveAttempt } from "@/lib/game/types";
import { validateState } from "@/lib/game/validation";
import { publicState } from "@/lib/game/publicState";
for (const [i, record] of records.entries())
  it(`v4 pre-v5 golden ${i}`, () => {
    let s = structuredClone(record.initial) as unknown as GameState;
    for (const [j, action] of record.actions.entries()) {
      const r = submitMove(s, action as MoveAttempt);
      expect(createHash("sha256").update(JSON.stringify(r)).digest("hex")).toBe(
        record.hashes[j],
      );
      s = r.state;
    }
  });
it("creates v5 without exposing unencountered state", () => {
  const s = createGameState(1);
  expect(s.schemaVersion).toBe(5);
  expect(() => validateState(s)).not.toThrow();
  expect(publicState(s).encounters).toEqual([]);
  expect(JSON.stringify(publicState(s))).not.toMatch(
    /modifiers|dangerTurns|pairRewards|loyalty|rngState/,
  );
});
