import { freshRights } from "@/lib/chess";
import { positionKey } from "@/lib/chessRules";
import type { GameState } from "@/lib/game/types";
import {
  IncompatibleStateError,
  record,
  validateState,
} from "@/lib/game/validation";
import { seedRng } from "@/lib/rpg/rng";
import { PIECE_STATS, pieceKind } from "@/lib/rpgChess";
export function migrateState(value: unknown): GameState {
  if (!record(value)) throw new IncompatibleStateError();
  if (value.schemaVersion !== undefined) {
    validateState(value);
    return structuredClone(value);
  }
  if (
    !Array.isArray(value.board) ||
    !Array.isArray(value.pieceIds) ||
    !record(value.rpgState) ||
    !record(value.rpgState.pieces) ||
    !Array.isArray(value.moves)
  )
    throw new IncompatibleStateError();
  const s = structuredClone(value) as GameState;
  // The baseline used unrecorded Math.random. Preserve every historical value;
  // derive future legacy RNG once from that state without inventing prior draws.
  let seed = 2166136261;
  for (const c of JSON.stringify(value))
    seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
  s.schemaVersion = 1;
  s.rulesetVersion = "legacy-v1";
  s.configVersion = "legacy-safety-1";
  s.simulation = null;
  s.legacyRng = seedRng(seed);
  s.rights = freshRights(false);
  s.revision = s.moves.length;
  s.ply = s.moves.length;
  s.eventSeq = s.moves.length;
  s.pendingRefusal = null;
  s.warning = null;
  s.lastAction = null;
  s.events = s.moves.map((m, i) => ({
    seq: i + 1,
    ply: i + 1,
    message: m.message,
    square: null,
    intended: null,
    actual: null,
    special: m.special,
  }));
  s.terminal =
    s.status === "finished"
      ? {
          reason: s.result?.toLowerCase().includes("checkmate")
            ? "checkmate"
            : "stalemate",
          winner: s.result?.includes("White wins")
            ? "white"
            : s.result?.includes("Black wins")
              ? "black"
              : null,
          terminalPly: s.ply,
        }
      : null;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = s.board[r]?.[c],
        id = s.pieceIds[r]?.[c];
      if (p && id && s.rpgState?.pieces[id]) {
        const kind = pieceKind(p);
        s.rpgState.pieces[id].kind = kind;
        s.rpgState.pieces[id].stats = { ...PIECE_STATS[kind] };
      }
    }
  s.positions = { [positionKey(s.board, s.sideToMove, s.rights)]: 1 };
  validateState(s);
  return s;
}
