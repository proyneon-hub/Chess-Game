import { expect, it } from "vitest";
import { CONFIG } from "@/lib/rpg/config";
import fixture from "../goldens/natural-progression-v3.json";
import { createGameState, submitMove, getAllLegalMoves } from "@/lib/game";
import type { MoveAttempt } from "@/lib/game/types";
import { validateState } from "@/lib/game/validation";
import { progression } from "@/lib/rpg/pressure";
import { exchangeLoss, locations } from "@/lib/rpg/context";
import { applyMove } from "@/lib/chess";
it.each([fixture.configVersion, CONFIG.version])(
  "scripted causal reachability %s from a normal board without political edits",
  (version) => {
    let s = createGameState(fixture.seed, version),
      dispute = false,
      eligible = false;
    for (const action of fixture.actions) {
      const r = submitMove(s, action as MoveAttempt, { draw: () => 0.99 });
      expect(r.turnConsumed).toBe(true);
      s = r.state;
      validateState(s);
      if ((s.simulation!.counters.disputes ?? 0) > 0) dispute = true;
      if ((s.simulation!.counters.eligibleKingdomTurns ?? 0) > 0)
        eligible = true;
    }
    expect(dispute).toBe(true);
    expect(eligible).toBe(true);
    expect(s.simulation!.counters.plots ?? 0).toBe(0); // no claimed natural lottery result from forced execution
  },
);
it("legal protection and neglect branches from the same natural history diverge in trust and government", () => {
  let s = createGameState(fixture.seed, fixture.configVersion),
    found = false;
  for (const action of fixture.actions) {
    const m = action as MoveAttempt,
      neglect = submitMove(s, m, { draw: () => 0.99 });
    if (
      (neglect.state.simulation!.counters.neglect ?? 0) >
      (s.simulation!.counters.neglect ?? 0)
    ) {
      const target = Object.keys(progression(s).subjects).find(
        (id) =>
          progression(neglect.state).subjects[id].lastNeglect >
          progression(s).subjects[id].lastNeglect,
      )!;
      const sq = locations(s)[target];
      const safe = getAllLegalMoves(s.board, s.sideToMove, s.rights).find(
        (a) =>
          a.from.join() === sq.join() &&
          exchangeLoss(
            applyMove(s.board, a.from, a.to, a.promotion, s.rights),
            a.to,
            a.side,
          ) < 100,
      );
      if (safe) {
        const protect = submitMove(s, safe, { draw: () => 0.99 });
        expect(protect.turnConsumed).toBe(true);
        expect(
          protect.state.simulation!.subjects[target].loyalty,
        ).toBeGreaterThan(neglect.state.simulation!.subjects[target].loyalty);
        expect(protect.state.simulation!.kingdoms[m.side].tyranny).toBeLessThan(
          neglect.state.simulation!.kingdoms[m.side].tyranny,
        );
        found = true;
        break;
      }
    }
    s = neglect.state;
  }
  expect(found).toBe(true);
});
