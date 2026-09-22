import {
  evaluateObjective,
  projectBoard,
} from "@/lib/rpg/encounters/objectives";
import { materializeView } from "./leadershipView";
import {
  type Board,
  type ChessRights,
  type Side,
  applyMove,
  freshRights,
  hasAnyLegalMoves,
  isInCheck,
} from "@/lib/chess";
import {
  allMoves,
  type ChessMove,
  insufficientMaterial,
  material,
  nextRights,
  positionKey,
} from "@/lib/chessRules";
import { evaluateBoard } from "@/lib/ai";
import { politicalScore, type OwnPolitics } from "@/lib/ai/politicalEvaluation";
export type SearchInput = {
  board: Board;
  rights: ChessRights;
  side: Side;
  depth: number;
  budgetMs: number;
  maxNodes?: number;
  own: OwnPolitics | null;
  /** Repetition counts from the game; omitted by offline measurement. */
  positions?: Record<string, number>;
};
export type SearchResult = {
  scores?: { move: ChessMove; score: number }[];
  moves: ChessMove[];
  completedDepth: number;
  nodes: number;
  elapsedMs: number;
};
export function searchMoves(input: SearchInput): SearchResult {
  const start = performance.now(),
    deadline = start + input.budgetMs;
  let nodes = 0,
    completedDepth = 0;
  const timeout = {};
  const sign = input.side === "white" ? 1 : -1;
  const ordered = (board: Board, moves: ChessMove[], rights: ChessRights) =>
    moves
      .map((move) => {
        const next = applyMove(
          board,
          move.from,
          move.to,
          move.promotion,
          rights,
        );
        return {
          move,
          next,
          score:
            (material[board[move.to[0]][move.to[1]]?.toLowerCase() ?? ""] ??
              0) *
              10 -
            (material[board[move.from[0]][move.from[1]]!.toLowerCase()] ?? 0) +
            Number(isInCheck(next, move.side !== "white")) * 1000 +
            Number(!!move.promotion) * 800,
        };
      })
      .sort((a, b) => b.score - a.score);
  const negamax = (
    board: Board,
    rights: ChessRights,
    side: Side,
    depth: number,
    alpha: number,
    beta: number,
    ply: number,
  ): number => {
    nodes++;
    if (
      nodes % 32 === 0 &&
      (performance.now() >= deadline || nodes >= (input.maxNodes ?? Infinity))
    )
      throw timeout;
    // Terminal detection precedes static evaluation even at the horizon. A
    // leaf only needs to know whether any legal move exists.
    const legal = depth === 0 ? null : allMoves(board, side, rights);
    if (
      legal ? !legal.length : !hasAnyLegalMoves(board, side === "white", rights)
    )
      return isInCheck(board, side === "white") ? -99000 + ply : 0;
    if (insufficientMaterial(board) || rights.halfmove >= 150) return 0;
    if (!legal) return evaluateBoard(board) * (side === "white" ? 1 : -1);
    let best = -Infinity;
    for (const { move, next } of ordered(board, legal, rights)) {
      const score = -negamax(
        next,
        nextRights(board, rights, move),
        side === "white" ? "black" : "white",
        depth - 1,
        -beta,
        -alpha,
        ply + 1,
      );
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
      if (alpha >= beta) break;
    }
    return best;
  };
  const candidates = ordered(
    input.board,
    allMoves(input.board, input.side, input.rights),
    input.rights,
  );
  let ranked = candidates
    .map((c) => ({
      move: c.move,
      next: c.next,
      score: evaluateBoard(c.next) * sign,
    }))
    .sort((a, b) => b.score - a.score);
  for (let depth = 1; depth <= input.depth; depth++) {
    try {
      const iteration = ranked.map((c) => ({
        ...c,
        score: -negamax(
          c.next,
          nextRights(input.board, input.rights, c.move),
          input.side === "white" ? "black" : "white",
          depth - 1,
          -Infinity,
          Infinity,
          1,
        ),
      }));
      ranked = iteration.sort((a, b) => b.score - a.score);
      completedDepth = depth;
    } catch (e) {
      if (e !== timeout) throw e;
      break;
    }
    if (performance.now() >= deadline) break;
  }
  if (input.positions) {
    // Mirror the game's repetition bookkeeping: irreversible moves reset it.
    // A fifth occurrence is an automatic draw; a third lets the opponent
    // claim one, so a winning side treats it as a draw.
    const positions = input.positions;
    ranked = ranked
      .map((c) => {
        const rights = nextRights(input.board, input.rights, c.move);
        const reset =
          !rights.halfmove ||
          JSON.stringify(rights.castling) !==
            JSON.stringify(input.rights.castling);
        const seen = reset
          ? 1
          : (positions[
              positionKey(
                c.next,
                input.side === "white" ? "black" : "white",
                rights,
              )
            ] ?? 0) + 1;
        return seen >= 5 || (seen >= 3 && c.score > 0) ? { ...c, score: 0 } : c;
      })
      .sort((a, b) => b.score - a.score);
  }
  let shortlist = ranked.slice(0, 8);
  if (input.own?.view?.simulation.schemaVersion === 5) {
    const view = materializeView(input.own.view);
    if (view.simulation?.schemaVersion === 5) {
      const objectives = view.simulation.encounters.active.filter(
        (e) => e.side === input.side,
      );
      const responses = ranked
        .filter((c) =>
          objectives.some((e) => {
            const response = evaluateObjective(
              view,
              projectBoard(view, c.move),
              c.move,
              e.objective,
            );
            return response.success || response.progress;
          }),
        )
        .slice(0, 2);
      shortlist = [
        ...responses,
        ...shortlist.filter((c) => !responses.some((r) => r.move === c.move)),
      ].slice(0, 10);
    }
  }
  if (input.own?.plot) {
    // Include an actual court defense even when chess-only ranking omits it.
    const defensive = ranked
      .map((c) => ({
        ...c,
        politics: politicalScore(input.board, c.next, c.move, input.own),
      }))
      .sort((a, b) => b.politics - a.politics || b.score - a.score)
      .slice(0, 2);
    shortlist = [
      ...defensive,
      ...shortlist.filter((c) => !defensive.some((d) => d.move === c.move)),
    ].slice(0, 8);
  }
  shortlist = shortlist
    .map((c) => ({
      ...c,
      score:
        Math.abs(c.score) >= 98000
          ? c.score
          : c.score + politicalScore(input.board, c.next, c.move, input.own),
    }))
    .sort((a, b) => b.score - a.score);
  return {
    ...(input.own?.view
      ? { scores: ranked.map((c) => ({ move: c.move, score: c.score })) }
      : {}),
    moves: [
      ...shortlist.map((c) => c.move),
      ...ranked
        .filter((c) => !shortlist.some((x) => x.move === c.move))
        .map((c) => c.move),
    ],
    completedDepth,
    nodes,
    elapsedMs: performance.now() - start,
  };
}
export const getBestMoves = (board: Board, side: Side, depth: number) =>
  searchMoves({
    board,
    side,
    rights: freshRights(false),
    depth,
    budgetMs: depth > 2 ? 1000 : 250,
    own: null,
  }).moves;
