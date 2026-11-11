import type { GameState, PublicEvent, Side } from "@/lib/game/types";
import type { Square } from "@/lib/chess";
import { positionKey } from "@/lib/chessRules";
import { rulesFor } from "@/lib/battle/config";
import { unitGrid } from "@/lib/battle/resolve";
const square = (s: Square | null): Square | null => (s ? [s[0], s[1]] : null);
/** What both players may see. Piece ids and the dice state stay private. */
export function publicState(s: GameState) {
  const rules = rulesFor(s).battle,
    b = s.battle.last;
  // Every nested record is allowlisted too. Future private fields stay private.
  return {
    board: s.board.map((r) => r.map((p) => p)),
    // The game's own dice rules, so the browser shows this game's odds.
    dice: {
      die: rules.die,
      repel: rules.repel,
      minDamage: rules.minDamage ?? 1,
      defenderWinsTies: rules.defenderWinsTies ?? false,
    },
    units: unitGrid(s),
    battle: b
      ? {
          ply: b.ply,
          from: square(b.from)!,
          target: square(b.target)!,
          attacker: b.attacker,
          defender: b.defender,
          attackRoll: b.attackRoll,
          defenceRoll: b.defenceRoll,
          attackTotal: b.attackTotal,
          defenceTotal: b.defenceTotal,
          damage: b.damage,
          attackerHp: b.attackerHp,
          defenderHp: b.defenderHp,
          outcome: b.outcome,
        }
      : null,
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
    moves: s.moves.map((m) => ({
      number: m.number,
      text: m.text,
      message: m.message,
    })),
    events: s.events.map((e, i): PublicEvent => ({
      seq: i + 1,
      ply: e.ply,
      message: e.message,
      square: square(e.square),
    })),
    lastAction: s.lastAction
      ? {
          requestAccepted: s.lastAction.requestAccepted,
          turnConsumed: s.lastAction.turnConsumed,
          boardChanged: s.lastAction.boardChanged,
          resolution: s.lastAction.resolution,
          message: s.lastAction.message,
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
