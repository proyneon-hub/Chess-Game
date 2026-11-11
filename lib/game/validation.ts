import { validSquare } from "@/lib/chess";
import {
  RULESET_VERSION,
  SCHEMA_VERSION,
  configFor,
} from "@/lib/battle/config";
import type { GameState, Intention } from "@/lib/game/types";
export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type ActionRequest = (Intention | { type: "claim-draw" }) & {
  actionId: string;
  expectedVersion: number;
};
export const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const integer = (
  v: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): v is number =>
  Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max;
export function parseAction(v: unknown): ActionRequest | null {
  if (
    !record(v) ||
    typeof v.actionId !== "string" ||
    !UUID.test(v.actionId) ||
    !integer(v.expectedVersion, 1)
  )
    return null;
  const claim = v.type === "claim-draw";
  if (
    Object.keys(v).some(
      (k) =>
        !(
          claim
            ? ["type", "actionId", "expectedVersion"]
            : ["from", "to", "promotion", "actionId", "expectedVersion"]
        ).includes(k),
    )
  )
    return null;
  if (claim)
    return {
      type: "claim-draw",
      actionId: v.actionId,
      expectedVersion: v.expectedVersion,
    };
  if (
    !validSquare(v.from) ||
    !validSquare(v.to) ||
    (v.promotion !== undefined &&
      !["q", "r", "b", "n"].includes(String(v.promotion)))
  )
    return null;
  return {
    from: [...v.from],
    to: [...v.to],
    ...(v.promotion
      ? { promotion: v.promotion as Intention["promotion"] }
      : {}),
    actionId: v.actionId,
    expectedVersion: v.expectedVersion,
  };
}
export class IncompatibleStateError extends Error {
  constructor() {
    super("This saved game is incompatible with this version.");
  }
}
const fail = (): never => {
  throw new IncompatibleStateError();
};

/**
 * Fails closed on any saved state this code cannot faithfully continue,
 * including every game begun under rules older than Battle Chess.
 */
export function validateState(value: unknown): asserts value is GameState {
  if (!record(value) || value.schemaVersion !== SCHEMA_VERSION) fail();
  const s = value as GameState;
  const ids = checkBoard(s);
  checkRightsAndHistory(s);
  checkBattle(s, ids);
}
/** A validated private copy of a stored game. */
export function loadState(value: unknown): GameState {
  validateState(value);
  return structuredClone(value);
}

/** Board, piece ids, and their agreement; returns the ids on the board. */
function checkBoard(s: GameState): Set<string> {
  if (
    !["white", "black"].includes(s.sideToMove) ||
    !["waiting", "active", "finished"].includes(s.status) ||
    !Array.isArray(s.board) ||
    s.board.length !== 8 ||
    !s.board.every(
      (row) =>
        Array.isArray(row) &&
        row.length === 8 &&
        row.every(
          (p) =>
            p === null || (typeof p === "string" && /^[kqrbnpKQRBNP]$/.test(p)),
        ),
    ) ||
    // A finished game may have lost a king; an active one has both.
    !["K", "k"].every((k) => {
      const n = s.board.flat().filter((p) => p === k).length;
      return s.status === "finished" ? n <= 1 : n === 1;
    })
  )
    fail();
  if (
    !Array.isArray(s.pieceIds) ||
    s.pieceIds.length !== 8 ||
    !s.pieceIds.every(
      (row) =>
        Array.isArray(row) &&
        row.length === 8 &&
        row.every(
          (id) => id === null || (typeof id === "string" && id.length <= 80),
        ),
    )
  )
    fail();
  const seen = new Set<string>();
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const id = s.pieceIds[r][c];
      if (!!id !== !!s.board[r][c] || (id && seen.has(id))) fail();
      if (id) seen.add(id);
    }
  return seen;
}

/** Chess rights, counters, repetition, move and event logs, and the result. */
function checkRightsAndHistory(s: GameState) {
  if (
    !record(s.rights) ||
    !record(s.rights.castling) ||
    !["white", "black"].every((side) => {
      const r = s.rights.castling[side as "white" | "black"];
      return (
        record(r) && typeof r.king === "boolean" && typeof r.queen === "boolean"
      );
    }) ||
    (s.rights.enPassant !== null && !validSquare(s.rights.enPassant)) ||
    !integer(s.rights.halfmove) ||
    !integer(s.rights.fullmove, 1)
  )
    fail();
  if (
    ![s.revision, s.ply, s.eventSeq].every((n) => integer(n)) ||
    !record(s.positions) ||
    Object.keys(s.positions).length > 151 ||
    !Object.values(s.positions).every((n) => integer(n, 1, 5))
  )
    fail();
  if (
    !Array.isArray(s.moves) ||
    !Array.isArray(s.events) ||
    !s.events.every(
      (e, i) =>
        record(e) &&
        integer(e.seq, 1) &&
        e.seq <= s.eventSeq &&
        (i === 0 || e.seq > s.events[i - 1].seq) &&
        integer(e.ply) &&
        typeof e.message === "string" &&
        (e.square === null || validSquare(e.square)),
    ) ||
    !s.moves.every(
      (m) =>
        record(m) &&
        integer(m.number, 1) &&
        typeof m.text === "string" &&
        typeof m.message === "string",
    )
  )
    fail();
  if (
    (s.status === "finished") !== !!s.terminal ||
    (s.terminal &&
      (![
        "king-defeated",
        "stalemate",
        "fivefold",
        "seventy-five-move",
        "threefold",
        "fifty-move",
      ].includes(s.terminal.reason) ||
        ![null, "white", "black"].includes(s.terminal.winner) ||
        !integer(s.terminal.terminalPly)))
  )
    fail();
}

/** The ruleset, the dice state, and one visible unit per piece. */
function checkBattle(s: GameState, ids: Set<string>) {
  const b = s.battle;
  if (
    s.rulesetVersion !== RULESET_VERSION ||
    !configFor(s.configVersion) ||
    !record(b) ||
    !record(b.rngState) ||
    b.rngState.algorithm !== "mulberry32-v1" ||
    !["initialization", "gameplay", "narrative"].every((k) =>
      integer((b.rngState as Record<string, unknown>)[k], 0, 0xffffffff),
    ) ||
    !integer(b.count) ||
    !record(b.units) ||
    Object.keys(b.units).length !== ids.size ||
    ![...ids].every((id) => {
      const u = b.units[id];
      return (
        record(u) &&
        integer(u.maxHp, 1, 99) &&
        integer(u.hp, 1, u.maxHp) &&
        integer(u.attack, 0, 99) &&
        integer(u.defence, 0, 99)
      );
    })
  )
    fail();
  const l = b.last;
  if (
    l !== null &&
    (!record(l) ||
      !validSquare(l.from) ||
      !validSquare(l.target) ||
      ![l.attacker, l.defender].every(
        (p) => typeof p === "string" && /^[kqrbnpKQRBNP]$/.test(p),
      ) ||
      ![
        l.ply,
        l.attackRoll,
        l.defenceRoll,
        l.attackTotal,
        l.defenceTotal,
        l.damage,
        l.attackerHp,
        l.defenderHp,
      ].every((n) => integer(n, 0, 999)) ||
      !["defeated", "wounded", "repelled", "fell"].includes(l.outcome))
  )
    fail();
}
