import { applyMove, sameSquare, type Square } from "@/lib/chess";
import { allMoves, captureSquare } from "@/lib/chessRules";
import type { GameState, MoveAttempt } from "@/lib/game/types";
import {
  attackMap,
  attackers,
  distance,
  exchangeLoss,
  locations,
} from "../context";
import type { Objective } from "./types";

// Board-only projection: no RNG, leadership mutations, receipts or rewards.
export function projectBoard(s: GameState, m: MoveAttempt): GameState {
  const pieceIds = s.pieceIds.map((r) => [...r]);
  const captured = captureSquare(s.board, m);
  if (captured) pieceIds[captured[0]][captured[1]] = null;
  pieceIds[m.to[0]][m.to[1]] = pieceIds[m.from[0]][m.from[1]];
  pieceIds[m.from[0]][m.from[1]] = null;
  if (
    s.board[m.from[0]][m.from[1]]?.toLowerCase() === "k" &&
    Math.abs(m.to[1] - m.from[1]) === 2
  ) {
    const c = m.to[1] === 6 ? 7 : 0,
      target = m.to[1] === 6 ? 5 : 3;
    pieceIds[m.from[0]][target] = pieceIds[m.from[0]][c];
    pieceIds[m.from[0]][c] = null;
  }
  return {
    ...s,
    board: applyMove(s.board, m.from, m.to, m.promotion, s.rights),
    pieceIds,
  };
}
export function effectiveDefenders(s: GameState, id: string): string[] {
  const sq = locations(s)[id];
  if (!sq) return [];
  const side = s.simulation!.subjects[id].side;
  return attackers(attackMap(s.board), sq, side)
    .map(([r, c]) => s.pieceIds[r][c]!)
    .filter(Boolean);
}
export function defensiveWards(s: GameState, id: string): string[] {
  const side = s.simulation!.subjects[id].side;
  return Object.values(s.simulation!.subjects)
    .filter(
      (sub) =>
        sub.id !== id &&
        sub.side === side &&
        sub.status === "active" &&
        effectiveDefenders(s, sub.id).includes(id),
    )
    .map((sub) => sub.id);
}
// Saved objectives must stay finite and within validation bounds; lossOf itself
// returns Infinity for an off-board subject so comparisons treat it as worst.
export const MAX_STORED_LOSS = 20000;
export const storedLoss = (loss: number) => Math.min(loss, MAX_STORED_LOSS);
export function lossOf(s: GameState, id: string): number {
  const sq = locations(s)[id];
  return sq
    ? exchangeLoss(s.board, sq, s.simulation!.subjects[id].side)
    : Infinity;
}
export function developing(s: GameState, id: string, to: Square): boolean {
  const sub = s.simulation!.subjects[id];
  const home = sub.side === "white" ? 7 : 0;
  return sub.currentKind === "p"
    ? sub.side === "white"
      ? to[0] < 6
      : to[0] > 1
    : to[0] !== home;
}
export type Response = {
  success: boolean;
  progress: boolean;
  interaction: boolean;
  separated: number;
  helper: string | null;
};
export function evaluateObjective(
  before: GameState,
  after: GameState,
  m: MoveAttempt,
  o: Objective,
): Response {
  const mover = before.pieceIds[m.from[0]][m.from[1]]!,
    pos = locations(after);
  const result: Response = {
    success: false,
    progress: false,
    interaction: false,
    separated: 0,
    helper: null,
  };
  if (o.kind === "develop" || o.kind === "confidence") {
    result.interaction = mover === o.subject;
    result.success =
      result.interaction &&
      !!pos[o.subject] &&
      lossOf(after, o.subject) < 100 &&
      (o.kind === "confidence" ||
        developing(before, o.subject, pos[o.subject]));
  } else if (o.kind === "protect" || o.kind === "relieve") {
    if (!pos[o.subject]) return result;
    const reduced =
      o.initialLoss - lossOf(after, o.subject) >= 100 &&
      lossOf(before, o.subject) - lossOf(after, o.subject) >= 100;
    const defenders = effectiveDefenders(after, o.subject);
    const assumed = defenders.includes(mover) && !o.defenders.includes(mover);
    const rotated =
      o.kind === "relieve" &&
      mover !== o.subject &&
      o.wards.some(
        (id) =>
          pos[id] &&
          effectiveDefenders(after, id).includes(mover) &&
          !effectiveDefenders(before, id).includes(mover) &&
          lossOf(after, id) <= lossOf(before, id),
      );
    result.interaction = mover === o.subject || assumed || reduced || rotated;
    result.success =
      o.kind === "protect" ? reduced && result.interaction : rotated;
    result.helper = result.success && mover !== o.subject ? mover : null;
  } else {
    const [a, b] = o.pair;
    if (!pos[a] || !pos[b]) return result;
    const pairMove = mover === a || mover === b;
    const protectedIds = [a, b].filter(
      (id) =>
        lossOf(before, id) - lossOf(after, id) >= 100 &&
        (id === mover || effectiveDefenders(after, id).includes(mover)),
    );
    const separate = distance(pos[a], pos[b]) > 3;
    result.separated = separate ? ("separated" in o ? o.separated : 0) + 1 : 0;
    result.interaction = pairMove || protectedIds.length > 0;
    result.progress =
      (o.kind === "recover" || o.kind === "mediate") &&
      result.separated === 1 &&
      pairMove;
    if (o.kind === "mediate") {
      const rival = mover === a ? b : a;
      const independent =
        pairMove &&
        lossOf(after, mover) < 100 &&
        !effectiveDefenders(after, mover).includes(rival);
      result.success =
        independent || protectedIds.length > 0 || result.separated >= 2;
    } else if (o.kind === "recover") {
      result.success = protectedIds.length > 0 || result.separated >= 2;
    } else {
      result.success =
        o.concern === "safety"
          ? protectedIds.length > 0
          : pairMove && lossOf(after, mover) < 100 && !sameSquare(m.from, m.to);
    }
    result.helper =
      protectedIds.length && mover !== protectedIds[0] ? mover : null;
  }
  return result;
}
export function responseMoves(
  s: GameState,
  side: MoveAttempt["side"],
  objective: Objective,
): MoveAttempt[] {
  return allMoves(s.board, side, s.rights).filter((m) => {
    const response = evaluateObjective(s, projectBoard(s, m), m, objective);
    return response.success || response.progress;
  });
}
export function isDependentOrder(
  s: GameState,
  m: MoveAttempt,
  pair: [string, string],
): boolean {
  const mover = s.pieceIds[m.from[0]][m.from[1]]!;
  if (!pair.includes(mover)) return false;
  const rival = pair.find((id) => id !== mover)!;
  const after = projectBoard(s, m),
    defenders = effectiveDefenders(after, mover);
  return (
    defenders.length === 1 &&
    defenders[0] === rival &&
    attackers(
      attackMap(after.board),
      m.to,
      m.side === "white" ? "black" : "white",
    ).length > 0
  );
}
export function dependentMove(
  s: GameState,
  pair: [string, string],
): MoveAttempt | undefined {
  return allMoves(s.board, s.simulation!.subjects[pair[0]].side, s.rights).find(
    (m) => isDependentOrder(s, m, pair),
  );
}
