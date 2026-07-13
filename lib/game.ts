import {
  type Board,
  type Square,
  INITIAL_BOARD,
  applyMove,
  getLegalMoves,
  hasAnyLegalMoves,
  isInCheck,
  isWhite,
} from "@/lib/chess";
import {
  type PieceIdBoard,
  type RpgState,
  initializePieceIds,
  initializeRpgState,
  resolveMoveAttempt,
} from "@/lib/rpgChess";

export type Side = "white" | "black";
export type GameKind = "local" | "computer" | "online";
export type Difficulty = "normal" | "advanced";
export const DEPTH_FOR: Record<Difficulty, number> = { normal: 2, advanced: 4 };
export type MatchStatus = "waiting" | "active" | "finished";

export type MoveRecord = {
  number: number;
  text: string;
  message: string;
  special: boolean;
};

export type GameState = {
  board: Board;
  pieceIds: PieceIdBoard;
  rpgState: RpgState;
  sideToMove: Side;
  status: MatchStatus;
  result: string | null;
  lastMove: [Square, Square] | null;
  specialSquare: Square | null;
  moves: MoveRecord[];
};

export type MoveAttempt = {
  from: Square;
  to: Square;
  side: Side;
};

export type MoveResult = {
  state: GameState;
  accepted: boolean;
  message: string;
  special: boolean;
};

const squareName = ([row, col]: Square) =>
  `${String.fromCharCode(97 + col)}${8 - row}`;

const pieceName = (piece: string) => {
  const names: Record<string, string> = {
    k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn",
  };
  return `${isWhite(piece) ? "White" : "Black"} ${names[piece.toLowerCase()]}`;
};

export const createGameState = (): GameState => {
  const board = INITIAL_BOARD.map((row) => [...row]);
  const pieceIds = initializePieceIds(board);
  return {
    board,
    pieceIds,
    rpgState: initializeRpgState(board, pieceIds),
    sideToMove: "white",
    status: "active",
    result: null,
    lastMove: null,
    specialSquare: null,
    moves: [],
  };
};

// This is the single gameplay boundary for all modes. The caller only submits
// an intended chess move; the hidden RPG layer decides whether and how it lands.
export const submitMove = (state: GameState, attempt: MoveAttempt): MoveResult => {
  if (state.status !== "active") {
    return { state, accepted: false, message: "This game has already ended.", special: false };
  }
  if (attempt.side !== state.sideToMove) {
    return { state, accepted: false, message: "It is not your turn.", special: false };
  }
  const piece = state.board[attempt.from[0]][attempt.from[1]];
  const isCorrectSide = piece && (isWhite(piece) ? "white" : "black") === attempt.side;
  const legal = isCorrectSide && getLegalMoves(
    state.board,
    attempt.from[0],
    attempt.from[1],
    attempt.side === "white"
  ).some(([row, col]) => row === attempt.to[0] && col === attempt.to[1]);
  if (!legal) {
    return { state, accepted: false, message: "That move is not available.", special: false };
  }

  const resolution = resolveMoveAttempt(
    state.board,
    state.pieceIds,
    state.rpgState,
    attempt.from,
    attempt.to
  );
  if (!resolution.allowed) {
    return {
      state: { ...state, rpgState: resolution.rpgState },
      accepted: false,
      message: resolution.publicMessage,
      special: false,
    };
  }

  const board = applyMove(state.board, attempt.from, resolution.destination);
  const sideToMove: Side = attempt.side === "white" ? "black" : "white";
  const nextInCheck = isInCheck(board, sideToMove === "white");
  const nextHasMoves = hasAnyLegalMoves(board, sideToMove === "white");
  const result = !nextHasMoves
    ? nextInCheck
      ? `Checkmate - ${attempt.side === "white" ? "White" : "Black"} wins!`
      : "Stalemate - draw!"
    : null;
  const moveText = `${pieceName(piece)} ${squareName(attempt.from)} -> ${squareName(resolution.destination)}`;
  const message = result ?? (nextInCheck ? "Check!" : resolution.publicMessage || moveText);
  const move: MoveRecord = {
    number: state.moves.length + 1,
    text: `${state.moves.length + 1}. ${moveText}`,
    message,
    special: resolution.ruleBreak,
  };
  return {
    state: {
      ...state,
      board,
      pieceIds: resolution.pieceIds,
      rpgState: resolution.rpgState,
      sideToMove,
      status: result ? "finished" : "active",
      result,
      lastMove: [attempt.from, resolution.destination],
      specialSquare: resolution.ruleBreak ? resolution.destination : null,
      moves: [...state.moves, move],
    },
    accepted: true,
    message,
    special: resolution.ruleBreak,
  };
};

export const getAllLegalMoves = (board: Board, side: Side): MoveAttempt[] => {
  const moves: MoveAttempt[] = [];
  const white = side === "white";
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      if (!board[row][col] || isWhite(board[row][col]) !== white) continue;
      for (const to of getLegalMoves(board, row, col, white)) {
        moves.push({ from: [row, col], to, side });
      }
    }
  }
  return moves;
};
