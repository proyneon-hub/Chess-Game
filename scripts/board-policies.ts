import { applyMove } from "../lib/chess";
import { getAllLegalMoves } from "../lib/game";
import type { GameState, MoveAttempt } from "../lib/game/types";
import { evaluateBoard } from "../lib/ai";
import { exchangeLoss, opposite } from "../lib/rpg/context";
import { nextRights, positionKey } from "../lib/chessRules";
import { draw, type RngState } from "../lib/rpg/rng";
export type BoardPolicy =
  "board-ordinary" | "board-protective" | "board-mistreatment";
type VisiblePosition = Pick<
  GameState,
  "board" | "sideToMove" | "rights" | "positions" | "pendingRefusal"
>;
/** Cannot access subjects, political history, personality, plots or gameplay RNG. */
export function boardChoice(
  s: VisiblePosition,
  rng: RngState,
  policy: BoardPolicy,
): MoveAttempt {
  if (s.pendingRefusal && policy === "board-mistreatment")
    return { ...s.pendingRefusal, side: s.sideToMove };
  return getAllLegalMoves(s.board, s.sideToMove, s.rights)
    .map((m) => {
      const b = applyMove(s.board, m.from, m.to, m.promotion, s.rights);
      const danger = exchangeLoss(b, m.to, m.side);
      let score =
        evaluateBoard(b) * (m.side === "white" ? 1 : -1) + draw(rng) * 100;
      if (policy === "board-protective") score -= danger;
      if (policy === "board-mistreatment") score += Math.min(500, danger) * 1.5;
      score -=
        (s.positions[
          positionKey(b, opposite(m.side), nextRights(s.board, s.rights, m))
        ] ?? 0) * 150;
      return { m, score };
    })
    .sort((a, b) => b.score - a.score)[0].m;
}
