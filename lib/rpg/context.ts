import {
  type Board,
  type Square,
  type Side,
  getAttacks,
  findKing,
  applyMove,
} from "@/lib/chess";
import { material, sideOf } from "@/lib/chessRules";
import type { GameState, MoveAttempt } from "@/lib/game/types";
export const distance = (a: Square, b: Square) =>
  Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
export const locations = (
  s: Pick<GameState, "pieceIds">,
): Record<string, Square> => {
  const out: Record<string, Square> = {};
  s.pieceIds.forEach((row, r) =>
    row.forEach((id, c) => {
      if (id) out[id] = [r, c];
    }),
  );
  return out;
};
export type AttackMap = Record<Side, Square[][]>;
export function attackMap(board: Board): AttackMap {
  const map: AttackMap = {
    white: Array.from({ length: 64 }, () => []),
    black: Array.from({ length: 64 }, () => []),
  };
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p)
        for (const [tr, tc] of getAttacks(board, r, c))
          map[sideOf(p)][tr * 8 + tc].push([r, c]);
    }
  return map;
}
export const attackers = (map: AttackMap, sq: Square, side: Side) =>
  map[side][sq[0] * 8 + sq[1]];
export const opposite = (side: Side): Side =>
  side === "white" ? "black" : "white";
// Shallow static exchange: an undefended attacked piece loses its value;
// a defended piece can be exchanged for the least valuable attacker. This is
// deliberately a risk signal, not a tactical verdict or a legality rule.
export function exchangeLoss(
  board: Board,
  sq: Square,
  side: Side,
  map = attackMap(board),
): number {
  const enemies = attackers(map, sq, opposite(side));
  if (!enemies.length) return 0;
  const value = material[board[sq[0]][sq[1]]?.toLowerCase() ?? "p"];
  const cheapest = Math.min(
    ...enemies.map(([r, c]) => material[board[r][c]!.toLowerCase()]),
  );
  return Math.max(0, value - (attackers(map, sq, side).length ? cheapest : 0));
}
export function moveContext(s: GameState, m: MoveAttempt) {
  const sub = s.simulation!.subjects[s.pieceIds[m.from[0]][m.from[1]]!],
    map = attackMap(s.board),
    next = applyMove(s.board, m.from, m.to, m.promotion, s.rights),
    after = attackMap(next);
  const king = findKing(s.board, m.side === "white")!;
  const defenders = attackers(after, m.to, m.side)
    .map(([r, c]) => s.pieceIds[r][c])
    .filter(Boolean) as string[];
  const disputeRelevant =
    defenders.length === 1 && !!sub.relationships[defenders[0]]?.disputed;
  return {
    sub,
    king,
    currentlyAttacked: attackers(map, m.from, opposite(m.side)).length > 0,
    isolatedFromKing: distance(m.from, king) > 2,
    disputeRelevant,
    beforeLoss: exchangeLoss(s.board, m.from, m.side, map),
    afterLoss: exchangeLoss(next, m.to, m.side, after),
    defenders,
  };
}
