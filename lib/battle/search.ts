// The computer's search for Battle Chess. Separate from lib/ai/search.ts so
// the older rules' search stays byte-identical. Battles are chance nodes:
// each attack is weighed over its outcomes (defender defeated, defender
// wounded or attacker repelled, attacker fallen) using the exact dice odds.
import {
  type Board,
  type ChessRights,
  type Side,
  applyMove,
  isWhite,
} from "@/lib/chess";
import { material, nextRights, positionKey } from "@/lib/chessRules";
import { evaluateBoard } from "@/lib/ai/evaluate";
import { type BattleMove, allBattleMoves, battleTarget } from "./moves";
import {
  BATTLE_RULES,
  type BattleRules,
  type BattleUnit,
  type UnitGrid,
  freshUnit,
  odds,
} from "./stats";

export type BattleSearchInput = {
  rules: "battle";
  board: Board;
  rights: ChessRights;
  side: Side;
  units: UnitGrid;
  depth: number;
  budgetMs: number;
  maxNodes?: number;
  /** Repetition counts from the game. */
  positions?: Record<string, number>;
  /** Play a random move among those within this many centipawns of the best. */
  spreadCp?: number;
  battle?: BattleRules;
};
export type BattleSearchResult = {
  moves: BattleMove[];
  completedDepth: number;
  nodes: number;
  elapsedMs: number;
};
type Node = { board: Board; units: UnitGrid; rights: ChessRights };
type Odds = ReturnType<typeof odds>;
/** Dice odds depend on four small integers; a search asks for them often. */
function oddsCache(rules: BattleRules) {
  const seen = new Map<number, Odds>();
  return (a: BattleUnit, d: BattleUnit): Odds => {
    const key =
      a.attack * 100000 +
      d.defence * 1000 +
      d.hp * 10 +
      (a.hp <= rules.repel ? 1 : 0);
    let o = seen.get(key);
    if (!o) seen.set(key, (o = odds(a, d, rules)));
    return o;
  };
}
const WIN = 99000,
  KING_HP = 220,
  WOUND = 0.6;

/** White's advantage: chess evaluation, less what each side's wounds cost. */
export function evaluateBattle(board: Board, units: UnitGrid): number {
  let score = evaluateBoard(board);
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c],
        u = units[r][c];
      if (!p || !u) continue;
      const kind = p.toLowerCase(),
        lost = u.maxHp - u.hp,
        cost =
          kind === "k"
            ? KING_HP * lost
            : material[kind] * WOUND * (lost / u.maxHp);
      score += isWhite(p) ? -cost : cost;
    }
  return score;
}
const worth = (p: string, u: BattleUnit) =>
  p.toLowerCase() === "k"
    ? KING_HP * u.maxHp
    : material[p.toLowerCase()] * (1 - WOUND + (WOUND * u.hp) / u.maxHp);
/** Expected material swing of one attack, for ordering and the leaf bonus. */
function expectedGain(
  n: Node,
  m: BattleMove,
  rules: BattleRules,
  chances: (a: BattleUnit, d: BattleUnit) => Odds,
): number {
  const t = battleTarget(n.board, m.from, m.to);
  if (!t) return 0;
  const a = n.units[m.from[0]][m.from[1]]!,
    d = n.units[t[0]][t[1]]!,
    attacker = n.board[m.from[0]][m.from[1]]!,
    defender = n.board[t[0]][t[1]]!,
    o = chances(a, d),
    perHp = (p: string, u: BattleUnit) =>
      p.toLowerCase() === "k"
        ? KING_HP
        : (material[p.toLowerCase()] * WOUND) / u.maxHp;
  return (
    o.defeat * (defender.toLowerCase() === "k" ? WIN / 4 : worth(defender, d)) +
    o.wound * o.woundDamage * perHp(defender, d) -
    (o.repel - o.fall) * rules.repel * perHp(attacker, a) -
    o.fall * (attacker.toLowerCase() === "k" ? WIN / 4 : worth(attacker, a))
  );
}
const cloneUnits = (units: UnitGrid) => units.map((row) => [...row]);
/** The piece advances (after a defeat, or with no battle at all). */
function advance(n: Node, m: BattleMove, rules: BattleRules): Node {
  const t = battleTarget(n.board, m.from, m.to);
  let board = n.board;
  const units = cloneUnits(n.units);
  if (t) {
    board = board.map((row) => [...row]);
    board[t[0]][t[1]] = null;
    units[t[0]][t[1]] = null;
  }
  const castle =
    board[m.from[0]][m.from[1]]!.toLowerCase() === "k" &&
    Math.abs(m.to[1] - m.from[1]) === 2;
  board = applyMove(board, m.from, m.to, m.promotion, {
    ...n.rights,
    enPassant: null,
  });
  units[m.to[0]][m.to[1]] = m.promotion
    ? freshUnit(board[m.to[0]][m.to[1]]!, rules)
    : units[m.from[0]][m.from[1]];
  units[m.from[0]][m.from[1]] = null;
  if (castle) {
    const rookFrom = m.to[1] === 6 ? 7 : 0,
      rookTo = m.to[1] === 6 ? 5 : 3;
    units[m.from[0]][rookTo] = units[m.from[0]][rookFrom];
    units[m.from[0]][rookFrom] = null;
  }
  return { board, units, rights: nextRights(n.board, n.rights, m) };
}
/** Outcomes of a move with their probabilities (one entry if no battle). */
function outcomes(
  n: Node,
  m: BattleMove,
  rules: BattleRules,
  chances: (a: BattleUnit, d: BattleUnit) => Odds,
): { p: number; node: Node }[] {
  const t = battleTarget(n.board, m.from, m.to);
  if (!t) return [{ p: 1, node: advance(n, m, rules) }];
  const a = n.units[m.from[0]][m.from[1]]!,
    d = n.units[t[0]][t[1]]!,
    o = chances(a, d),
    rights: ChessRights = { ...n.rights, enPassant: null, halfmove: 0 },
    out: { p: number; node: Node }[] = [];
  if (o.defeat) out.push({ p: o.defeat, node: advance(n, m, rules) });
  if (o.fall) {
    const board = n.board.map((row) => [...row]),
      units = cloneUnits(n.units);
    board[m.from[0]][m.from[1]] = null;
    units[m.from[0]][m.from[1]] = null;
    out.push({ p: o.fall, node: { board, units, rights } });
  }
  // Everyone survives: one averaged position for wound and repel together.
  const stay = o.wound + o.repel - o.fall;
  if (stay > 0) {
    const units = cloneUnits(n.units);
    units[t[0]][t[1]] = {
      ...d,
      hp: Math.max(1, Math.round(d.hp - (o.wound * o.woundDamage) / stay)),
    };
    units[m.from[0]][m.from[1]] = {
      ...a,
      hp: Math.max(
        1,
        Math.round(a.hp - ((o.repel - o.fall) * rules.repel) / stay),
      ),
    };
    out.push({ p: stay, node: { board: n.board, units, rights } });
  }
  return out;
}
const hasKing = (board: Board, white: boolean) => {
  const k = white ? "K" : "k";
  for (let r = 0; r < 8; r++) if (board[r].includes(k)) return true;
  return false;
};

export function searchBattle(
  input: BattleSearchInput,
  random: () => number = Math.random,
): BattleSearchResult {
  const start = performance.now(),
    deadline = start + input.budgetMs,
    rules = input.battle ?? BATTLE_RULES,
    chances = oddsCache(rules),
    timeout = {};
  let nodes = 0,
    completedDepth = 0;
  const opposite = (s: Side): Side => (s === "white" ? "black" : "white");
  const ordered = (n: Node, side: Side) =>
    allBattleMoves(n.board, side, n.rights)
      .map((m) => ({ m, gain: expectedGain(n, m, rules, chances) }))
      .sort((x, y) => y.gain - x.gain);
  function negamax(
    n: Node,
    side: Side,
    depth: number,
    alpha: number,
    beta: number,
    ply: number,
  ): number {
    if (
      ++nodes % 256 === 0 &&
      (performance.now() > deadline ||
        (input.maxNodes !== undefined && nodes > input.maxNodes))
    )
      throw timeout;
    const white = side === "white";
    if (!hasKing(n.board, white)) return -WIN + ply;
    if (!hasKing(n.board, !white)) return WIN - ply;
    if (depth <= 0) {
      // The side to move may still strike: credit its best attack.
      let best = 0;
      for (const m of allBattleMoves(n.board, side, n.rights))
        if (n.board[m.to[0]][m.to[1]] || m.from[1] !== m.to[1]) {
          const gain = expectedGain(n, m, rules, chances);
          if (gain > best) best = gain;
        }
      return (white ? 1 : -1) * evaluateBattle(n.board, n.units) + best * 0.5;
    }
    const moves = ordered(n, side);
    if (!moves.length) return 0;
    let best = -Infinity;
    for (const { m } of moves) {
      const outs = outcomes(n, m, rules, chances);
      let value = 0;
      if (outs.length === 1 && outs[0].p === 1)
        value = -negamax(
          outs[0].node,
          opposite(side),
          depth - 1,
          -beta,
          -alpha,
          ply + 1,
        );
      else
        // A battle's outcomes cannot share a search window, so each is
        // searched one ply shallower to keep the tree affordable.
        for (const o of outs)
          value +=
            o.p *
            -negamax(
              o.node,
              opposite(side),
              depth - 2,
              -Infinity,
              Infinity,
              ply + 1,
            );
      if (value > best) best = value;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }
  const root: Node = {
      board: input.board,
      units: input.units,
      rights: input.rights,
    },
    rootMoves = ordered(root, input.side);
  let ranked = rootMoves.map(({ m, gain }) => ({ move: m, score: gain }));
  try {
    for (let depth = 1; depth <= input.depth; depth++) {
      const scored: typeof ranked = [];
      // Moves that cannot come within the spread of the best need no exact
      // score, so quiet moves are searched against that bound.
      let floor = -Infinity;
      for (const { move } of ranked) {
        let score = 0;
        const outs = outcomes(root, move, rules, chances),
          quiet = outs.length === 1 && outs[0].p === 1;
        for (const o of outs) {
          score +=
            o.p *
            -negamax(
              o.node,
              opposite(input.side),
              quiet ? depth - 1 : depth - 2,
              -Infinity,
              quiet ? -floor : Infinity,
              1,
            );
          // A quiet move back into a repeated position is mildly unwelcome.
          if (o.p === 1 && input.positions)
            score -=
              40 *
              (input.positions[
                positionKey(o.node.board, opposite(input.side), o.node.rights)
              ] ?? 0);
        }
        scored.push({ move, score });
        floor = Math.max(floor, score - (input.spreadCp ?? 0) - 1);
      }
      ranked = scored.sort((x, y) => y.score - x.score);
      completedDepth = depth;
    }
  } catch (e) {
    if (e !== timeout) throw e;
  }
  if (input.spreadCp && ranked.length > 1) {
    const pool = ranked.filter(
      (c) => c.score >= ranked[0].score - input.spreadCp!,
    );
    const pick = pool[Math.floor(random() * pool.length)];
    ranked = [pick, ...ranked.filter((c) => c !== pick)];
  }
  return {
    moves: ranked.map((c) => c.move),
    completedDepth,
    nodes,
    elapsedMs: performance.now() - start,
  };
}
