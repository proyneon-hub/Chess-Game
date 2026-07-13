import { type Board, type Square, applyMove, isInCheck, isWhite } from "@/lib/chess";
import { type MoveAttempt, type Side, getAllLegalMoves } from "@/lib/game";

// ---------------------------------------------------------------------------
// Material values (centipawns)
// ---------------------------------------------------------------------------
const MATERIAL: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// ---------------------------------------------------------------------------
// Piece-square tables for WHITE pieces (row 0 = rank 8, row 7 = rank 1).
// For black pieces the table is mirrored vertically (7 - row).
// Positive values = preferred squares for that piece type.
// ---------------------------------------------------------------------------
const PST: Record<string, number[][]> = {
  p: [
    [  0,   0,   0,   0,   0,   0,   0,   0],
    [ 50,  50,  50,  50,  50,  50,  50,  50],
    [ 10,  10,  20,  30,  30,  20,  10,  10],
    [  5,   5,  10,  25,  25,  10,   5,   5],
    [  0,   0,   0,  20,  20,   0,   0,   0],
    [  5,  -5, -10,   0,   0, -10,  -5,   5],
    [  5,  10,  10, -20, -20,  10,  10,   5],
    [  0,   0,   0,   0,   0,   0,   0,   0],
  ],
  n: [
    [-50, -40, -30, -30, -30, -30, -40, -50],
    [-40, -20,   0,   0,   0,   0, -20, -40],
    [-30,   0,  10,  15,  15,  10,   0, -30],
    [-30,   5,  15,  20,  20,  15,   5, -30],
    [-30,   0,  15,  20,  20,  15,   0, -30],
    [-30,   5,  10,  15,  15,  10,   5, -30],
    [-40, -20,   0,   5,   5,   0, -20, -40],
    [-50, -40, -30, -30, -30, -30, -40, -50],
  ],
  b: [
    [-20, -10, -10, -10, -10, -10, -10, -20],
    [-10,   0,   0,   0,   0,   0,   0, -10],
    [-10,   0,   5,  10,  10,   5,   0, -10],
    [-10,   5,   5,  10,  10,   5,   5, -10],
    [-10,   0,  10,  10,  10,  10,   0, -10],
    [-10,  10,  10,  10,  10,  10,  10, -10],
    [-10,   5,   0,   0,   0,   0,   5, -10],
    [-20, -10, -10, -10, -10, -10, -10, -20],
  ],
  r: [
    [  0,   0,   0,   0,   0,   0,   0,   0],
    [  5,  10,  10,  10,  10,  10,  10,   5],
    [ -5,   0,   0,   0,   0,   0,   0,  -5],
    [ -5,   0,   0,   0,   0,   0,   0,  -5],
    [ -5,   0,   0,   0,   0,   0,   0,  -5],
    [ -5,   0,   0,   0,   0,   0,   0,  -5],
    [ -5,   0,   0,   0,   0,   0,   0,  -5],
    [  0,   0,   0,   5,   5,   0,   0,   0],
  ],
  q: [
    [-20, -10, -10,  -5,  -5, -10, -10, -20],
    [-10,   0,   0,   0,   0,   0,   0, -10],
    [-10,   0,   5,   5,   5,   5,   0, -10],
    [ -5,   0,   5,   5,   5,   5,   0,  -5],
    [  0,   0,   5,   5,   5,   5,   0,  -5],
    [-10,   5,   5,   5,   5,   5,   0, -10],
    [-10,   0,   5,   0,   0,   0,   0, -10],
    [-20, -10, -10,  -5,  -5, -10, -10, -20],
  ],
  k: [
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-20, -30, -30, -40, -40, -30, -30, -20],
    [-10, -20, -20, -20, -20, -20, -20, -10],
    [ 20,  20,   0,   0,   0,   0,  20,  20],
    [ 20,  30,  10,   0,   0,  10,  30,  20],
  ],
};

// ---------------------------------------------------------------------------
// Static evaluation — positive = white advantage, negative = black advantage.
// Operates on pure board state with no RPG layer.
// ---------------------------------------------------------------------------
const evaluateBoard = (board: Board): number => {
  let score = 0;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;
      const kind = piece.toLowerCase();
      const material = MATERIAL[kind] ?? 0;
      const pstRow = isWhite(piece) ? row : 7 - row;
      const positional = PST[kind]?.[pstRow]?.[col] ?? 0;
      if (isWhite(piece)) {
        score += material + positional;
      } else {
        score -= material + positional;
      }
    }
  }
  return score;
};

// ---------------------------------------------------------------------------
// Minimax with alpha-beta pruning.
// isWhiteTurn = true  → maximising node (white wants highest score)
// isWhiteTurn = false → minimising node (black wants lowest score)
// Checkmate scores are depth-adjusted to prefer faster mates.
// ---------------------------------------------------------------------------
const minimax = (
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  isWhiteTurn: boolean,
): number => {
  if (depth === 0) return evaluateBoard(board);

  const moves = getAllLegalMoves(board, isWhiteTurn ? "white" : "black");

  if (moves.length === 0) {
    if (isInCheck(board, isWhiteTurn)) {
      // Current side is checkmated — prefer mates that arrive sooner
      return isWhiteTurn ? -99000 - depth : 99000 + depth;
    }
    return 0; // Stalemate
  }

  if (isWhiteTurn) {
    let best = -Infinity;
    for (const move of moves) {
      const next = applyMove(board, move.from, move.to);
      const score = minimax(next, depth - 1, alpha, beta, false);
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of moves) {
      const next = applyMove(board, move.from, move.to);
      const score = minimax(next, depth - 1, alpha, beta, true);
      if (score < best) best = score;
      if (score < beta) beta = score;
      if (beta <= alpha) break;
    }
    return best;
  }
};

// ---------------------------------------------------------------------------
// Public API — returns all legal moves for `side` sorted best-first.
// The search is pure chess (RPG dice are not applied during tree traversal);
// the caller feeds the top-ranked move through the normal submitMove path,
// falling back to the next ranked move if the RPG layer rejects it.
// ---------------------------------------------------------------------------
export const getBestMoves = (board: Board, side: Side, depth: number): MoveAttempt[] => {
  const isBlack = side === "black";
  const moves = getAllLegalMoves(board, side);

  const scored = moves.map((move) => {
    const next = applyMove(board, move.from, move.to);
    // After the root move, the opponent replies — so flip isWhiteTurn
    const score = minimax(next, depth - 1, -Infinity, Infinity, isBlack);
    return { move, score };
  });

  // Black wants the lowest score; white wants the highest
  scored.sort((a, b) => (isBlack ? a.score - b.score : b.score - a.score));

  return scored.map((s) => s.move);
};
