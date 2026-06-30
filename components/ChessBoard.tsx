"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  type Board,
  type Square,
  PIECE_SYMBOLS,
  INITIAL_BOARD,
  isWhite,
  applyMove,
  getLegalMoves,
  hasAnyLegalMoves,
  isInCheck,
} from "@/lib/chess";
import {
  type PieceIdBoard,
  type RpgState,
  describeKing,
  initializePieceIds,
  initializeRpgState,
  resolveMoveAttempt,
} from "@/lib/rpgChess";

// Board labels are separate from the board matrix so the UI can render chess
// coordinates while the engine continues to use zero-based row/column indexes.
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

type GameState = {
  board: Board;
  pieceIds: PieceIdBoard;
  rpgState: RpgState;
};

type EventLogEntry = {
  id: number;
  text: string;
  special?: boolean;
};

type MoveHistoryEntry = {
  id: number;
  text: string;
};

type StatusType = "info" | "success" | "warning" | "error" | "special";

type GameSnapshot = {
  gameState: GameState;
  whiteTurn: boolean;
  status: string | null;
  statusType: StatusType;
  gameOver: boolean;
  eventLog: EventLogEntry[];
  moveHistory: MoveHistoryEntry[];
  lastMove: [Square, Square] | null;
  specialSquare: Square | null;
};

const createInitialGameState = (): GameState => {
  const board = INITIAL_BOARD.map((r) => [...r]);
  const pieceIds = initializePieceIds(board);

  return {
    board,
    pieceIds,
    rpgState: initializeRpgState(board, pieceIds),
  };
};

const squareName = ([row, col]: Square) =>
  `${String.fromCharCode(97 + col)}${8 - row}`;

const pieceName = (piece: string) => {
  const color = isWhite(piece) ? "White" : "Black";
  const names: Record<string, string> = {
    k: "king",
    q: "queen",
    r: "rook",
    b: "bishop",
    n: "knight",
    p: "pawn",
  };

  return `${color} ${names[piece.toLowerCase()]}`;
};

const findKingSquare = (board: Board, white: boolean): Square | null => {
  const king = white ? "K" : "k";

  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) if (board[r][c] === king) return [r, c];

  return null;
};

const statusStyles: Record<StatusType, string> = {
  info: "border-blue-500/45 bg-slate-950/80 text-stone-200",
  success: "border-emerald-500/55 bg-slate-950/80 text-emerald-100",
  warning: "border-amber-500/65 bg-slate-950/80 text-amber-100",
  error: "border-red-500/65 bg-slate-950/80 text-red-100",
  special:
    "border-amber-300/75 bg-slate-950/80 text-amber-100 shadow-[0_0_24px_rgba(245,158,11,0.18)]",
};

export default function ChessBoard() {
  // Board state remains visible chess, while pieceIds/rpgState carry hidden
  // identity, morale, fatigue, dice rolls, and king influence.
  const [gameState, setGameState] = useState<GameState>(createInitialGameState);
  const { board, pieceIds, rpgState } = gameState;

  // selected is the currently active piece, while validMoves is the cached set
  // of legal destinations used both for click handling and visual highlights.
  const [selected, setSelected] = useState<Square | null>(null);
  const [validMoves, setValidMoves] = useState<Square[]>([]);

  // Turn, status, and terminal-game state are kept separate so the board can
  // display "Check!" without blocking further moves, but stop clicks after mate.
  const [whiteTurn, setWhiteTurn] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<StatusType>("info");
  const [gameOver, setGameOver] = useState(false);
  const [debugVisible, setDebugVisible] = useState(false);
  const [debugAvailable, setDebugAvailable] = useState(false);
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([
    { id: 1, text: "Game started. White to move." },
  ]);
  const nextEventId = useRef(2);
  const [specialSquare, setSpecialSquare] = useState<Square | null>(null);
  const [lastMove, setLastMove] = useState<[Square, Square] | null>(null);
  const [moveHistory, setMoveHistory] = useState<MoveHistoryEntry[]>([]);
  const [undoStack, setUndoStack] = useState<GameSnapshot[]>([]);

  const appendEvent = useCallback((text: string, special = false) => {
    const id = nextEventId.current;
    nextEventId.current += 1;
    setEventLog((events) => [{ id, text, special }, ...events].slice(0, 12));
  }, []);

  const clearSelection = useCallback(() => {
    setSelected(null);
    setValidMoves([]);
  }, []);

  const setMessage = useCallback((text: string | null, type: StatusType = "info") => {
    setStatus(text);
    setStatusType(type);
  }, []);

  useEffect(() => {
    setDebugAvailable(new URLSearchParams(window.location.search).has("debug"));
  }, []);

  const handleClick = useCallback(
    (row: number, col: number) => {
      if (gameOver) return;
      const piece = board[row][col];
      setSpecialSquare(null);

      if (selected) {
        // When a piece is already selected, a click either completes one of its
        // legal moves or clears the selection before possibly selecting again.
        const isMove = validMoves.some(([r, c]) => r === row && c === col);
        if (isMove) {
          const movingPiece = board[selected[0]][selected[1]];
          const resolution = resolveMoveAttempt(
            board,
            pieceIds,
            rpgState,
            selected,
            [row, col]
          );

          if (!resolution.allowed) {
            setGameState((current) => ({
              ...current,
              rpgState: resolution.rpgState,
            }));
            clearSelection();
            setMessage(resolution.publicMessage, "warning");
            appendEvent(resolution.publicMessage);
            return;
          }

          const destination = resolution.destination;
          const newBoard = applyMove(board, selected, destination);

          // After applying the move, evaluate the player who is about to move.
          // No legal moves plus check is checkmate; no legal moves without
          // check is stalemate.
          const nextTurn = !whiteTurn;
          const check = isInCheck(newBoard, nextTurn);
          const hasLegal = hasAnyLegalMoves(newBoard, nextTurn);
          let newStatus: string | null = null;
          let over = false;
          if (!hasLegal) {
            newStatus = check
              ? `Checkmate - ${whiteTurn ? "White" : "Black"} wins!`
              : "Stalemate - draw!";
            over = true;
          } else if (check) {
            newStatus = "Check!";
          }
          const snapshot: GameSnapshot = {
            gameState,
            whiteTurn,
            status,
            statusType,
            gameOver,
            eventLog,
            moveHistory,
            lastMove,
            specialSquare,
          };
          setUndoStack((stack) => [...stack, snapshot].slice(-20));
          setGameState({
            board: newBoard,
            pieceIds: resolution.pieceIds,
            rpgState: resolution.rpgState,
          });
          setWhiteTurn(nextTurn);
          clearSelection();
          const moveText = movingPiece
            ? `${pieceName(movingPiece)} ${squareName(selected)} -> ${squareName(destination)}`
            : `Move to ${squareName(destination)}`;
          const message = newStatus ?? resolution.publicMessage ?? moveText;
          const messageType: StatusType = newStatus
            ? check
              ? "warning"
              : "success"
            : resolution.ruleBreak
              ? "special"
              : resolution.outcome === "partial-success"
                ? "warning"
                : "success";
          setMessage(message, messageType);
          appendEvent(message, resolution.ruleBreak);
          if (resolution.ruleBreak) setSpecialSquare(destination);
          setLastMove([selected, destination]);
          setMoveHistory((history) => [
            ...history,
            {
              id: history.length + 1,
              text: `${history.length + 1}. ${moveText}`,
            },
          ]);
          setGameOver(over);
          return;
        }

        // Clicking outside the selected piece's legal destinations cancels the
        // highlight state. If that clicked square contains the current player's
        // piece, the selection logic below immediately selects it.
        clearSelection();
        if (!piece || isWhite(piece) !== whiteTurn) {
          setMessage("That piece cannot move there.", "error");
          appendEvent("Invalid move.");
          return;
        }
      }

      // Only the side to move can select pieces. Legal moves are computed once
      // here and reused until the player chooses a destination or cancels.
      if (piece && isWhite(piece) === whiteTurn) {
        const legal = getLegalMoves(board, row, col, whiteTurn);
        setSelected([row, col]);
        setValidMoves(legal);
        setMessage(`${pieceName(piece)} selected.`, "info");
      } else {
        setMessage(`Select a ${whiteTurn ? "White" : "Black"} piece.`, "info");
      }
    },
    [
      appendEvent,
      board,
      clearSelection,
      eventLog,
      gameOver,
      gameState,
      lastMove,
      moveHistory,
      pieceIds,
      rpgState,
      selected,
      setMessage,
      specialSquare,
      status,
      statusType,
      validMoves,
      whiteTurn,
    ]
  );

  // Reset all local game state back to a fresh copy of the initial position.
  const reset = () => {
    setGameState(createInitialGameState());
    setSelected(null);
    setValidMoves([]);
    setWhiteTurn(true);
    setMessage(null, "info");
    setGameOver(false);
    setSpecialSquare(null);
    setLastMove(null);
    setMoveHistory([]);
    setUndoStack([]);
    setEventLog([{ id: 1, text: "Game started. White to move." }]);
    nextEventId.current = 2;
  };

  const undo = () => {
    const snapshot = undoStack.at(-1);
    if (!snapshot) return;

    setGameState(snapshot.gameState);
    setWhiteTurn(snapshot.whiteTurn);
    setStatus(snapshot.status);
    setStatusType(snapshot.statusType);
    setGameOver(snapshot.gameOver);
    setEventLog([{ id: nextEventId.current, text: "Last move undone." }, ...snapshot.eventLog].slice(0, 12));
    nextEventId.current += 1;
    setMoveHistory(snapshot.moveHistory);
    setLastMove(snapshot.lastMove);
    setSpecialSquare(snapshot.specialSquare);
    clearSelection();
    setUndoStack((stack) => stack.slice(0, -1));
  };

  const statusMessage =
    status ??
    (selected
      ? "Choose a destination."
      : `${whiteTurn ? "White" : "Black"} to move. Select a piece.`);
  const checkedKingSquare = isInCheck(board, whiteTurn)
    ? findKingSquare(board, whiteTurn)
    : null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col items-center px-3 py-6 sm:px-6 lg:py-8">
      <div className="text-center">
        <h1 className="text-3xl font-light tracking-widest uppercase text-amber-600">
          Chess
        </h1>
        <div className="w-16 h-px bg-amber-600/40 mx-auto mt-2" />
      </div>

      <div className="mt-6 grid w-full max-w-[1080px] grid-cols-1 gap-5 lg:grid-cols-[minmax(320px,580px)_minmax(280px,360px)] lg:items-start lg:gap-8">
        <section className="mx-auto w-full max-w-[600px]">
          <div className="rounded-lg border border-amber-500/30 bg-black/45 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.45)] sm:p-3">
            {/* The rank labels sit beside the board and use the same square height so
                they stay aligned with each rendered row. */}
            <div className="chess-board flex items-start justify-center">
              <div className="flex flex-col">
                {RANKS.map((rank) => (
                  <div
                    key={rank}
                    className="h-[var(--square-size)] w-4 flex items-center justify-center text-stone-500 text-[10px] font-mono sm:w-5 sm:text-xs"
                  >
                    {rank}
                  </div>
                ))}
              </div>

              <div>
                <div
                  className="grid overflow-hidden border-2 border-stone-700 shadow-2xl"
                  style={{ gridTemplateColumns: "repeat(8, var(--square-size))" }}
                >
                  {board.map((row, r) =>
                    row.map((piece, c) => {
                      // Square color and overlay state are derived from board
                      // indexes and the currently cached legal-move list.
                      const light = (r + c) % 2 === 0;
                      const isSel = selected?.[0] === r && selected?.[1] === c;
                      const isMove = validMoves.some(
                        ([mr, mc]) => mr === r && mc === c
                      );
                      const isCapture = isMove && !!piece;
                      const isSpecial =
                        specialSquare?.[0] === r && specialSquare?.[1] === c;
                      const isLast =
                        !!lastMove &&
                        lastMove.some(([lr, lc]) => lr === r && lc === c);
                      const isCheckedKing =
                        checkedKingSquare?.[0] === r &&
                        checkedKingSquare?.[1] === c;

                      let bg = light ? "#f0d9b5" : "#b58863";
                      if (isSel) bg = "#7dd3fc";
                      else if (isMove && !piece) bg = light ? "#cdd16e" : "#aaa23a";

                      return (
                        <div
                          key={`${r}-${c}`}
                          onClick={() => handleClick(r, c)}
                          className="relative flex h-[var(--square-size)] w-[var(--square-size)] cursor-pointer select-none items-center justify-center touch-manipulation"
                          style={{ background: bg }}
                        >
                          {isLast && (
                            <div className="absolute inset-0 z-10 bg-yellow-300/25" />
                          )}
                          {isSpecial && (
                            <div className="absolute inset-0 z-20 animate-pulse border-4 border-amber-300 shadow-[0_0_18px_rgba(252,211,77,0.85)]" />
                          )}
                          {isCheckedKing && (
                            <div className="absolute inset-0 z-20 animate-[dangerPulse_1s_infinite_alternate] border-4 border-red-600/80" />
                          )}
                          {isSel && (
                            <div className="absolute inset-0 z-20 border-4 border-amber-400 shadow-[inset_0_0_18px_rgba(245,158,11,0.55)]" />
                          )}
                          {isCapture && (
                            <div className="absolute inset-0 z-20 border-4 border-red-600/80" />
                          )}
                          {isMove && !piece && (
                            <div className="z-20 h-4 w-4 rounded-full bg-emerald-700/75 sm:h-5 sm:w-5" />
                          )}
                          {piece && (
                            <span
                              className="z-30 text-3xl leading-none sm:text-5xl"
                              style={{
                                color: isWhite(piece) ? "#ffffff" : "#1a1008",
                                textShadow: isWhite(piece)
                                  ? "0 1px 4px rgba(0,0,0,0.9), 0 0 1px rgba(0,0,0,1)"
                                  : "0 1px 2px rgba(255,255,255,0.15)",
                              }}
                            >
                              {PIECE_SYMBOLS[piece]}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex">
                  {FILES.map((f) => (
                    <div
                      key={f}
                      className="flex h-[18px] w-[var(--square-size)] items-center justify-center text-stone-500 text-[10px] font-mono sm:text-xs"
                    >
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex gap-2 lg:hidden">
            <button
              onClick={reset}
              className="flex-1 rounded border border-stone-600 px-4 py-2 text-sm uppercase tracking-wider text-stone-300 transition-colors hover:bg-stone-900"
            >
              New Game
            </button>
            <button
              onClick={undo}
              disabled={undoStack.length === 0}
              className="flex-1 rounded border border-stone-600 px-4 py-2 text-sm uppercase tracking-wider text-stone-300 transition-colors hover:bg-stone-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Undo
            </button>
          </div>

          <details className="mt-4 border border-stone-800 bg-stone-950 px-4 py-3 text-sm text-stone-400 lg:hidden">
            <summary className="cursor-pointer text-xs uppercase tracking-wider text-stone-500">
              Show Event Log
            </summary>
            <div className="mt-3 max-h-36 space-y-2 overflow-auto">
              {eventLog.map((event) => (
                <div
                  key={event.id}
                  className={event.special ? "text-amber-300" : undefined}
                >
                  {event.text}
                </div>
              ))}
            </div>
          </details>
        </section>

        <aside className="mx-auto flex w-full max-w-xl flex-col gap-4 lg:max-w-none">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-bold text-stone-200">
            <span
              className={`h-3 w-3 rounded-full border border-stone-500 ${
                whiteTurn ? "bg-white" : "bg-stone-950"
              }`}
            />
            {gameOver
              ? "Game Over"
              : `${whiteTurn ? "White" : "Black"} to Move`}
          </div>

          <div
            className={`rounded border px-4 py-3 text-sm leading-relaxed ${statusStyles[statusType]}`}
          >
            {statusMessage}
          </div>

          <div className="hidden border border-stone-800 bg-stone-950 px-4 py-3 text-sm text-stone-400 lg:block">
            <div className="mb-2 text-xs uppercase tracking-wider text-stone-500">
              Move History
            </div>
            <div className="max-h-40 space-y-2 overflow-auto">
              {moveHistory.length === 0 ? (
                <div>No moves yet.</div>
              ) : (
                moveHistory.map((move) => <div key={move.id}>{move.text}</div>)
              )}
            </div>
          </div>

          <div className="hidden border border-stone-800 bg-stone-950 px-4 py-3 text-sm text-stone-400 lg:block">
            <div className="mb-2 text-xs uppercase tracking-wider text-stone-500">
              Event Log
            </div>
            <div className="max-h-44 space-y-2 overflow-auto">
              {eventLog.map((event) => (
                <div
                  key={event.id}
                  className={event.special ? "text-amber-300" : undefined}
                >
                  {event.text}
                </div>
              ))}
            </div>
          </div>

          <details className="border border-stone-800 bg-stone-950 px-4 py-3 text-sm text-stone-400 lg:hidden">
            <summary className="cursor-pointer text-xs uppercase tracking-wider text-stone-500">
              Show Move History
            </summary>
            <div className="mt-3 max-h-36 space-y-2 overflow-auto">
              {moveHistory.length === 0 ? (
                <div>No moves yet.</div>
              ) : (
                moveHistory.map((move) => <div key={move.id}>{move.text}</div>)
              )}
            </div>
          </details>

          <div className="hidden gap-2 lg:flex">
            <button
              onClick={reset}
              className="flex-1 rounded border border-stone-600 px-4 py-2 text-sm uppercase tracking-wider text-stone-300 transition-colors hover:bg-stone-900"
            >
              New Game
            </button>
            <button
              onClick={undo}
              disabled={undoStack.length === 0}
              className="flex-1 rounded border border-stone-600 px-4 py-2 text-sm uppercase tracking-wider text-stone-300 transition-colors hover:bg-stone-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Undo
            </button>
          </div>

          {debugAvailable && (
            <button
              onClick={() => setDebugVisible((visible) => !visible)}
              className="rounded border border-stone-700 px-4 py-1.5 text-xs uppercase tracking-wider text-stone-500 transition-colors hover:bg-stone-900"
            >
              {debugVisible ? "Hide Diagnostics" : "Show Diagnostics"}
            </button>
          )}

          {debugAvailable && debugVisible && (
            <div className="border border-stone-800 bg-stone-950 px-4 py-3 text-xs text-stone-400">
              <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono">
                <span>White king: {describeKing(rpgState.kings.white)}</span>
                <span>Black king: {describeKing(rpgState.kings.black)}</span>
              </div>
              <div className="mt-3 max-h-44 space-y-2 overflow-auto font-mono">
                {rpgState.log.length === 0 ? (
                  <div>No hidden rolls yet.</div>
                ) : (
                  rpgState.log.map((entry) => (
                    <div key={`${entry.turn}-${entry.pieceId}-${entry.visibleMove}`}>
                      T{entry.turn} {entry.pieceId} {entry.visibleMove}: d20{" "}
                      {entry.die} + piece {entry.modifiers.piece} + aura{" "}
                      {entry.modifiers.kingAura} + board {entry.modifiers.board} +
                      morale {entry.modifiers.morale} + fatigue{" "}
                      {entry.modifiers.fatigue} = {entry.finalResult} vs{" "}
                      {entry.threshold}. {entry.outcome}
                      {entry.ruleBreak ? " extended-move" : ""}.
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
