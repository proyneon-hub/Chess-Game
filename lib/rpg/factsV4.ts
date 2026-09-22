import { compareIds } from "./order";
import { applyMove, sameSquare } from "@/lib/chess";
import { captureSquare } from "@/lib/chessRules";
import type { GameState, ResolvedOrder } from "@/lib/game/types";
import {
  assessOrder,
  derivePoliticalFacts,
  saferMove,
  type PoliticalFact,
} from "./facts";
import { exchangeLoss, locations } from "./context";
import { progression } from "./pressure";
import { rulesFor } from "./config";

/** Counterfactual used only for facts. No reducer, RNG, clocks or rewards run. */
function commandedPosition(
  before: GameState,
  after: GameState,
  order: ResolvedOrder,
): GameState {
  const m = order.intended;
  const pieceIds = before.pieceIds.map((row) => [...row]);
  const captured = captureSquare(before.board, m);
  if (captured) pieceIds[captured[0]][captured[1]] = null;
  pieceIds[m.to[0]][m.to[1]] = pieceIds[m.from[0]][m.from[1]];
  pieceIds[m.from[0]][m.from[1]] = null;
  // An autonomous outcome cannot castle; obeyed castling uses after directly.
  return {
    ...after,
    board: applyMove(before.board, m.from, m.to, m.promotion, before.rights),
    pieceIds,
  };
}

export function deriveResolvedFacts(
  before: GameState,
  after: GameState,
  order: ResolvedOrder,
): PoliticalFact[] {
  const actualContext = assessOrder(before, order.actual, after.board);
  const intendedAfter =
    order.outcome === "obeyed"
      ? after
      : commandedPosition(before, after, order);
  const commandContext = assessOrder(
    before,
    order.intended,
    intendedAfter.board,
  );
  const commanded = derivePoliticalFacts(
    before,
    intendedAfter,
    order.intended,
    commandContext,
  );
  const physical =
    order.outcome === "obeyed"
      ? commanded
      : derivePoliticalFacts(before, after, order.actual, actualContext);
  const pos = locations(after),
    oldPos = locations(before),
    intendedPos = locations(intendedAfter);
  const p = progression(before),
    cfg = rulesFor(before).progression!;
  const side = order.intended.side,
    own = before.simulation!.kingdoms[side].ownTurnsCompleted + 1;
  const moverId =
    before.pieceIds[order.intended.from[0]][order.intended.from[1]]!;
  const facts: PoliticalFact[] = commanded
    .filter((f) =>
      ["exposure", "repeat-risk", "coerced", "restraint"].includes(f.kind),
    )
    .map((f) => ({
      ...f,
      physical: f.kind !== "exposure" || actualContext.residual >= 100,
    }));
  // Neglect must be supported before the order, by the intended board AND by
  // the actual board. An autonomous deviation cannot invent another grievance.
  const neglect: PoliticalFact[] = commanded.filter(
    (f) =>
      f.kind === "neglect" &&
      exchangeLoss(before.board, oldPos[f.subjectId], side) >= 100 &&
      exchangeLoss(after.board, pos[f.subjectId], side, actualContext.map) >=
        100,
  );
  for (const [id, q] of Object.entries(p.subjects).sort(([a], [b]) =>
    compareIds(a, b),
  )) {
    if (
      !q.hazard ||
      id === moverId ||
      !pos[id] ||
      !intendedPos[id] ||
      before.simulation!.subjects[id].side !== side ||
      neglect.some((f) => f.subjectId === id) ||
      commandContext.exempt ||
      before.ply < rulesFor(before).grace ||
      own - q.lastNeglect < cfg.neglectCooldown
    )
      continue;
    const previous = exchangeLoss(before.board, oldPos[id], side);
    if (
      previous >= 100 &&
      exchangeLoss(
        intendedAfter.board,
        intendedPos[id],
        side,
        commandContext.map,
      ) >= 100 &&
      exchangeLoss(after.board, pos[id], side, actualContext.map) >= 100 &&
      saferMove(before, oldPos[id], previous)
    )
      neglect.push({
        kind: "neglect",
        subjectId: id,
        sourceId: moverId,
        square: pos[id],
      });
  }
  facts.push(
    ...neglect
      .sort((a, b) => compareIds(a.subjectId, b.subjectId))
      .slice(0, cfg.neglectLimit),
  );
  for (const f of physical.filter((f) =>
    ["capture", "promotion", "safe", "protection"].includes(f.kind),
  )) {
    const playerCredit =
      order.outcome === "obeyed" ||
      commanded.some(
        (c) =>
          c.kind === f.kind &&
          c.subjectId === f.subjectId &&
          (f.kind !== "protection" || sameSquare(c.square, f.square)),
      );
    facts.push({ ...f, playerCredit });
  }
  return facts;
}
