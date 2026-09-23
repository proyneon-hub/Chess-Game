import { capabilities, hasEncounters } from "@/lib/rpg/capabilities";
import {
  resolveEncounters,
  closeTerminalEncounters,
} from "@/lib/rpg/encounters/resolve";
import { scheduleEncounter } from "@/lib/rpg/encounters/director";
import { capDeltas } from "@/lib/rpg/subjects";
import {
  type Board,
  type ChessRights,
  type Side,
  INITIAL_BOARD,
  applyMove,
  freshRights,
  getLegalMoves,
  isInCheck,
  pieceName,
  sameSquare,
  squareName,
  validSquare,
} from "@/lib/chess";
import {
  allMoves,
  captureSquare,
  insufficientMaterial,
  legalFinalBoard,
  nextRights,
  positionKey,
} from "@/lib/chessRules";
import {
  initializePieceIds,
  resolveMoveAttempt,
  PIECE_STATS,
  pieceKind,
} from "@/lib/rpgChess";
import type {
  Action,
  ActionOutcome,
  GameState,
  Intention,
  MoveAttempt,
  MoveResult,
  ResolvedOrder,
} from "@/lib/game/types";
import { initializeSimulation, roleStats } from "@/lib/rpg/initialize";
import { DEFAULT_CONFIG, configFor, rulesFor } from "@/lib/rpg/config";
import { type Draw, draw, freshSeed } from "@/lib/rpg/rng";
import { count, event } from "@/lib/rpg/events";
import { leadership } from "@/lib/rpg/leadership";
import { agency } from "@/lib/rpg/agency";
import { scheduleCourt } from "@/lib/rpg/conspiracy";
import { finish, sameIntention } from "@/lib/game/core";
export { finish, sameIntention } from "@/lib/game/core";
export type {
  GameState,
  MoveAttempt,
  MoveResult,
  Side,
} from "@/lib/game/types";
export type GameKind = "local" | "computer" | "online";
export type Difficulty = "easy" | "normal" | "advanced";
export const getAllLegalMoves = (
  board: Board,
  side: Side,
  rights?: ChessRights,
) => allMoves(board, side, rights);
export const createGameState = (
  seed: number = freshSeed(),
  configVersion: string = DEFAULT_CONFIG.version,
): GameState => {
  const board = INITIAL_BOARD.map((r) => [...r]),
    pieceIds = initializePieceIds(board),
    rights = freshRights();
  const config = configFor(configVersion);
  if (!config) throw new Error("Unsupported rules configuration.");
  return {
    schemaVersion: config.generation,
    rulesetVersion: `hidden-kingdom-v${config.generation}`,
    configVersion,
    board,
    pieceIds,
    simulation: initializeSimulation(board, pieceIds, seed, configVersion),
    sideToMove: "white",
    status: "active",
    result: null,
    terminal: null,
    rights,
    positions: { [positionKey(board, "white", rights)]: 1 },
    revision: 0,
    ply: 0,
    eventSeq: 0,
    lastMove: null,
    specialSquare: null,
    moves: [],
    events: [],
    warning: null,
    pendingRefusal: null,
    lastAction: null,
  } as GameState;
};
export const normalizeIntention = (s: GameState, m: Intention): Intention => ({
  from: [...m.from],
  to: [...m.to],
  ...(s.board[m.from[0]][m.from[1]]?.toLowerCase() === "p" &&
  (m.to[0] === 0 || m.to[0] === 7)
    ? { promotion: m.promotion ?? "q" }
    : {}),
});
function ordinaryTerminal(s: GameState, next: Side) {
  if (!allMoves(s.board, next, s.rights).length)
    finish(
      s,
      isInCheck(s.board, next === "white") ? "checkmate" : "stalemate",
      isInCheck(s.board, next === "white") ? s.sideToMove : null,
    );
  else if (insufficientMaterial(s.board))
    finish(s, "insufficient-material", null);
  else if ((s.positions[positionKey(s.board, next, s.rights)] ?? 0) >= 5)
    finish(s, "fivefold", null);
  else if (s.rights.halfmove >= 150) finish(s, "seventy-five-move", null);
}
const reject = (state: GameState, message: string): MoveResult => ({
  state,
  accepted: false,
  requestAccepted: false,
  turnConsumed: false,
  boardChanged: false,
  resolution: null,
  message,
  special: false,
});
function claimDraw(state: GameState, type: string): MoveResult {
  if (type !== "claim-draw") return reject(state, "Unknown action.");
  const repeated =
    (state.positions[
      positionKey(state.board, state.sideToMove, state.rights)
    ] ?? 0) >= 3;
  if (!repeated && state.rights.halfmove < 100)
    return reject(state, "A draw cannot be claimed in this position.");
  const s = structuredClone(state);
  finish(s, repeated ? "threefold" : "fifty-move", null);
  closeTerminalEncounters(s);
  event(s, "draw", s.result!);
  s.revision++;
  const outcome: ActionOutcome = {
    requestAccepted: true,
    turnConsumed: false,
    boardChanged: false,
    resolution: "terminal",
    message: s.result!,
    special: false,
  };
  s.lastAction = outcome;
  return { ...outcome, state: s, accepted: true };
}
/**
 * Moves piece ids with the committed board (captures, castling rook) and
 * updates the moved and captured subjects. Returns the mover's id.
 */
function trackPieces(
  s: GameState,
  state: GameState,
  actual: MoveAttempt,
  piece: string,
  board: Board,
): string {
  const destination = actual.to;
  const captured = captureSquare(state.board, actual),
    capturedId = captured ? s.pieceIds[captured[0]][captured[1]] : null,
    id = s.pieceIds[actual.from[0]][actual.from[1]]!;
  if (captured) s.pieceIds[captured[0]][captured[1]] = null;
  s.pieceIds[destination[0]][destination[1]] = id;
  s.pieceIds[actual.from[0]][actual.from[1]] = null;
  if (
    piece.toLowerCase() === "k" &&
    Math.abs(destination[1] - actual.from[1]) === 2
  ) {
    const r = actual.from[0],
      c = destination[1] === 6 ? 7 : 0;
    s.pieceIds[r][destination[1] === 6 ? 5 : 3] = s.pieceIds[r][c];
    s.pieceIds[r][c] = null;
  }
  if (s.simulation) {
    if (capturedId) {
      const sub = s.simulation.subjects[capturedId];
      sub.status = "captured";
      sub.relationships = {};
      sub.memories = sub.memories.slice(-2);
      for (const other of Object.values(s.simulation.subjects))
        delete other.relationships[capturedId];
    }
    const sub = s.simulation.subjects[id];
    const kind = board[destination[0]][
      destination[1]
    ]!.toLowerCase() as typeof sub.currentKind;
    if (sub.currentKind !== kind) {
      sub.currentKind = kind;
      sub.skill = roleStats[kind].skill;
      sub.power = roleStats[kind].power;
    }
  } else if (s.rpgState) {
    const kind = pieceKind(board[destination[0]][destination[1]]);
    s.rpgState.pieces[id].kind = kind;
    s.rpgState.pieces[id].stats = { ...PIECE_STATS[kind] };
  }
  return id;
}
/** Irreversible moves (pawn, capture, castling rights) reset repetition. */
function recordPosition(s: GameState, state: GameState, next: Side) {
  const key = positionKey(s.board, next, s.rights);
  if (
    !s.rights.halfmove ||
    JSON.stringify(s.rights.castling) !== JSON.stringify(state.rights.castling)
  )
    s.positions = {};
  s.positions[key] = (s.positions[key] ?? 0) + 1;
}
/** v4+ keeps the action explanation beside check or the result. */
function moveMessage(s: GameState, next: Side, message: string): string {
  const check = isInCheck(s.board, next === "white") ? "Check!" : "";
  return capabilities(s).responsibility
    ? [message, s.result ?? check].filter(Boolean).join(" ")
    : (s.result ?? (check || message));
}
export type ResolverDependencies = {
  /** Test dependency, never accepted from transport. */ draw?: Draw;
  classic?: boolean;
};
export function submitMove(
  state: GameState,
  action: Action,
  deps: ResolverDependencies = {},
): MoveResult {
  if (state.status !== "active")
    return reject(state, "This game has already ended.");
  if (action.side !== state.sideToMove)
    return reject(state, "It is not your turn.");
  try {
    rulesFor(state);
  } catch {
    return reject(state, "This game uses an unsupported rules configuration.");
  }
  if ("type" in action) return claimDraw(state, action.type);
  if (
    !validSquare(action.from) ||
    !validSquare(action.to) ||
    (action.promotion !== undefined &&
      !["q", "r", "b", "n"].includes(action.promotion))
  )
    return reject(state, "That move is not available.");
  const piece = state.board[action.from[0]][action.from[1]];
  if (
    !piece ||
    !getLegalMoves(
      state.board,
      ...action.from,
      action.side === "white",
      state.rulesetVersion === "legacy-v1" ? undefined : state.rights,
    ).some((t) => sameSquare(t, action.to))
  )
    return reject(state, "That move is not available.");
  if (
    action.promotion &&
    (piece.toLowerCase() !== "p" || ![0, 7].includes(action.to[0]))
  )
    return reject(state, "Promotion is not available here.");
  const intention = normalizeIntention(state, action),
    move: MoveAttempt = { ...intention, side: action.side };
  const s = structuredClone(state);
  const rng: Draw =
    deps.draw ??
    ((stream) => draw((s.simulation?.rngState ?? s.legacyRng)!, stream));
  let destination = move.to,
    special = false,
    message = "",
    autonomous = false;
  let agencyOutcome: ResolvedOrder["outcome"] = "obeyed";
  const guaranteed =
    !!state.pendingRefusal ||
    piece.toLowerCase() === "k" ||
    isInCheck(state.board, action.side === "white");
  if (s.simulation && !deps.classic) {
    count(s, "attempts");
    const result = agency(s, move, rng);
    if (result.kind === "refused")
      return commitRefusal(s, move, result.message);
    destination = result.destination;
    special = result.special;
    message = result.message;
    autonomous = result.kind === "autonomous";
    agencyOutcome = result.outcome;
    if (autonomous) count(s, "retreats");
    if (state.pendingRefusal)
      message = sameIntention(state.pendingRefusal, move)
        ? `The ${pieceName(piece).toLowerCase()} obeys the repeated command.`
        : "The order changes. A different move is made.";
  }
  if (s.rulesetVersion === "legacy-v1" && s.rpgState) {
    const result = resolveMoveAttempt(
      s.board,
      s.pieceIds,
      s.rpgState,
      move.from,
      move.to,
      () => rng(),
      guaranteed,
    );
    s.rpgState = result.rpgState;
    destination = result.destination;
    special = result.ruleBreak;
    message = result.publicMessage;
    if (!result.allowed) return commitRefusal(s, move, message);
  }
  const actual = { ...move, to: destination };
  const board = applyMove(
    s.board,
    move.from,
    destination,
    move.promotion,
    s.rulesetVersion === "legacy-v1" ? undefined : s.rights,
  );
  if (!legalFinalBoard(board, move.side))
    return reject(state, "That move is not available.");
  const id = trackPieces(s, state, actual, piece, board);
  s.board = board;
  s.rights = nextRights(state.board, state.rights, actual);
  s.ply++;
  s.revision++;
  s.lastMove = [move.from, destination];
  s.specialSquare = special ? destination : null;
  const next: Side = move.side === "white" ? "black" : "white";
  recordPosition(s, state, next);
  if (s.simulation && !deps.classic)
    leadership(state, s, actual, {
      intended: move,
      actual,
      outcome: agencyOutcome,
    });
  const caps = capabilities(s);
  if (hasEncounters(s.simulation) && !deps.classic)
    resolveEncounters(state, s, {
      intended: move,
      actual,
      outcome: agencyOutcome,
    });
  // Court eligibility sees the committed, combined leadership/encounter
  // deltas, never an intermediate value beyond an action's field cap.
  if (caps.turnLevelDeltaCap && !deps.classic) capDeltas(state, s);
  ordinaryTerminal(s, next);
  closeTerminalEncounters(s);
  const text = `${pieceName(piece)} ${squareName(move.from)} → ${squareName(destination)}${move.promotion ? ` = ${move.promotion.toUpperCase()}` : ""}`;
  message = moveMessage(s, next, message || text);
  const actionMessage = message;
  event(s, "move", message, {
    square: destination,
    intended: move.to,
    actual: destination,
    special,
    subjectId: id,
  });
  if (s.simulation && !deps.classic && !s.terminal)
    scheduleCourt(
      s,
      move.side,
      rng,
      isInCheck(state.board, move.side === "white"),
    );
  if (hasEncounters(s.simulation) && !deps.classic) {
    closeTerminalEncounters(s);
    scheduleEncounter(s, move.side);
    capDeltas(state, s);
  }
  message = s.result ?? message;
  s.moves.push({
    number: s.ply,
    text: `${s.ply}. ${text}`,
    message: caps.responsibility ? actionMessage : message,
    special,
  });
  s.sideToMove = next;
  s.pendingRefusal = null;
  if (s.simulation)
    s.simulation.turnContext = {
      ply: s.ply,
      sideToMove: next,
      refusalUsed: false,
      pendingRefusal: null,
    };
  const outcome: ActionOutcome = {
    requestAccepted: true,
    turnConsumed: true,
    boardChanged: true,
    resolution: s.terminal
      ? "terminal"
      : autonomous
        ? "autonomous"
        : "executed",
    message,
    special,
  };
  s.lastAction = outcome;
  return { ...outcome, state: s, accepted: true };
}
function commitRefusal(
  s: GameState,
  move: MoveAttempt,
  message: string,
): MoveResult {
  s.pendingRefusal = normalizeIntention(s, move);
  s.revision++;
  if (s.simulation) {
    s.simulation.turnContext.refusalUsed = true;
    s.simulation.turnContext.pendingRefusal = {
      ...s.pendingRefusal,
      pieceId: s.pieceIds[move.from[0]][move.from[1]]!,
    };
  }
  event(s, "refusal", message, {
    square: move.from,
    intended: move.to,
    subjectId: s.pieceIds[move.from[0]][move.from[1]]!,
  });
  const outcome: ActionOutcome = {
    requestAccepted: true,
    turnConsumed: false,
    boardChanged: false,
    resolution: "refused",
    message,
    special: false,
  };
  s.lastAction = outcome;
  return { ...outcome, state: s, accepted: true };
}
