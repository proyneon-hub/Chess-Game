export type Piece = string | null;
export type Board = Piece[][];
export type Square = [number, number];

// Maps the compact board representation used by the engine to visible
// Unicode chess glyphs. Uppercase pieces are white; lowercase pieces are black.
export const PIECE_SYMBOLS: Record<string, string> = {
  K: "\u2654", Q: "\u2655", R: "\u2656", B: "\u2657", N: "\u2658", P: "\u2659",
  k: "\u265a", q: "\u265b", r: "\u265c", b: "\u265d", n: "\u265e", p: "\u265f",
};

// The board is stored as rows from Black's back rank to White's back rank.
// That means row 0 is rank 8 and row 7 is rank 1 when rendered on screen.
export const INITIAL_BOARD: Board = [
  ["r","n","b","q","k","b","n","r"],
  ["p","p","p","p","p","p","p","p"],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  ["P","P","P","P","P","P","P","P"],
  ["R","N","B","Q","K","B","N","R"],
];

// Color is encoded by case so piece checks stay lightweight throughout the
// move-generation code.
export const isWhite = (p: Piece): boolean => !!p && p === p.toUpperCase();

// Shared board helpers keep every piece rule from repeating the same boundary
// and friendly-piece checks.
const inBounds = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
const sameColor = (a: Piece, b: Piece) =>
  (!!a && !!b) && (isWhite(a) === isWhite(b));

// Returns every move a piece could make from this square before considering
// whether that move leaves its own king in check. This is useful both for
// highlighting candidate moves and for asking which squares enemy pieces attack.
export function getPseudoMoves(board: Board, row: number, col: number): Square[] {
  const p = board[row][col];
  if (!p) return [];
  const t = p.toLowerCase();
  const moves: Square[] = [];

  // Sliding pieces move one step at a time in a direction until they hit the
  // edge of the board, a friendly piece, or an enemy piece they can capture.
  const slide = (dr: number, dc: number) => {
    let r = row + dr, c = col + dc;
    while (inBounds(r, c)) {
      if (board[r][c]) {
        if (!sameColor(p, board[r][c])) moves.push([r, c]);
        break;
      }
      moves.push([r, c]);
      r += dr; c += dc;
    }
  };

  if (t === "p") {
    // Pawns move toward the opposite side of the array: white decreases rows,
    // black increases rows. Their starting rank controls the two-square push.
    const dir = isWhite(p) ? -1 : 1;
    const startRow = isWhite(p) ? 6 : 1;
    if (inBounds(row + dir, col) && !board[row + dir][col]) {
      moves.push([row + dir, col]);
      if (row === startRow && !board[row + 2 * dir][col])
        moves.push([row + 2 * dir, col]);
    }
    // Pawns capture only diagonally, and only when an opposing piece is present.
    for (const dc of [-1, 1]) {
      if (
        inBounds(row + dir, col + dc) &&
        board[row + dir][col + dc] &&
        !sameColor(p, board[row + dir][col + dc])
      ) moves.push([row + dir, col + dc]);
    }
  } else if (t === "r") {
    // Rooks slide horizontally and vertically.
    [[0,1],[0,-1],[1,0],[-1,0]].forEach(([dr,dc]) => slide(dr, dc));
  } else if (t === "b") {
    // Bishops slide diagonally.
    [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([dr,dc]) => slide(dr, dc));
  } else if (t === "q") {
    // Queens combine rook and bishop directions.
    [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([dr,dc]) => slide(dr, dc));
  } else if (t === "n") {
    // Knights jump directly to their L-shaped destinations, so blockers do
    // not matter. They only need bounds and same-color checks.
    [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc]) => {
      if (inBounds(row+dr, col+dc) && !sameColor(p, board[row+dr][col+dc]))
        moves.push([row+dr, col+dc]);
    });
  } else if (t === "k") {
    // Kings can step to any adjacent square. Castling is intentionally not
    // represented in this simplified move set.
    [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,dc]) => {
      if (inBounds(row+dr, col+dc) && !sameColor(p, board[row+dr][col+dc]))
        moves.push([row+dr, col+dc]);
    });
  }

  return moves;
}

// Produces a new board with a move applied, leaving the previous board object
// untouched so React state updates can compare by reference. Pawns promote to
// queens automatically when they reach the back rank.
export function applyMove(board: Board, from: Square, to: Square): Board {
  const newBoard = board.map(r => [...r]);
  let piece = newBoard[from[0]][from[1]];
  newBoard[from[0]][from[1]] = null;
  if (piece === "P" && to[0] === 0) piece = "Q";
  if (piece === "p" && to[0] === 7) piece = "q";
  newBoard[to[0]][to[1]] = piece;
  return newBoard;
}

// Locates the requested king. Returning null keeps the rest of the engine
// defensive if a board is ever malformed or a king has been removed.
export function findKing(board: Board, white: boolean): Square | null {
  const king = white ? "K" : "k";
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c] === king) return [r, c];
  return null;
}

// A side is in check when any opposing pseudo-move attacks that side's king.
// Pseudo-moves are correct here because enemy pieces only need to show attacked
// squares; their own king safety is irrelevant to detecting the current attack.
export function isInCheck(board: Board, white: boolean): boolean {
  const kp = findKing(board, white);
  if (!kp) return false;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || isWhite(p) === white) continue;
      if (getPseudoMoves(board, r, c).some(([mr, mc]) => mr === kp[0] && mc === kp[1]))
        return true;
    }
  return false;
}

// Legal moves start from pseudo-moves, then remove king captures and every move
// that would leave the moving side's king in check after the board changes.
export function getLegalMoves(board: Board, row: number, col: number, whiteTurn: boolean): Square[] {
  const p = board[row][col];
  if (!p || isWhite(p) !== whiteTurn) return [];
  return getPseudoMoves(board, row, col).filter(
    ([tr, tc]) => board[tr][tc]?.toLowerCase() !== "k" &&
      !isInCheck(applyMove(board, [row, col], [tr, tc]), whiteTurn)
  );
}

// Used after each move to decide whether the next player is checkmated,
// stalemated, or still able to continue.
export function hasAnyLegalMoves(board: Board, whiteTurn: boolean): boolean {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && isWhite(p) === whiteTurn && getLegalMoves(board, r, c, whiteTurn).length > 0)
        return true;
    }
  return false;
}
