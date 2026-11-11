import { INITIAL_BOARD, freshRights } from "@/lib/chess";
import { positionKey } from "@/lib/chessRules";
import {
  DEFAULT_CONFIG,
  RULESET_VERSION,
  SCHEMA_VERSION,
  configFor,
  rulesFor,
} from "@/lib/battle/config";
import { allBattleMoves } from "@/lib/battle/moves";
import { initialUnits, submitBattleMove } from "@/lib/battle/resolve";
import type { BattleRules } from "@/lib/battle/stats";
import { event, finish } from "@/lib/game/core";
import { initializePieceIds } from "@/lib/game/pieceIds";
import { type Draw, freshSeed, seedRng } from "@/lib/game/rng";
import type {
  Action,
  ActionOutcome,
  GameState,
  MoveResult,
} from "@/lib/game/types";
export type {
  GameState,
  MoveAttempt,
  MoveResult,
  Side,
} from "@/lib/game/types";
export type GameKind = "local" | "computer" | "online";
export type Difficulty = "easy" | "normal" | "advanced";

export const createGameState = (
  seed: number = freshSeed(),
  configVersion: string = DEFAULT_CONFIG.version,
): GameState => {
  const config = configFor(configVersion);
  if (!config) throw new Error("Unsupported rules configuration.");
  const board = INITIAL_BOARD.map((r) => [...r]),
    pieceIds = initializePieceIds(board),
    rights = freshRights();
  return {
    schemaVersion: SCHEMA_VERSION,
    rulesetVersion: RULESET_VERSION,
    configVersion,
    board,
    pieceIds,
    battle: {
      rngState: seedRng(seed),
      units: initialUnits(board, pieceIds, config.battle),
      last: null,
      count: 0,
    },
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
    moves: [],
    events: [],
    lastAction: null,
  };
};
/** Every move the side to move may submit. */
export const movesFor = (s: GameState) =>
  allBattleMoves(s.board, s.sideToMove, s.rights);
const reject = (state: GameState, message: string): MoveResult => ({
  state,
  requestAccepted: false,
  turnConsumed: false,
  boardChanged: false,
  resolution: null,
  message,
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
  event(s, s.result!);
  s.revision++;
  const outcome: ActionOutcome = {
    requestAccepted: true,
    turnConsumed: false,
    boardChanged: false,
    resolution: "terminal",
    message: s.result!,
  };
  s.lastAction = outcome;
  return { ...outcome, state: s };
}
export type ResolverDependencies = {
  /** Test dependency, never accepted from transport. */ draw?: Draw;
  /** Balance measurement only: try a stat table without a config. */
  rules?: BattleRules;
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
  return submitBattleMove(state, action, deps);
}
