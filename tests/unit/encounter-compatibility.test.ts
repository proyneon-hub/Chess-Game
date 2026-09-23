import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import records from "../goldens/pre-v5.json";
import { createGameState, submitMove } from "@/lib/game";
import type { GameState, MoveAttempt } from "@/lib/game/types";
import { validateState } from "@/lib/game/validation";
import { publicState } from "@/lib/game/publicState";
import { CONFIG, DEFAULT_CONFIG } from "@/lib/rpg/config";
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
it("creates v5 and v6 without exposing unencountered state", () => {
  for (const [version, schema] of [
    [CONFIG.version, 5],
    [DEFAULT_CONFIG.version, 6],
  ] as const) {
    const s = createGameState(1, version);
    expect(s.schemaVersion).toBe(schema);
    expect(() => validateState(s)).not.toThrow();
    expect(publicState(s).encounters).toEqual([]);
    expect(JSON.stringify(publicState(s))).not.toMatch(
      /modifiers|dangerTurns|pairRewards|loyalty|rngState/,
    );
  }
  expect(createGameState(1).schemaVersion).toBe(6);
});
