import { expect, it, vi } from "vitest";
import { createGameState, getAllLegalMoves, submitMove } from "@/lib/game";
import { publicState } from "@/lib/game/publicState";
import { CONFIGS } from "@/lib/rpg/config";
import { seedRng, draw } from "@/lib/rpg/rng";
import { submitWithFallback } from "@/hooks/useComputerTurn";
import type { MoveAttempt, MoveResult } from "@/lib/game/types";

it("a rejected computer move falls back instead of stalling the turn", () => {
  const move: MoveAttempt = { from: [1, 0], to: [3, 0], side: "black" };
  const fallback: MoveAttempt = { from: [1, 1], to: [2, 1], side: "black" };
  const submit = vi.fn(
    (a: MoveAttempt) =>
      ({ requestAccepted: a === fallback, message: "" }) as MoveResult,
  );
  expect(submitWithFallback(submit, move, fallback).requestAccepted).toBe(true);
  expect(submit).toHaveBeenCalledTimes(2);
  submit.mockClear();
  expect(submitWithFallback(submit, fallback, fallback).requestAccepted).toBe(
    true,
  );
  expect(submit).toHaveBeenCalledTimes(1);
});

it("public event numbers stay contiguous around hidden agency events", () => {
  let hiddenGaps = 0;
  for (let seed = 0; seed < 10; seed++) {
    let s = createGameState(seed);
    const rng = seedRng(seed);
    for (let ply = 0; ply < 80 && s.status === "active"; ply++) {
      const moves = getAllLegalMoves(s.board, s.sideToMove, s.rights),
        move = moves[Math.floor(draw(rng) * moves.length)];
      let r = submitMove(s, move);
      if (!r.turnConsumed) r = submitMove(r.state, move);
      s = r.state;
    }
    if (s.events.some((e, i) => e.seq !== i + 1)) hiddenGaps++;
    expect(publicState(s).events.map((e) => e.seq)).toEqual(
      s.events.map((_, i) => i + 1),
    );
  }
  // The raw sequence is shared with private events, so gaps must exist.
  expect(hiddenGaps).toBeGreaterThan(0);
});

// The validators are deliberately independent of config. This keeps a config
// from raising a limit past what saved-state validation accepts.
it("no configuration exceeds the saved-state validator bounds", () => {
  for (const c of Object.values(CONFIGS)) {
    expect(c.memoryLimit).toBeLessThanOrEqual(12);
    expect(c.relationshipLimit).toBeLessThanOrEqual(4);
    expect(c.privateEventLimit).toBeLessThanOrEqual(256);
    expect(c.extensionLimit).toBeLessThanOrEqual(1);
    if (c.progression) {
      expect(c.progression.episodeLimit).toBeLessThanOrEqual(6);
      expect(c.progression.retreatLimit).toBeLessThanOrEqual(2);
      expect(c.progression.pairLimit).toBeLessThanOrEqual(8);
    }
  }
});
