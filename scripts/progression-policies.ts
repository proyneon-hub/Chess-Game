import { applyMove, isInCheck } from "../lib/chess";
import { getAllLegalMoves } from "../lib/game";
import type { GameState, MoveAttempt } from "../lib/game/types";
import { evaluateBoard } from "../lib/ai";
import {
  attackers,
  exchangeLoss,
  locations,
  opposite,
} from "../lib/rpg/context";
import {
  captureSquare,
  material,
  positionKey,
  nextRights,
} from "../lib/chessRules";
import { progression } from "../lib/rpg/pressure";
import { assessOrder } from "../lib/rpg/facts";
import { draw, type RngState } from "../lib/rpg/rng";
export const ordinaryPolicies = [
  "neutral",
  "protective",
  "coercive",
  "ambition",
];
export function pressureChoice(
  s: GameState,
  rng: RngState,
  cooperative = false,
): MoveAttempt {
  const choices = getAllLegalMoves(s.board, s.sideToMove, s.rights);
  if (s.pendingRefusal) return { ...s.pendingRefusal, side: s.sideToMove };
  const p = progression(s),
    sim = s.simulation!,
    side = s.sideToMove,
    pos = locations(s),
    own = sim.kingdoms[side].ownTurnsCompleted;
  const noise = choices.map(() => draw(rng) * 10);
  const target = Object.values(sim.subjects)
    .filter(
      (x) =>
        x.side === side &&
        x.status === "active" &&
        "qnr".includes(x.currentKind) &&
        ["proud", "ambitious"].includes(x.personality),
    )
    .sort(
      (a, b) =>
        b.resentment - a.resentment ||
        b.ambition - a.ambition ||
        a.id.localeCompare(b.id),
    )[0];
  return choices
    .map((m, i) => {
      const id = s.pieceIds[m.from[0]][m.from[1]]!,
        sub = sim.subjects[id],
        q = p.subjects[id],
        next = applyMove(s.board, m.from, m.to, m.promotion, s.rights),
        ctx = assessOrder(s, m, next);
      let score =
        evaluateBoard(next) * (side === "white" ? 1 : -1) * 0.5 + noise[i];
      // Pressure is a legal command policy, never a hidden-state edit or RNG search.
      if (!ctx.exempt && sub.currentKind !== "k") {
        const danger = ctx.residual >= 100;
        const current = q.episodes.find(
          (e) => e.cause === "avoidable_exposure" && e.closedOwnTurn === null,
        );
        const value = material[sub.currentKind];
        if (danger) {
          score +=
            100 +
            sub.resentment * 0.8 +
            Number(sub.ambition >= 60) * 40 +
            Number(["proud", "ambitious"].includes(sub.personality)) * 35;
          score -= value * 0.07;
          score += ctx.risk < value ? 40 : 0;
          if (!current) score += own - q.lastExposure >= 3 ? 70 : -80;
          else score += own - q.lastRepeated >= 4 ? 35 : -100;
        } else if (current) {
          score += own - current.openedOwnTurn >= 2 ? 45 : -15;
        }
        for (const ally of Object.values(sim.subjects).filter(
          (x) =>
            x.side === side &&
            x.status === "active" &&
            x.id !== id &&
            x.currentKind !== "k",
        )) {
          const memory = p.subjects[ally.id];
          if (
            memory.episodes.some(
              (e) =>
                e.cause === "avoidable_exposure" && e.closedOwnTurn === null,
            ) &&
            exchangeLoss(next, pos[ally.id], side, ctx.map) >= 100
          )
            score += own - memory.lastNeglect >= 2 ? 90 : 15;
        }
      }
      const key = positionKey(
        next,
        opposite(side),
        nextRights(s.board, s.rights, m),
      );
      score -= (s.positions[key] ?? 0) * 150;
      if (cooperative && ctx.captured) score -= 10000;
      if (target) {
        const t = p.subjects[target.id],
          open = t.episodes.find(
            (e) => e.cause === "avoidable_exposure" && e.closedOwnTurn === null,
          );
        if (id === target.id) {
          const defenders = attackers(ctx.map, m.to, side)
            .map(([r, c]) => s.pieceIds[r][c])
            .filter(Boolean);
          if (open && target.resentment >= 35) {
            score += ctx.residual < 100 ? 500 : -500;
          } else if (
            !open &&
            !ctx.exempt &&
            ctx.residual >= 100 &&
            defenders.length === 1
          ) {
            score += 500;
            if (t.episodes.some((e) => e.defenderIds[0] === defenders[0]))
              score += 300;
          }
        }
        if (
          open &&
          target.resentment >= 35 &&
          id !== target.id &&
          exchangeLoss(next, pos[target.id], side, ctx.map) < 100
        )
          score += 600;
      }
      return { m, score };
    })
    .sort((a, b) => b.score - a.score)[0].m;
}
export function cooperativeReply(s: GameState, rng: RngState): MoveAttempt {
  const choices = getAllLegalMoves(s.board, s.sideToMove, s.rights);
  return choices
    .map((m) => {
      const next = applyMove(s.board, m.from, m.to, m.promotion, s.rights);
      let score = draw(rng) * 20;
      // Explicitly cooperative causal-path evidence, never used in pressure/holdout.
      if (captureSquare(s.board, m)) score -= 10000;
      if (isInCheck(next, s.sideToMove !== "white")) score -= 1000;
      score -=
        (s.positions[
          positionKey(
            next,
            opposite(s.sideToMove),
            nextRights(s.board, s.rights, m),
          )
        ] ?? 0) * 100;
      return { m, score };
    })
    .sort((a, b) => b.score - a.score)[0].m;
}
