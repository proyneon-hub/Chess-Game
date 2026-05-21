"use client";

import { useState, useCallback } from "react";
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

// Board labels are separate from the board matrix so the UI can render chess
// coordinates while the engine continues to use zero-based row/column indexes.
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

export default function ChessBoard() {
  // Each row is cloned from INITIAL_BOARD so resetting or moving pieces never
  // mutates the exported starting position shared by the rest of the app.
  const [board, setBoard] = useState<Board>(INITIAL_BOARD.map((r) => [...r]));

  // selected is the currently active piece, while validMoves is the cached set
  // of legal destinations used both for click handling and visual highlights.
  const [selected, setSelected] = useState<Square | null>(null);
  const [validMoves, setValidMoves] = useState<Square[]>([]);

  // Turn, status, and terminal-game state are kept separate so the board can
  // display "Check!" without blocking further moves, but stop clicks after mate.
  const [whiteTurn, setWhiteTurn] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);

  const handleClick = useCallback(
    (row: number, col: number) => {
      if (gameOver) return;
      const piece = board[row][col];

      if (selected) {
        // When a piece is already selected, a click either completes one of its
        // legal moves or clears the selection before possibly selecting again.
        const isMove = validMoves.some(([r, c]) => r === row && c === col);
        if (isMove) {
          const newBoard = applyMove(board, selected, [row, col]);

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
          setBoard(newBoard);
          setWhiteTurn(nextTurn);
          setSelected(null);
          setValidMoves([]);
          setStatus(newStatus);
          setGameOver(over);
          return;
        }

        // Clicking outside the selected piece's legal destinations cancels the
        // highlight state. If that clicked square contains the current player's
        // piece, the selection logic below immediately selects it.
        setSelected(null);
        setValidMoves([]);
      }

      // Only the side to move can select pieces. Legal moves are computed once
      // here and reused until the player chooses a destination or cancels.
      if (piece && isWhite(piece) === whiteTurn) {
        const legal = getLegalMoves(board, row, col, whiteTurn);
        setSelected([row, col]);
        setValidMoves(legal);
      }
    },
    [board, selected, validMoves, whiteTurn, gameOver]
  );

  // Reset all local game state back to a fresh copy of the initial position.
  const reset = () => {
    setBoard(INITIAL_BOARD.map((r) => [...r]));
    setSelected(null);
    setValidMoves([]);
    setWhiteTurn(true);
    setStatus(null);
    setGameOver(false);
  };

  return (
    <div className="flex flex-col items-center gap-5 py-8">
      <div className="text-center">
        <h1 className="text-3xl font-light tracking-widest uppercase text-amber-600">
          Chess
        </h1>
        <div className="w-16 h-px bg-amber-600/40 mx-auto mt-2" />
      </div>

      {!gameOver && (
        <div className="flex items-center gap-2 text-sm text-stone-400">
          <div
            className={`w-3 h-3 rounded-full border border-stone-500 ${
              whiteTurn ? "bg-white" : "bg-stone-900"
            }`}
          />
          {whiteTurn ? "White" : "Black"} to move
        </div>
      )}

      {/* The rank labels sit beside the board and use the same square height so
          they stay aligned with each rendered row. */}
      <div className="flex items-start">
        <div className="flex flex-col">
          {RANKS.map((rank) => (
            <div
              key={rank}
              className="w-5 flex items-center justify-center text-stone-500 text-xs font-mono"
              style={{ height: 58 }}
            >
              {rank}
            </div>
          ))}
        </div>

        <div>
          <div
            className="grid border-2 border-stone-700 overflow-hidden shadow-2xl"
            style={{ gridTemplateColumns: "repeat(8, 58px)" }}
          >
            {board.map((row, r) =>
              row.map((piece, c) => {
                // Square color and overlay state are derived from board indexes
                // and the currently cached legal-move list.
                const light = (r + c) % 2 === 0;
                const isSel = selected?.[0] === r && selected?.[1] === c;
                const isMove = validMoves.some(([mr, mc]) => mr === r && mc === c);
                const isCapture = isMove && !!piece;

                // Destination squares are shaded differently for quiet moves,
                // while captures use an outline so the piece remains visible.
                let bg = light ? "#f0d9b5" : "#b58863";
                if (isSel) bg = "#f6f669";
                else if (isMove && !piece) bg = light ? "#cdd16e" : "#aaa23a";

                return (
                  <div
                    key={`${r}-${c}`}
                    onClick={() => handleClick(r, c)}
                    className="relative flex items-center justify-center cursor-pointer select-none"
                    style={{ width: 58, height: 58, background: bg }}
                  >
                    {isCapture && (
                      <div className="absolute inset-0 border-4 border-black/30 z-10" />
                    )}
                    {isMove && !piece && (
                      <div className="w-5 h-5 rounded-full bg-black/25 z-10" />
                    )}
                    {piece && (
                      <span
                        className="text-4xl leading-none z-20"
                        style={{
                          // White glyphs need a stronger shadow so they remain
                          // readable on the light board squares.
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

          {/* File labels mirror the board columns and share the square width. */}
          <div className="flex">
            {FILES.map((f) => (
              <div
                key={f}
                className="flex items-center justify-center text-stone-500 text-xs font-mono"
                style={{ width: 58, height: 18 }}
              >
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {status && (
        <div
          className={`px-4 py-2 rounded text-sm font-medium ${
            gameOver
              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          }`}
        >
          {status}
        </div>
      )}

      {/* The reset action is available after every state, including checkmate
          and stalemate, so the user never has to refresh the page. */}
      <button
        onClick={reset}
        className="mt-1 px-6 py-2 border border-stone-600 text-stone-400 rounded hover:bg-stone-800 text-sm tracking-wider uppercase transition-colors"
      >
        New Game
      </button>
    </div>
  );
}
