import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { createGameState, submitMove } from "@/lib/game";
import type { MoveAttempt } from "@/lib/game/types";
import { validateState } from "@/lib/game/validation";
const report = JSON.parse(
  readFileSync("docs/readable-politics/natural-replay-110456/raw.json", "utf8"),
) as {
  configVersion: string;
  results: {
    seed: number;
    counters: Record<string, number>;
    replay: {
      command: MoveAttempt;
      resolution: string;
      ply: number;
      events: unknown[];
    }[];
  }[];
};
it("natural v4 development replay reaches a fully warned attempt from normal initialization without forced RNG", () => {
  let attempted = 0;
  for (const game of report.results) {
    let s = createGameState(game.seed, report.configVersion);
    for (const step of game.replay) {
      const beforeSeq = s.eventSeq;
      const r = submitMove(s, step.command);
      expect(r.requestAccepted).toBe(true);
      expect(r.resolution).toBe(step.resolution);
      expect(r.state.ply).toBe(step.ply);
      expect(r.state.events.filter((e) => e.seq > beforeSeq)).toEqual(
        step.events,
      );
      s = r.state;
      validateState(s);
    }
    expect(s.simulation!.counters).toEqual(game.counters);
    attempted += s.simulation!.counters.armedAttempts ?? 0;
    for (const p of s.simulation!.plots.filter((p) => p.stage === "resolved")) {
      expect(p.warningEventIds).toHaveLength(3);
      expect(p.warningOwnTurns[0]).toBeLessThan(p.warningOwnTurns[1]);
      expect(p.warningOwnTurns[1]).toBeLessThan(p.warningOwnTurns[2]);
    }
  }
  expect(attempted).toBe(1);
});
