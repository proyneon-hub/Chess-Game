import type { EncounterState } from "@/lib/rpg/encounters/types";
import type {
  Board,
  ChessRights,
  Side,
  Square,
  PromotionKind,
} from "@/lib/chess";
import type { RpgState, PieceIdBoard } from "@/lib/rpgChess";
import type { RngState } from "@/lib/rpg/rng";
export type { Side, PromotionKind } from "@/lib/chess";
export type PieceKind = "k" | "q" | "r" | "b" | "n" | "p";
export type Personality =
  "steadfast" | "timid" | "proud" | "ambitious" | "protective" | "pragmatic";
export type ResolutionKind = "executed" | "refused" | "autonomous" | "terminal";
export type Intention = { from: Square; to: Square; promotion?: PromotionKind };
export type MoveAttempt = Intention & { side: Side };
export type ResolvedOrder = {
  intended: MoveAttempt;
  actual: MoveAttempt;
  outcome: "obeyed" | "retreat" | "heroic";
};
export type AutonomousHazard = {
  square: Square;
  openedOwnTurn: number;
  sourceActionRevision: number;
};
export type Action = MoveAttempt | { side: Side; type: "claim-draw" };
export type SubjectMemory = {
  type: string;
  source: string;
  target: string;
  intensity: number;
  createdOwnTurn: number;
  expiryOwnTurn: number;
  action: number;
};
export type Relationship = {
  score: number;
  lastRelevant: number;
  lastReconciled: number;
  separatedTurns: number;
  disputed: boolean;
};
export type SubjectState = {
  id: string;
  side: Side;
  originalKind: PieceKind;
  currentKind: PieceKind;
  personality: Personality;
  loyalty: number;
  morale: number;
  fear: number;
  resentment: number;
  ambition: number;
  courage: number;
  fatigue: number;
  skill: number;
  power: number;
  status: "active" | "captured";
  memories: SubjectMemory[];
  relationships: Record<string, Relationship>;
  grievance: string | null;
  lastMovedOwnTurn: number;
  lastRescuedOwnTurn: number;
  lastProtectedPosition: string | null;
  plotEligibilityStreak: number;
};
export type KingdomState = {
  legitimacy: number;
  tyranny: number;
  cohesion: number;
  prestige: number;
  kingStrength: number;
  ownTurnsCompleted: number;
  lastCoercionOwnTurn: number | null;
  lastMercyRewardOwnTurn: number | null;
  plotAttemptUsed: boolean;
  extensionsUsed: number;
};
export type CourtPlot = {
  side: Side;
  ringleader: string;
  accomplice: string;
  stage: "gathering" | "preparing" | "armed" | "resolved" | "thwarted";
  stageEnteredOwnTurn: number;
  warningEventIds: number[];
  warningOwnTurns: number[];
  separatedTurns: number;
  deferredTurns: number;
};
export type PublicEvent = {
  seq: number;
  ply: number;
  message: string;
  square: Square | null;
  intended: Square | null;
  actual: Square | null;
  special: boolean;
};
export type PrivateEvent = {
  seq: number;
  code: string;
  subjectId?: string;
  details: Record<string, number | string | boolean>;
};
export type PressureCause =
  | "avoidable_exposure"
  | "neglected_under_threat"
  | "repeated_risky_order"
  | "coerced"
  | "blamed_loss";
export type PressureEpisode = {
  id: string;
  subjectId: string;
  cause: PressureCause;
  openedOwnTurn: number;
  lastAppliedOwnTurn: number;
  squareAtOpening: Square;
  attackerIds: string[];
  defenderIds: string[];
  sourceActionRevision: number;
  closedOwnTurn: number | null;
  rewarded: boolean;
  causes: PressureCause[];
};
export type SubjectPressure = {
  episodes: PressureEpisode[];
  /** Required (nullable) only in schema 4; never part of player grievances. */
  hazard?: AutonomousHazard | null;
  lastHarm: number;
  lastExposure: number;
  lastRepeated: number;
  lastNeglect: number;
  lastProtection: number;
  lastRetreat: number;
  ambient: Record<string, number>;
};
export type ProgressionState = {
  subjects: Record<string, SubjectPressure>;
  sides: Record<
    Side,
    { retreats: number; lastAmbient: number; pairs: Record<string, number> }
  >;
};
export type HiddenSimulation = {
  configVersion: string;
  rngState: RngState;
  kingdoms: Record<Side, KingdomState>;
  subjects: Record<string, SubjectState>;
  plots: CourtPlot[];
  turnContext: {
    ply: number;
    sideToMove: Side;
    refusalUsed: boolean;
    pendingRefusal: (Intention & { pieceId: string }) | null;
  };
  privateEvents: PrivateEvent[];
  counters: Record<string, number>;
} & (
  | { schemaVersion: 2; rulesetVersion: "hidden-kingdom-v2" }
  | {
      schemaVersion: 3;
      rulesetVersion: "hidden-kingdom-v3";
      progression: ProgressionState;
    }
  | {
      schemaVersion: 4;
      rulesetVersion: "hidden-kingdom-v4";
      progression: ProgressionState;
    }
  | {
      schemaVersion: 5;
      rulesetVersion: "hidden-kingdom-v5";
      progression: ProgressionState;
      encounters: EncounterState;
    }
);
export type Terminal = {
  reason:
    | "checkmate"
    | "stalemate"
    | "insufficient-material"
    | "fivefold"
    | "seventy-five-move"
    | "threefold"
    | "fifty-move"
    | "regicide";
  winner: Side | null;
  terminalPly: number;
};
export type MoveRecord = {
  number: number;
  text: string;
  message: string;
  special: boolean;
};
export type ActionOutcome = {
  requestAccepted: boolean;
  turnConsumed: boolean;
  boardChanged: boolean;
  resolution: ResolutionKind | null;
  message: string;
  special: boolean;
};
export type GameState = {
  configVersion: string;
  board: Board;
  pieceIds: PieceIdBoard;
  simulation: HiddenSimulation | null;
  rpgState?: RpgState;
  legacyRng?: RngState;
  sideToMove: Side;
  status: "waiting" | "active" | "finished";
  result: string | null;
  terminal: Terminal | null;
  rights: ChessRights;
  positions: Record<string, number>;
  revision: number;
  ply: number;
  eventSeq: number;
  lastMove: [Square, Square] | null;
  specialSquare: Square | null;
  moves: MoveRecord[];
  events: PublicEvent[];
  warning: { message: string; square: Square | null } | null;
  pendingRefusal: Intention | null;
  lastAction: ActionOutcome | null;
} & (
  | { schemaVersion: 1; rulesetVersion: "legacy-v1" }
  | { schemaVersion: 2; rulesetVersion: "hidden-kingdom-v2" }
  | { schemaVersion: 3; rulesetVersion: "hidden-kingdom-v3" }
  | { schemaVersion: 4; rulesetVersion: "hidden-kingdom-v4" }
  | { schemaVersion: 5; rulesetVersion: "hidden-kingdom-v5" }
);
export type MoveResult = ActionOutcome & {
  state: GameState;
  /** Compatibility alias; true for accepted refusals too. */ accepted: boolean;
};
