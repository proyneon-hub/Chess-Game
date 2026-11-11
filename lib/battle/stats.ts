// Battle Chess numbers and dice maths. Pure and free of engine imports, so
// the browser can show odds for an online game without loading the reducer.
export type BattleUnit = {
  hp: number;
  maxHp: number;
  attack: number;
  defence: number;
};
export type UnitGrid = (BattleUnit | null)[][];
export type BattleOutcome = "defeated" | "wounded" | "repelled" | "fell";
export type BattleRules = {
  /** Sides of the die each fighter rolls. */
  readonly die: number;
  /** HP an attacker loses when its attack is repelled. */
  readonly repel: number;
  /** Least damage a successful hit deals (default 1). */
  readonly minDamage?: number;
  /** Equal totals repel the attack instead of hitting (default false). */
  readonly defenderWinsTies?: boolean;
  /** Extra starting HP for a side's king (default none). */
  readonly kingBonus?: Readonly<Partial<Record<"white" | "black", number>>>;
  readonly stats: Readonly<
    Record<string, { hp: number; attack: number; defence: number }>
  >;
};
/** What the dice need; a game's public state carries exactly this. */
export type DiceRules = Pick<
  BattleRules,
  "die" | "repel" | "minDamage" | "defenderWinsTies"
>;
/**
 * Configuration 2026-11-10.2 (docs/battle-rules.md): about half of all
 * battles defeat the defender and one attack in seven is repelled.
 */
export const BATTLE_RULES: BattleRules = Object.freeze({
  die: 6,
  repel: 1,
  minDamage: 3,
  defenderWinsTies: true,
  stats: Object.freeze({
    p: Object.freeze({ hp: 3, attack: 3, defence: 1 }),
    n: Object.freeze({ hp: 5, attack: 5, defence: 2 }),
    b: Object.freeze({ hp: 5, attack: 5, defence: 2 }),
    r: Object.freeze({ hp: 7, attack: 6, defence: 3 }),
    q: Object.freeze({ hp: 9, attack: 7, defence: 3 }),
    k: Object.freeze({ hp: 16, attack: 5, defence: 4 }),
  }),
});
export const freshUnit = (
  piece: string,
  rules: BattleRules = BATTLE_RULES,
): BattleUnit => {
  const s = rules.stats[piece.toLowerCase()];
  const hp =
    s.hp +
    (piece === "K"
      ? (rules.kingBonus?.white ?? 0)
      : piece === "k"
        ? (rules.kingBonus?.black ?? 0)
        : 0);
  return { hp, maxHp: hp, attack: s.attack, defence: s.defence };
};
/**
 * One exchange. The attacker hits when its total beats the defender's (or
 * matches it, unless ties go to the defender), for the difference but never
 * less than the minimum; otherwise it is repelled and takes `rules.repel`.
 */
export function strike(
  attacker: BattleUnit,
  defender: BattleUnit,
  attackRoll: number,
  defenceRoll: number,
  rules: DiceRules = BATTLE_RULES,
) {
  const attackTotal = attackRoll + attacker.attack,
    defenceTotal = defenceRoll + defender.defence;
  if (
    attackTotal < defenceTotal ||
    (rules.defenderWinsTies && attackTotal === defenceTotal)
  ) {
    const attackerHp = Math.max(0, attacker.hp - rules.repel);
    return {
      attackTotal,
      defenceTotal,
      damage: 0,
      attackerHp,
      defenderHp: defender.hp,
      outcome: (attackerHp > 0 ? "repelled" : "fell") as BattleOutcome,
    };
  }
  const damage = Math.max(rules.minDamage ?? 1, attackTotal - defenceTotal),
    defenderHp = Math.max(0, defender.hp - damage);
  return {
    attackTotal,
    defenceTotal,
    damage,
    attackerHp: attacker.hp,
    defenderHp,
    outcome: (defenderHp > 0 ? "wounded" : "defeated") as BattleOutcome,
  };
}
export type Odds = {
  /** Chance the defender is defeated outright. */ defeat: number;
  /** Chance the defender is hit but survives. */ wound: number;
  /** Chance the attack is repelled (the attacker loses HP). */ repel: number;
  /** Chance the attacker itself falls to the repel. */ fall: number;
  minDamage: number;
  maxDamage: number;
  /** Mean damage over the hits that do not defeat the defender. */
  woundDamage: number;
};
export function odds(
  attacker: BattleUnit,
  defender: BattleUnit,
  rules: DiceRules = BATTLE_RULES,
): Odds {
  let defeat = 0,
    wound = 0,
    repel = 0,
    woundTotal = 0,
    minDamage = Infinity,
    maxDamage = 0;
  for (let a = 1; a <= rules.die; a++)
    for (let d = 1; d <= rules.die; d++) {
      const r = strike(attacker, defender, a, d, rules);
      if (r.damage) {
        minDamage = Math.min(minDamage, r.damage);
        maxDamage = Math.max(maxDamage, r.damage);
        if (r.defenderHp > 0) {
          wound++;
          woundTotal += r.damage;
        } else defeat++;
      } else repel++;
    }
  const n = rules.die * rules.die;
  return {
    defeat: defeat / n,
    wound: wound / n,
    repel: repel / n,
    fall: attacker.hp <= rules.repel ? repel / n : 0,
    minDamage: maxDamage ? minDamage : 0,
    maxDamage,
    woundDamage: wound ? woundTotal / wound : 0,
  };
}
