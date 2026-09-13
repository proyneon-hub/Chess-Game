import { applyMove } from "../lib/chess";
import { getAllLegalMoves } from "../lib/game";
import type { GameState, MoveAttempt } from "../lib/game/types";
import { evaluateBoard } from "../lib/ai";
import { assessOrder } from "../lib/rpg/facts";
import { exchangeLoss, locations, opposite } from "../lib/rpg/context";
import { nextRights, positionKey } from "../lib/chessRules";
import { draw, type RngState } from "../lib/rpg/rng";
/** Stress policy: knowingly repeats danger/denies relief, using own private
 * treatment only. Still values captures and legal chess outcomes; no cooperative
 * reply, state edits, future RNG inspection or refusal roll searches. */
export function encounterPressureChoice(
  s: GameState,
  rng: RngState,
): MoveAttempt {
  if (s.pendingRefusal) return { ...s.pendingRefusal, side: s.sideToMove };
  const side = s.sideToMove,
    sim = s.simulation!,
    pos = locations(s);
  const own = Object.values(sim.subjects).filter(
    (x) => x.side === side && x.status === "active" && x.currentKind !== "k",
  );
  return getAllLegalMoves(s.board, side, s.rights)
    .map((m) => {
      const sub = sim.subjects[s.pieceIds[m.from[0]][m.from[1]]!],
        b = applyMove(s.board, m.from, m.to, m.promotion, s.rights),
        ctx = assessOrder(s, m, b);
      let score =
        evaluateBoard(b) * (side === "white" ? 1 : -1) * 0.5 + draw(rng) * 20;
      if (!ctx.exempt) {
        if (sub.currentKind !== "k" && ctx.residual >= 100)
          score +=
            200 +
            Math.min(60, sub.fear) +
            Math.min(40, sub.resentment) +
            Number(sub.ambition >= 60) * 30;
        for (const ally of own)
          if (
            ally.id !== sub.id &&
            exchangeLoss(s.board, pos[ally.id], side) >= 100 &&
            exchangeLoss(b, pos[ally.id], side, ctx.map) >= 100
          )
            score += 70;
      }
      score -=
        (s.positions[
          positionKey(b, opposite(side), nextRights(s.board, s.rights, m))
        ] ?? 0) * 150;
      return { m, score };
    })
    .sort((a, b) => b.score - a.score)[0].m;
}
