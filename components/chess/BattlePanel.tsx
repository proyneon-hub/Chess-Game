"use client";
import { type Square, pieceName, squareName } from "@/lib/chess";
import type { PublicGame } from "@/lib/game/publicState";
import { battleTarget } from "@/lib/battle/moves";
import { type BattleUnit, odds } from "@/lib/battle/stats";

const percent = (n: number) => `${Math.round(100 * n)}%`;
const DICE = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const OUTCOME = {
  defeated: "Defender defeated",
  wounded: "Defender wounded",
  repelled: "Attack repelled",
  fell: "Attack repelled, attacker fell",
};
function Bar({ unit, name }: { unit: BattleUnit | null; name: string }) {
  const hp = unit?.hp ?? 0,
    max = unit?.maxHp ?? 1;
  return (
    <div>
      <div className="flex justify-between text-xs text-stone-300">
        <span>{name}</span>
        <span>{unit ? `${hp} / ${max} HP` : "Defeated"}</span>
      </div>
      <div
        role="meter"
        aria-label={`${name} HP`}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={hp}
        className="mt-1 h-3 overflow-hidden rounded border border-stone-600 bg-stone-900"
      >
        <div
          className="h-full"
          style={{
            width: `${(100 * hp) / max}%`,
            background:
              hp * 3 <= max
                ? "#f87171"
                : hp * 3 <= max * 2
                  ? "#fbbf24"
                  : "#4ade80",
          }}
        />
      </div>
    </div>
  );
}
/** Battle Chess side panel: king health, the selected piece, and the dice. */
export function BattlePanel({
  game,
  selected,
  moves,
}: {
  game: PublicGame;
  selected: Square | null;
  moves: Square[];
}) {
  const units = game.units;
  if (!units) return null;
  const king = (white: boolean) => {
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (game.board[r][c] === (white ? "K" : "k")) return units[r][c];
    return null;
  };
  const piece = selected ? game.board[selected[0]][selected[1]] : null,
    unit = selected ? units[selected[0]][selected[1]] : null;
  const targets =
    selected && piece && unit
      ? moves.flatMap((to) => {
          const t = battleTarget(game.board, selected, to);
          const foe = t && game.board[t[0]][t[1]],
            foeUnit = t && units[t[0]][t[1]];
          return t && foe && foeUnit
            ? [{ to, t, foe, foeUnit, o: odds(unit, foeUnit, game.dice) }]
            : [];
        })
      : [];
  const b = game.battle;
  return (
    <section
      aria-label="Battle"
      className="space-y-3 rounded border border-stone-600 bg-stone-900/50 px-4 py-3 text-sm text-stone-200"
    >
      <div className="grid grid-cols-2 gap-3">
        <Bar unit={king(true)} name="White king" />
        <Bar unit={king(false)} name="Black king" />
      </div>
      {b && (
        <div data-battle={b.ply}>
          <h2 className="font-medium text-amber-200">
            {b.ply === game.moves.length ? "Battle" : "Last battle"}:{" "}
            {pieceName(b.attacker)} attacks {pieceName(b.defender)} on{" "}
            {squareName(b.target)}
          </h2>
          <div className="mt-1 grid grid-cols-2 gap-3">
            {(
              [
                ["Attack", b.attackRoll, b.attackTotal],
                ["Defence", b.defenceRoll, b.defenceTotal],
              ] as const
            ).map(([name, roll, total]) => (
              <p key={name} className="flex items-center gap-2">
                <span aria-hidden="true" className="text-3xl leading-none">
                  {DICE[roll - 1]}
                </span>
                <span>
                  {name}: rolled {roll} + {total - roll} ={" "}
                  <strong>{total}</strong>
                </span>
              </p>
            ))}
          </div>
          <p className="mt-1 font-medium">
            {OUTCOME[b.outcome]}
            {b.damage
              ? `: ${b.damage} damage${b.defenderHp ? `, ${b.defenderHp} HP left` : ""}.`
              : b.attackerHp
                ? `: attacker has ${b.attackerHp} HP left.`
                : "."}
          </p>
        </div>
      )}
      {piece && unit ? (
        <div>
          <p>
            <strong>
              {pieceName(piece)} on {squareName(selected!)}
            </strong>
            : {unit.hp} / {unit.maxHp} HP, attack {unit.attack}, defence{" "}
            {unit.defence}.
          </p>
          {targets.length > 0 ? (
            <ul className="mt-1 space-y-1 text-stone-300">
              {targets.map(({ to, t, foe, foeUnit, o }) => (
                <li key={squareName(to)}>
                  {pieceName(foe)} on {squareName(t)} ({foeUnit.hp} HP):{" "}
                  {percent(o.defeat)} defeat, {percent(o.wound)} wound,{" "}
                  {percent(o.repel)} repelled
                  {o.maxDamage ? `; ${o.minDamage}–${o.maxDamage} damage` : ""}.
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-stone-400">No enemy piece in reach.</p>
          )}
        </div>
      ) : (
        <p className="text-stone-400">
          Select a piece to see its strength and its chances.
        </p>
      )}
    </section>
  );
}
