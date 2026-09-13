import { validEncounters } from "@/lib/rpg/encounters/validation";
import { validSquare, type Square } from "@/lib/chess";
import { kingsValid, sideOf } from "@/lib/chessRules";
import { configFor } from "@/lib/rpg/config";
import { numericSubjectFields } from "@/lib/rpg/subjects";
import type { GameState, Intention } from "@/lib/game/types";
import { validProgression } from "./validateProgression";
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
export function validateState(value: unknown): asserts value is GameState {
  const fail = () => {
    throw new IncompatibleStateError();
  };
  if (!record(value) || !integer(value.schemaVersion, 1, 5)) fail();
  const s = value as GameState;
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
    !kingsValid(s.board)
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
        [e.square, e.intended, e.actual].every(
          (x) => x === null || validSquare(x),
        ),
    ) ||
    !s.moves.every(
      (m) =>
        record(m) &&
        integer(m.number, 1) &&
        typeof m.text === "string" &&
        typeof m.message === "string" &&
        typeof m.special === "boolean",
    )
  )
    fail();
  if (
    (s.status === "finished") !== !!s.terminal ||
    (s.terminal &&
      (![
        "checkmate",
        "stalemate",
        "insufficient-material",
        "fivefold",
        "seventy-five-move",
        "threefold",
        "fifty-move",
        "regicide",
      ].includes(s.terminal.reason) ||
        ![null, "white", "black"].includes(s.terminal.winner) ||
        !integer(s.terminal.terminalPly)))
  )
    fail();
  if (
    s.pendingRefusal &&
    (!validSquare(s.pendingRefusal.from) || !validSquare(s.pendingRefusal.to))
  )
    fail();
  if (s.schemaVersion === 1) {
    if (
      s.rulesetVersion !== "legacy-v1" ||
      s.configVersion !== "legacy-safety-1" ||
      s.simulation !== null ||
      !record(s.rpgState) ||
      !record(s.rpgState.pieces) ||
      !record(s.rpgState.kings) ||
      !s.legacyRng
    )
      fail();
    if (!s.rpgState || !s.legacyRng) return fail();
    if (
      s.legacyRng.algorithm !== "mulberry32-v1" ||
      ![
        s.legacyRng.initialization,
        s.legacyRng.gameplay,
        s.legacyRng.narrative,
      ].every((n) => integer(n, 0, 4294967295))
    )
      fail();
    for (const side of ["white", "black"] as const) {
      const k = s.rpgState.kings[side];
      if (
        !record(k) ||
        !integer(k.baseStrength, 1, 20) ||
        !integer(k.auraRadius, 0, 8) ||
        !integer(k.auraBonus, -1, 3)
      )
        fail();
    }
    for (const id of Array.from(seen)) {
      const p = s.rpgState.pieces[id];
      if (
        !record(p) ||
        p.id !== id ||
        !["white", "black"].includes(p.side) ||
        !["king", "queen", "rook", "bishop", "knight", "pawn"].includes(
          p.kind,
        ) ||
        !record(p.stats) ||
        !Object.values(p.stats).every((n) => integer(n, 0, 5)) ||
        !integer(p.morale, 0, 6) ||
        !integer(p.fatigue, 0, 4)
      )
        fail();
    }
    return;
  }
  const sim = s.simulation;
  if (
    s.rulesetVersion !== `hidden-kingdom-v${s.schemaVersion}` ||
    configFor(s.configVersion)?.generation !== s.schemaVersion ||
    !sim ||
    sim.schemaVersion !== s.schemaVersion ||
    sim.configVersion !== s.configVersion ||
    sim.rulesetVersion !== s.rulesetVersion
  )
    fail();
  if (!sim) return fail();
  if (sim.schemaVersion >= 3) {
    try {
      if (!validProgression(s)) fail();
    } catch {
      fail();
    }
  }
  if (sim.schemaVersion === 2 && "progression" in sim) fail();
  if (sim.schemaVersion === 5) {
    try {
      if (!validEncounters(s)) fail();
    } catch {
      fail();
    }
  } else if ("encounters" in sim) fail();
  if (
    !record(sim.rngState) ||
    sim.rngState.algorithm !== "mulberry32-v1" ||
    ![
      sim.rngState.initialization,
      sim.rngState.gameplay,
      sim.rngState.narrative,
    ].every((n) => integer(n, 0, 4294967295))
  )
    fail();
  if (
    !record(sim.subjects) ||
    Object.keys(sim.subjects).length > 32 ||
    !record(sim.kingdoms) ||
    !record(sim.turnContext) ||
    sim.turnContext.ply !== s.ply ||
    sim.turnContext.sideToMove !== s.sideToMove ||
    sim.turnContext.refusalUsed !== !!s.pendingRefusal
  )
    fail();
  for (const side of ["white", "black"] as const) {
    const k = sim.kingdoms[side];
    if (
      !record(k) ||
      ![k.legitimacy, k.tyranny, k.cohesion, k.prestige].every((n) =>
        integer(n, 0, 100),
      ) ||
      !integer(k.kingStrength, 1, 20) ||
      !integer(k.ownTurnsCompleted) ||
      !integer(k.extensionsUsed, 0, 1) ||
      typeof k.plotAttemptUsed !== "boolean"
    )
      fail();
  }
  for (const [id, sub] of Object.entries(sim.subjects)) {
    if (
      !record(sub) ||
      id !== sub.id ||
      !["white", "black"].includes(sub.side) ||
      !["active", "captured"].includes(sub.status) ||
      !numericSubjectFields.every((k) => integer(sub[k], 0, 100)) ||
      ![
        "steadfast",
        "timid",
        "proud",
        "ambitious",
        "protective",
        "pragmatic",
      ].includes(sub.personality) ||
      !/^[kqrbnp]$/.test(sub.currentKind) ||
      !/^[kqrbnp]$/.test(sub.originalKind) ||
      !integer(sub.skill, 1, 5) ||
      !integer(sub.power, 1, 5) ||
      !Array.isArray(sub.memories) ||
      sub.memories.length > 12 ||
      !sub.memories.every(
        (m) =>
          record(m) &&
          typeof m.type === "string" &&
          typeof m.source === "string" &&
          m.target === id &&
          integer(m.createdOwnTurn) &&
          integer(m.expiryOwnTurn) &&
          integer(m.action),
      )
    )
      fail();
    if (
      !record(sub.relationships) ||
      Object.keys(sub.relationships).length > 4 ||
      !Object.entries(sub.relationships).every(
        ([other, r]) =>
          record(r) &&
          !!sim.subjects[other] &&
          integer(r.score, -100, 100) &&
          typeof r.disputed === "boolean" &&
          integer(r.separatedTurns),
      )
    )
      fail();
    if ((sub.status === "active") !== seen.has(id)) fail();
  }
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = s.board[r][c],
        id = s.pieceIds[r][c];
      if (p && id) {
        const sub = sim.subjects[id];
        if (
          !sub ||
          sub.currentKind !== p.toLowerCase() ||
          sub.side !== sideOf(p)
        )
          fail();
      }
    }
  if (
    !Array.isArray(sim.plots) ||
    sim.plots.length > 2 ||
    !sim.plots.every(record) ||
    sim.plots.filter((p) => !["resolved", "thwarted"].includes(p.stage))
      .length > 1 ||
    !sim.plots.every(
      (p) =>
        ["white", "black"].includes(p.side) &&
        ["gathering", "preparing", "armed", "resolved", "thwarted"].includes(
          p.stage,
        ) &&
        p.ringleader !== p.accomplice &&
        [p.ringleader, p.accomplice].every(
          (id) =>
            sim.subjects[id]?.side === p.side &&
            sim.subjects[id]?.currentKind !== "k",
        ) &&
        Array.isArray(p.warningEventIds) &&
        p.warningEventIds.length <= 3 &&
        p.warningEventIds.every((n) => integer(n, 1)) &&
        Array.isArray(p.warningOwnTurns) &&
        p.warningOwnTurns.length === p.warningEventIds.length &&
        p.warningOwnTurns.every((n) => integer(n)) &&
        integer(p.stageEnteredOwnTurn) &&
        integer(
          p.deferredTurns,
          0,
          configFor(s.configVersion)?.responsibility?.armedDeferrals ?? 2,
        ) &&
        integer(p.separatedTurns),
    )
  )
    fail();
  if (
    !Array.isArray(sim.privateEvents) ||
    sim.privateEvents.length > 256 ||
    !sim.privateEvents.every(
      (e) =>
        record(e) &&
        integer(e.seq, 1) &&
        typeof e.code === "string" &&
        record(e.details),
    ) ||
    !record(sim.counters) ||
    Object.keys(sim.counters).length > 256 ||
    !Object.values(sim.counters).every((n) => integer(n))
  )
    fail();
}
export const copySquare = (s: Square): Square => [s[0], s[1]];
