import type { GameState, Intention, PublicEvent, Side } from "@/lib/game/types";
import type { Square } from "@/lib/chess";
import { positionKey } from "@/lib/chessRules";
const square = (s: Square | null): Square | null => (s ? [s[0], s[1]] : null);
const intention = (m: Intention | null): Intention | null =>
  m
    ? {
        from: square(m.from)!,
        to: square(m.to)!,
        ...(m.promotion ? { promotion: m.promotion } : {}),
      }
    : null;
export function publicState(s: GameState) {
  // Every nested record is allowlisted too. Future private fields stay private.
  return {
    board: s.board.map((r) => r.map((p) => p)),
    sideToMove: s.sideToMove,
    status: s.status,
    result: s.result,
    terminal: s.terminal
      ? {
          reason: s.terminal.reason,
          winner: s.terminal.winner,
          terminalPly: s.terminal.terminalPly,
        }
      : null,
    rights: {
      castling: {
        white: {
          king: s.rights.castling.white.king,
          queen: s.rights.castling.white.queen,
        },
        black: {
          king: s.rights.castling.black.king,
          queen: s.rights.castling.black.queen,
        },
      },
      enPassant: square(s.rights.enPassant),
      halfmove: s.rights.halfmove,
      fullmove: s.rights.fullmove,
    },
    lastMove: s.lastMove
      ? ([square(s.lastMove[0])!, square(s.lastMove[1])!] as [Square, Square])
      : null,
    specialSquare: square(s.specialSquare),
    moves: s.moves.map((m) => ({
      number: m.number,
      text: m.text,
      message: m.message,
      special: m.special,
    })),
    events: s.events.map((e): PublicEvent => ({
      seq: e.seq,
      ply: e.ply,
      message: e.message,
      square: square(e.square),
      intended: square(e.intended),
      actual: square(e.actual),
      special: e.special,
    })),
    warning: s.warning
      ? { message: s.warning.message, square: square(s.warning.square) }
      : null,
    pendingRefusal: intention(s.pendingRefusal),
    lastAction: s.lastAction
      ? {
          requestAccepted: s.lastAction.requestAccepted,
          turnConsumed: s.lastAction.turnConsumed,
          boardChanged: s.lastAction.boardChanged,
          resolution: s.lastAction.resolution,
          message: s.lastAction.message,
          special: s.lastAction.special,
        }
      : null,
    drawClaims: {
      threefold:
        (s.positions[positionKey(s.board, s.sideToMove, s.rights)] ?? 0) >= 3,
      fiftyMove: s.rights.halfmove >= 100,
    },
  };
}
export type PublicGame = ReturnType<typeof publicState>;
export type PublicMatch = {
  id: string;
  playerSide: Side | null;
  waitingForOpponent: boolean;
  version: number;
  state: PublicGame;
};
