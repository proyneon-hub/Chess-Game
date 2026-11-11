// The Battle Chess reducer (schema 7). Pieces move as in chess but there is
// no check: moving onto an enemy piece starts a battle, and the game ends
// when a king is defeated. Called by submitMove after its shared guards.
import {
  type Board,
  type Side,
  applyMove,
  pieceName,
  sameSquare,
  squareName,
  validSquare,
} from "@/lib/chess";
import { nextRights, positionKey } from "@/lib/chessRules";
import { finish } from "@/lib/game/core";
import type {
  ActionOutcome,
  BattleRecord,
  GameState,
  MoveAttempt,
  MoveResult,
} from "@/lib/game/types";
import { rulesFor } from "@/lib/rpg/config";
import { event } from "@/lib/rpg/events";
import { type Draw, draw } from "@/lib/rpg/rng";
import { allBattleMoves, battleMoves, battleTarget } from "./moves";
import {
  BATTLE_RULES,
  type BattleRules,
  type BattleUnit,
  type UnitGrid,
  freshUnit,
  strike,
} from "./stats";

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
/** Fresh full-strength units for every piece on a board. */
export const initialUnits = (
  board: Board,
  pieceIds: (string | null)[][],
  rules = BATTLE_RULES,
): Record<string, BattleUnit> => {
  const units: Record<string, BattleUnit> = {};
  board.forEach((row, r) =>
    row.forEach((p, c) => {
      if (p) units[pieceIds[r][c]!] = freshUnit(p, rules);
    }),
  );
  return units;
};
/** Visible stats by square; the piece ids themselves stay private. */
export const unitGrid = (s: GameState): UnitGrid =>
  s.pieceIds.map((row) =>
    row.map((id) => {
      const u = id ? s.battle?.units[id] : null;
      return u
        ? { hp: u.hp, maxHp: u.maxHp, attack: u.attack, defence: u.defence }
        : null;
    }),
  );
const lower = (p: string) => pieceName(p).toLowerCase();

export function submitBattleMove(
  state: GameState,
  action: MoveAttempt,
  deps: { draw?: Draw; rules?: BattleRules } = {},
): MoveResult {
  if (
    !state.battle ||
    !validSquare(action.from) ||
    !validSquare(action.to) ||
    (action.promotion !== undefined &&
      !["q", "r", "b", "n"].includes(action.promotion))
  )
    return reject(state, "That move is not available.");
  const piece = state.board[action.from[0]][action.from[1]];
  const white = action.side === "white";
  if (
    !piece ||
    !battleMoves(state.board, ...action.from, white, state.rights).some((t) =>
      sameSquare(t, action.to),
    )
  )
    return reject(state, "That move is not available.");
  const promotes =
    piece.toLowerCase() === "p" && (action.to[0] === 0 || action.to[0] === 7);
  if (action.promotion && !promotes)
    return reject(state, "Promotion is not available here.");
  const rules = deps.rules ?? rulesFor(state).battle ?? BATTLE_RULES;
  const from: [number, number] = [...action.from],
    to: [number, number] = [...action.to],
    promotion = promotes ? (action.promotion ?? "q") : undefined,
    move = { from, to, side: action.side, ...(promotion ? { promotion } : {}) };
  const s = structuredClone(state),
    battle = s.battle!;
  const rng: Draw = deps.draw ?? ((stream) => draw(battle.rngState, stream));
  const roll = () => 1 + Math.min(rules.die - 1, Math.floor(rng() * rules.die));
  const next: Side = white ? "black" : "white";
  const id = s.pieceIds[from[0]][from[1]]!,
    target = battleTarget(state.board, from, to);
  let record: BattleRecord | null = null,
    advanced = true,
    kingFell: Side | null = null;
  if (target) {
    const targetId = s.pieceIds[target[0]][target[1]]!,
      defender = state.board[target[0]][target[1]]!,
      attackRoll = roll(),
      defenceRoll = roll(),
      r = strike(
        battle.units[id],
        battle.units[targetId],
        attackRoll,
        defenceRoll,
        rules,
      );
    battle.units[id].hp = r.attackerHp;
    battle.units[targetId].hp = r.defenderHp;
    record = {
      ply: s.ply + 1,
      from,
      target,
      attacker: piece,
      defender,
      attackRoll,
      defenceRoll,
      attackTotal: r.attackTotal,
      defenceTotal: r.defenceTotal,
      damage: r.damage,
      attackerHp: r.attackerHp,
      defenderHp: r.defenderHp,
      outcome: r.outcome,
    };
    battle.last = record;
    battle.count++;
    advanced = r.outcome === "defeated";
    if (r.outcome === "defeated") {
      delete battle.units[targetId];
      s.pieceIds[target[0]][target[1]] = null;
      s.board[target[0]][target[1]] = null;
      if (defender.toLowerCase() === "k") kingFell = next;
    } else if (r.outcome === "fell") {
      delete battle.units[id];
      s.pieceIds[from[0]][from[1]] = null;
      s.board[from[0]][from[1]] = null;
      if (piece.toLowerCase() === "k") kingFell = action.side;
    }
  }
  if (advanced) {
    // The target square is empty by now, so the chess transition applies
    // (castling rook, promotion) without ever seeing a king on it.
    const rookFrom =
      piece.toLowerCase() === "k" && Math.abs(to[1] - from[1]) === 2
        ? ([from[0], to[1] === 6 ? 7 : 0] as [number, number])
        : null;
    s.board = applyMove(s.board, from, to, promotion, {
      ...state.rights,
      enPassant: null,
    });
    s.pieceIds[to[0]][to[1]] = id;
    s.pieceIds[from[0]][from[1]] = null;
    if (rookFrom) {
      const rookTo = to[1] === 6 ? 5 : 3;
      s.pieceIds[from[0]][rookTo] = s.pieceIds[rookFrom[0]][rookFrom[1]];
      s.pieceIds[rookFrom[0]][rookFrom[1]] = null;
    }
    if (promotion) battle.units[id] = freshUnit(s.board[to[0]][to[1]]!, rules);
    s.rights = nextRights(state.board, state.rights, move);
  } else {
    // Nobody moved: only the clocks and any lost castling rook change.
    s.rights = structuredClone(state.rights);
    s.rights.enPassant = null;
    s.rights.fullmove += white ? 0 : 1;
    if (record!.outcome === "fell" && from[0] === (white ? 7 : 0)) {
      if (from[1] === 0) s.rights.castling[action.side].queen = false;
      if (from[1] === 7) s.rights.castling[action.side].king = false;
    }
  }
  // HP never recovers, so a battle makes every earlier position unreachable.
  if (record) s.rights.halfmove = 0;
  s.ply++;
  s.revision++;
  s.lastMove = [from, to];
  s.specialSquare = null;
  s.pendingRefusal = null;
  const key = positionKey(s.board, next, s.rights);
  if (
    !s.rights.halfmove ||
    JSON.stringify(s.rights.castling) !== JSON.stringify(state.rights.castling)
  )
    s.positions = {};
  s.positions[key] = (s.positions[key] ?? 0) + 1;
  if (kingFell)
    finish(s, "king-defeated", kingFell === "white" ? "black" : "white");
  else if (!allBattleMoves(s.board, next, s.rights).length)
    finish(s, "stalemate", null);
  else if (s.positions[key] >= 5) finish(s, "fivefold", null);
  else if (s.rights.halfmove >= 150) finish(s, "seventy-five-move", null);

  const where = `${squareName(from)} → ${squareName(to)}`;
  let text = `${pieceName(piece)} ${where}${promotion ? ` = ${promotion.toUpperCase()}` : ""}`,
    message = text;
  if (record) {
    const r = record,
      foe = lower(r.defender),
      rolls = `${r.attackRoll}+${r.attackTotal - r.attackRoll} against ${r.defenceRoll}+${r.defenceTotal - r.defenceRoll}`;
    text = `${pieceName(piece)} ${squareName(from)} ⚔ ${squareName(r.target)}`;
    message =
      r.outcome === "defeated"
        ? `${pieceName(piece)} defeats the ${foe} on ${squareName(r.target)} (${rolls}, ${r.damage} damage).`
        : r.outcome === "wounded"
          ? `${pieceName(piece)} wounds the ${foe} on ${squareName(r.target)} (${rolls}, ${r.damage} damage, ${r.defenderHp} HP left).`
          : r.outcome === "repelled"
            ? `The ${foe} on ${squareName(r.target)} repels the ${lower(piece)} (${rolls}). The attacker has ${r.attackerHp} HP left.`
            : `The ${foe} on ${squareName(r.target)} repels the ${lower(piece)} (${rolls}), and the attacker falls.`;
    if (promotion && advanced)
      message += ` Promoted to ${promotion.toUpperCase()}.`;
  }
  event(s, record ? "battle" : "move", message, { square: target ?? to });
  if (s.result) {
    event(s, "result", s.result);
    message = `${message} ${s.result}`;
  }
  s.moves.push({
    number: s.ply,
    text: `${s.ply}. ${text}`,
    message,
    special: false,
  });
  s.sideToMove = next;
  const outcome: ActionOutcome = {
    requestAccepted: true,
    turnConsumed: true,
    boardChanged: true,
    resolution: s.terminal ? "terminal" : "executed",
    message,
    special: false,
  };
  s.lastAction = outcome;
  return { ...outcome, state: s, accepted: true };
}
