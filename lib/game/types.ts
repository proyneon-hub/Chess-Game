import type {
  Board,
  ChessRights,
  Side,
  Square,
  PromotionKind,
} from "@/lib/chess";
import type { BattleOutcome, BattleUnit } from "@/lib/battle/stats";
import type { PieceIdBoard } from "@/lib/game/pieceIds";
import type { RngState } from "@/lib/game/rng";
export type { Side, PromotionKind } from "@/lib/chess";
export type Intention = { from: Square; to: Square; promotion?: PromotionKind };
export type MoveAttempt = Intention & { side: Side };
export type Action = MoveAttempt | { side: Side; type: "claim-draw" };
export type PublicEvent = {
  seq: number;
  ply: number;
  message: string;
  square: Square | null;
};
export type Terminal = {
  reason:
    | "king-defeated"
    | "stalemate"
    | "fivefold"
    | "seventy-five-move"
    | "threefold"
    | "fifty-move";
  winner: Side | null;
  terminalPly: number;
};
export type MoveRecord = { number: number; text: string; message: string };
export type ActionOutcome = {
  requestAccepted: boolean;
  turnConsumed: boolean;
  boardChanged: boolean;
  resolution: "executed" | "terminal" | null;
  message: string;
};
/** One resolved battle, as shown to both players. */
export type BattleRecord = {
  ply: number;
  from: Square;
  target: Square;
  attacker: string;
  defender: string;
  attackRoll: number;
  defenceRoll: number;
  attackTotal: number;
  defenceTotal: number;
  damage: number;
  attackerHp: number;
  defenderHp: number;
  outcome: BattleOutcome;
};
/** Visible stats by piece id, the last battle, and the dice. */
export type BattleState = {
  rngState: RngState;
  units: Record<string, BattleUnit>;
  last: BattleRecord | null;
  count: number;
};
export type GameState = {
  schemaVersion: 7;
  rulesetVersion: "battle-v1";
  configVersion: string;
  board: Board;
  pieceIds: PieceIdBoard;
  battle: BattleState;
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
  moves: MoveRecord[];
  events: PublicEvent[];
  lastAction: ActionOutcome | null;
};
export type MoveResult = ActionOutcome & { state: GameState };
