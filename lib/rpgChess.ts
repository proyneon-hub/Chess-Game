import {
  type Board,
  type Piece,
  type Square,
  applyMove,
  getPseudoMoves,
  isInCheck,
  isWhite,
} from "@/lib/chess";

export type PieceIdBoard = (string | null)[][];
export type KingTier = "Weak" | "Ordinary" | "Strong" | "Heroic" | "Legendary";
export type MoveOutcome =
  | "critical-failure"
  | "failure"
  | "partial-success"
  | "success"
  | "strong-success"
  | "critical-success";

type Side = "white" | "black";
type MoveType = "normal" | "capture" | "escape" | "threatened";

type PieceKind = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";

type PieceStats = {
  skill: number;
  courage: number;
  loyalty: number;
  power: number;
  agility: number;
  will: number;
};

export type KingRpgState = {
  baseStrength: number;
  tier: KingTier;
  auraRadius: number;
  auraBonus: number;
  morale: number;
  will: number;
};

export type PieceRpgState = {
  id: string;
  kind: PieceKind;
  side: Side;
  stats: PieceStats;
  morale: number;
  fatigue: number;
};

export type DebugLogEntry = {
  turn: number;
  pieceId: string;
  visibleMove: string;
  moveType: MoveType;
  die: number;
  threshold: number;
  modifiers: {
    piece: number;
    kingAura: number;
    board: number;
    morale: number;
    fatigue: number;
  };
  finalResult: number;
  outcome: MoveOutcome;
  ruleBreak: boolean;
  message: string;
};

export type RpgState = {
  kings: Record<Side, KingRpgState>;
  pieces: Record<string, PieceRpgState>;
  turn: number;
  log: DebugLogEntry[];
};

export type MoveResolution = {
  allowed: boolean;
  destination: Square;
  pieceIds: PieceIdBoard;
  rpgState: RpgState;
  outcome: MoveOutcome;
  ruleBreak: boolean;
  publicMessage: string;
};

const PIECE_STATS: Record<PieceKind, PieceStats> = {
  king: { skill: 2, courage: 4, loyalty: 5, power: 3, agility: 1, will: 5 },
  queen: { skill: 5, courage: 4, loyalty: 4, power: 5, agility: 4, will: 4 },
  rook: { skill: 3, courage: 4, loyalty: 5, power: 4, agility: 2, will: 3 },
  bishop: { skill: 4, courage: 3, loyalty: 4, power: 3, agility: 3, will: 4 },
  knight: { skill: 4, courage: 5, loyalty: 3, power: 3, agility: 5, will: 3 },
  pawn: { skill: 1, courage: 2, loyalty: 3, power: 1, agility: 2, will: 2 },
};

const PIECE_NAMES: Record<PieceKind, string> = {
  king: "king",
  queen: "queen",
  rook: "rook",
  bishop: "bishop",
  knight: "knight",
  pawn: "pawn",
};

const inBounds = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const rollD20 = () => Math.floor(Math.random() * 20) + 1;

const sideOf = (piece: Piece): Side => (isWhite(piece) ? "white" : "black");

const pieceKind = (piece: Piece): PieceKind => {
  switch (piece?.toLowerCase()) {
    case "k":
      return "king";
    case "q":
      return "queen";
    case "r":
      return "rook";
    case "b":
      return "bishop";
    case "n":
      return "knight";
    default:
      return "pawn";
  }
};

const determineKingTier = (roll: number): KingTier => {
  if (roll === 20) return "Legendary";
  if (roll >= 15) return "Heroic";
  if (roll >= 10) return "Strong";
  if (roll >= 5) return "Ordinary";
  return "Weak";
};

const auraBonusForTier = (tier: KingTier) => {
  if (tier === "Legendary") return 3;
  if (tier === "Heroic") return 2;
  if (tier === "Strong") return 1;
  if (tier === "Weak") return -1;
  return 0;
};

const clonePieceIds = (pieceIds: PieceIdBoard): PieceIdBoard =>
  pieceIds.map((row) => [...row]);

const squareName = ([row, col]: Square) =>
  `${String.fromCharCode(97 + col)}${8 - row}`;

export const initializePieceIds = (board: Board): PieceIdBoard => {
  const counts: Partial<Record<`${Side}_${PieceKind}`, number>> = {};

  return board.map((row) =>
    row.map((piece) => {
      if (!piece) return null;
      const side = sideOf(piece);
      const kind = pieceKind(piece);
      const key = `${side}_${kind}` as const;
      counts[key] = (counts[key] ?? 0) + 1;
      return `${key}_${counts[key]}`;
    })
  );
};

export const initializeRpgState = (
  board: Board,
  pieceIds: PieceIdBoard
): RpgState => {
  const whiteStrength = rollD20();
  const blackStrength = rollD20();
  const whiteTier = determineKingTier(whiteStrength);
  const blackTier = determineKingTier(blackStrength);
  const pieces: Record<string, PieceRpgState> = {};

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      const id = pieceIds[r][c];
      if (!piece || !id) continue;

      const kind = pieceKind(piece);
      pieces[id] = {
        id,
        kind,
        side: sideOf(piece),
        stats: PIECE_STATS[kind],
        morale: 3,
        fatigue: 0,
      };
    }
  }

  return {
    kings: {
      white: {
        baseStrength: whiteStrength,
        tier: whiteTier,
        auraRadius: 2,
        auraBonus: auraBonusForTier(whiteTier),
        morale: 5,
        will: 5,
      },
      black: {
        baseStrength: blackStrength,
        tier: blackTier,
        auraRadius: 2,
        auraBonus: auraBonusForTier(blackTier),
        morale: 5,
        will: 5,
      },
    },
    pieces,
    turn: 1,
    log: [],
  };
};

export const describeKing = (king: KingRpgState) =>
  `${king.tier} (${king.baseStrength})`;

const findPieceId = (pieceIds: PieceIdBoard, id: string): Square | null => {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) if (pieceIds[r][c] === id) return [r, c];
  return null;
};

const kingAuraModifier = (
  rpgState: RpgState,
  pieceIds: PieceIdBoard,
  side: Side,
  square: Square
) => {
  const kingId = `${side}_king_1`;
  const kingSquare = findPieceId(pieceIds, kingId);
  if (!kingSquare) return 0;

  const distance = Math.max(
    Math.abs(kingSquare[0] - square[0]),
    Math.abs(kingSquare[1] - square[1])
  );

  const king = rpgState.kings[side];
  return distance <= king.auraRadius ? king.auraBonus : 0;
};

const isSquareThreatenedBy = (board: Board, square: Square, attackerWhite: boolean) => {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece || isWhite(piece) !== attackerWhite) continue;
      if (getPseudoMoves(board, r, c).some(([mr, mc]) => mr === square[0] && mc === square[1]))
        return true;
    }
  }
  return false;
};

const moveTypeFor = (board: Board, from: Square, to: Square, side: Side): MoveType => {
  if (isInCheck(board, side === "white")) return "escape";
  if (board[to[0]][to[1]]) return "capture";
  if (isSquareThreatenedBy(board, from, side === "black")) return "threatened";
  return "normal";
};

const thresholdFor = (moveType: MoveType) => {
  if (moveType === "escape") return 10;
  if (moveType === "threatened") return 11;
  if (moveType === "capture") return 8;
  return 5;
};

const boardModifierFor = (board: Board, to: Square, side: Side) => {
  if (isSquareThreatenedBy(board, to, side === "black")) return -1;
  return 0;
};

const extendDestination = (
  board: Board,
  from: Square,
  to: Square,
  side: Side
): Square | null => {
  if (board[to[0]][to[1]]) return null;

  const dr = Math.sign(to[0] - from[0]);
  const dc = Math.sign(to[1] - from[1]);
  const target: Square = [to[0] + dr, to[1] + dc];
  if (!inBounds(target[0], target[1])) return null;

  const occupant = board[target[0]][target[1]];
  if (occupant && sideOf(occupant) === side) return null;
  if (isInCheck(applyMove(board, from, target), side === "white")) return null;

  return target;
};

export const applyPieceIdMove = (
  pieceIds: PieceIdBoard,
  from: Square,
  to: Square
): PieceIdBoard => {
  const next = clonePieceIds(pieceIds);
  next[to[0]][to[1]] = next[from[0]][from[1]];
  next[from[0]][from[1]] = null;
  return next;
};

const logEntry = (
  rpgState: RpgState,
  entry: Omit<DebugLogEntry, "turn">
): DebugLogEntry[] => [{ turn: rpgState.turn, ...entry }, ...rpgState.log].slice(0, 30);

export const resolveMoveAttempt = (
  board: Board,
  pieceIds: PieceIdBoard,
  rpgState: RpgState,
  from: Square,
  to: Square
): MoveResolution => {
  const piece = board[from[0]][from[1]];
  const pieceId = pieceIds[from[0]][from[1]];
  if (!piece || !pieceId) {
    return {
      allowed: false,
      destination: to,
      pieceIds,
      rpgState,
      outcome: "failure",
      ruleBreak: false,
      publicMessage: "The command fades before anyone moves.",
    };
  }

  const pieceState = rpgState.pieces[pieceId];
  const side = sideOf(piece);
  const moveType = moveTypeFor(board, from, to, side);
  const threshold = thresholdFor(moveType);
  const die = rollD20();
  const pieceModifier =
    moveType === "capture" ? pieceState.stats.power : pieceState.stats.skill;
  const kingAura = kingAuraModifier(rpgState, pieceIds, side, from);
  const boardModifier = boardModifierFor(board, to, side);
  const moraleModifier = pieceState.morale >= 5 ? 1 : pieceState.morale <= 1 ? -1 : 0;
  const fatigueModifier = -pieceState.fatigue;
  const finalResult =
    die + pieceModifier + kingAura + boardModifier + moraleModifier + fatigueModifier;
  const nextRpgState: RpgState = {
    ...rpgState,
    pieces: { ...rpgState.pieces },
    turn: rpgState.turn + 1,
  };

  const updateMover = (changes: Partial<PieceRpgState>) => {
    const current = nextRpgState.pieces[pieceId] ?? pieceState;
    nextRpgState.pieces[pieceId] = {
      ...current,
      ...changes,
      morale: clamp(changes.morale ?? current.morale, 0, 6),
      fatigue: clamp(changes.fatigue ?? current.fatigue, 0, 4),
    };
  };

  let outcome: MoveOutcome;
  let allowed = true;
  let destination = to;
  let ruleBreak = false;
  let message = `The ${PIECE_NAMES[pieceState.kind]} obeys.`;

  if (die === 1) {
    outcome = "critical-failure";
    allowed = false;
    updateMover({
      morale: pieceState.morale - 2,
      fatigue: pieceState.fatigue + 1,
    });
    message = `The ${PIECE_NAMES[pieceState.kind]} refuses the order.`;
  } else if (die === 20) {
    outcome = "critical-success";
    const extended = extendDestination(board, from, to, side);
    if (extended) {
      destination = extended;
      ruleBreak = true;
      updateMover({
        morale: pieceState.morale + 2,
        fatigue: pieceState.fatigue + 1,
      });
      message = `The ${PIECE_NAMES[pieceState.kind]} surges beyond the line.`;
    } else {
      updateMover({ morale: pieceState.morale + 2 });
      message = `The ${PIECE_NAMES[pieceState.kind]} moves with impossible confidence.`;
    }
  } else if (finalResult >= threshold + 5) {
    outcome = "strong-success";
    updateMover({ morale: pieceState.morale + 1 });
    message = `The ${PIECE_NAMES[pieceState.kind]} advances with resolve.`;
  } else if (finalResult >= threshold) {
    outcome = "success";
    updateMover({});
  } else if (finalResult >= threshold - 2) {
    outcome = "partial-success";
    updateMover({ fatigue: pieceState.fatigue + 1 });
    message = `The ${PIECE_NAMES[pieceState.kind]} presses on, shaken.`;
  } else {
    outcome = "failure";
    allowed = false;
    updateMover({ morale: pieceState.morale - 1 });
    message = `The ${PIECE_NAMES[pieceState.kind]} hesitates.`;
  }

  let nextPieceIds = pieceIds;
  if (allowed) {
    const capturedId = pieceIds[destination[0]][destination[1]];
    nextPieceIds = applyPieceIdMove(pieceIds, from, destination);

    if (capturedId) {
      const captured = nextRpgState.pieces[capturedId];
      delete nextRpgState.pieces[capturedId];
      updateMover({ morale: nextRpgState.pieces[pieceId].morale + 1 });

      if (captured) {
        for (const state of Object.values(nextRpgState.pieces)) {
          if (state.side === captured.side) {
            nextRpgState.pieces[state.id] = {
              ...state,
              morale: clamp(state.morale - 1, 0, 6),
            };
          }
        }
      }
    }
  }

  const visibleMove = `${squareName(from)}-${squareName(destination)}`;
  nextRpgState.log = logEntry(rpgState, {
    pieceId,
    visibleMove,
    moveType,
    die,
    threshold,
    modifiers: {
      piece: pieceModifier,
      kingAura,
      board: boardModifier,
      morale: moraleModifier,
      fatigue: fatigueModifier,
    },
    finalResult,
    outcome,
    ruleBreak,
    message,
  });

  return {
    allowed,
    destination,
    pieceIds: nextPieceIds,
    rpgState: nextRpgState,
    outcome,
    ruleBreak,
    publicMessage: message,
  };
};
