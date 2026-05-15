export type Piece = string | null;
export type Board = Piece[][];
export type Square = [number, number];

export const PIECE_SYMBOLS: Record<string, string> = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

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

export const isWhite = (p: Piece): boolean => !!p && p === p.toUpperCase();
const inBounds = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
const sameColor = (a: Piece, b: Piece) =>
  (!!a && !!b) && (isWhite(a) === isWhite(b));

export function getPseudoMoves(board: Board, row: number, col: number): Square[] {
  const p = board[row][col];
  if (!p) return [];
  const t = p.toLowerCase();
  const moves: Square[] = [];

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
    const dir = isWhite(p) ? -1 : 1;
    const startRow = isWhite(p) ? 6 : 1;
    if (inBounds(row + dir, col) && !board[row + dir][col]) {
      moves.push([row + dir, col]);
      if (row === startRow && !board[row + 2 * dir][col])
        moves.push([row + 2 * dir, col]);
    }
    for (const dc of [-1, 1]) {
      if (
        inBounds(row + dir, col + dc) &&
        board[row + dir][col + dc] &&
        !sameColor(p, board[row + dir][col + dc])
      ) moves.push([row + dir, col + dc]);
    }
  } else if (t === "r") {
    [[0,1],[0,-1],[1,0],[-1,0]].forEach(([dr,dc]) => slide(dr, dc));
  } else if (t === "b") {
    [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([dr,dc]) => slide(dr, dc));
  } else if (t === "q") {
    [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([dr,dc]) => slide(dr, dc));
  } else if (t === "n") {
    [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc]) => {
      if (inBounds(row+dr, col+dc) && !sameColor(p, board[row+dr][col+dc]))
        moves.push([row+dr, col+dc]);
    });
  } else if (t === "k") {
    [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,dc]) => {
      if (inBounds(row+dr, col+dc) && !sameColor(p, board[row+dr][col+dc]))
        moves.push([row+dr, col+dc]);
    });
  }

  return moves;
}

export function applyMove(board: Board, from: Square, to: Square): Board {
  const newBoard = board.map(r => [...r]);
  let piece = newBoard[from[0]][from[1]];
  newBoard[from[0]][from[1]] = null;
  if (piece === "P" && to[0] === 0) piece = "Q";
  if (piece === "p" && to[0] === 7) piece = "q";
  newBoard[to[0]][to[1]] = piece;
  return newBoard;
}

export function findKing(board: Board, white: boolean): Square | null {
  const king = white ? "K" : "k";
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c] === king) return [r, c];
  return null;
}

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

export function getLegalMoves(board: Board, row: number, col: number, whiteTurn: boolean): Square[] {
  const p = board[row][col];
  if (!p || isWhite(p) !== whiteTurn) return [];
  return getPseudoMoves(board, row, col).filter(
    ([tr, tc]) => !isInCheck(applyMove(board, [row, col], [tr, tc]), whiteTurn)
  );
}

export function hasAnyLegalMoves(board: Board, whiteTurn: boolean): boolean {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && isWhite(p) === whiteTurn && getLegalMoves(board, r, c, whiteTurn).length > 0)
        return true;
    }
  return false;
}
