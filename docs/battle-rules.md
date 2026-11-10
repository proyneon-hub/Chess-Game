# Battle Chess rules (`battle-v1`, schema 7)

New games use configuration `2026-11-10.2`. Games begun on the first table,
`2026-11-10.1`, keep it (see "Retuning" below), and games started under
Hidden Kingdom (schemas 1–6) keep the rules they began with.

## Why

A playtest of Hidden Kingdom generation 6 found its RPG layer mostly passive:
request cards sat in a side panel, a piece refused about 1 order in 40, and
withdrawals and conspiracies almost never happened. Battle Chess replaces it
for new games with one visible mechanic that fires many times every game.

## Rules

**Movement.** Pieces move as in chess. There is no check: a king may move
into or stay under attack, and pinned pieces may move. Castling needs an
unmoved king and rook with empty squares between them, nothing more.

**Stats.**

| Piece  | HP  | Attack | Defence |
| ------ | --- | ------ | ------- |
| Pawn   | 3   | 3      | 1       |
| Knight | 5   | 5      | 2       |
| Bishop | 5   | 5      | 2       |
| Rook   | 7   | 6      | 3       |
| Queen  | 9   | 7      | 3       |
| King   | 16  | 5      | 4       |

**Battle.** Moving onto an enemy piece starts a battle. Each side rolls one
six-sided die.

- Attack total = roll + Attack. Defence total = roll + Defence.
- Attack total higher than the defence total: the defender loses the
  difference in HP, and at least 3.
- Otherwise, including on equal totals, the attack is repelled and the
  attacker loses 1 HP.
- A defender at 0 HP is removed and the attacker takes its square.
- A defender that survives keeps its square; the attacker stays where it was.
- An attacker repelled at 1 HP is removed.

A battle always uses the turn. Damage is permanent.

**Special cases.**

- En passant is a battle against the pawn. The attacker moves only if it wins.
- A pawn promotes on reaching the last rank (after winning the battle, if it
  had to fight for the square). The new piece has full stats.
- The game ends when a king is defeated, including a king that attacks at
  1 HP and is repelled.

**Draws.** Threefold and fifty-move claims, fivefold repetition and the
seventy-five-move rule remain. Any battle resets both counters, because lost
HP never returns and the earlier positions cannot recur. Insufficient
material does not apply (a lone king can still fight). A side with no move
draws.

**Undo.** The dice are part of the saved game. Undoing a battle and making
the same attack rolls the same dice.

## What the player sees

- An HP bar under every piece, and the HP number on wounded pieces.
- With a piece selected: its stats, and for each enemy in reach the chance to
  defeat it, to wound it and to be repelled, with the damage range. The
  chance to defeat is also shown on the target square.
- Both kings' HP at all times.
- The last battle's dice, totals, damage and outcome. The struck square
  flashes and a repelled attacker shakes (not under reduced motion).
- Against the computer, the reply waits about a second after the player's own
  battle so the result can be read.

## Computer opponent

`lib/battle/search.ts` is separate from the Hidden Kingdom search. An attack
is a chance node weighed by the exact dice odds over three outcomes: defender
defeated, attacker fallen, or everyone surviving with averaged HP loss. The
evaluation is the chess evaluation less what each side's wounds cost, with
king HP weighted heavily.

## Measurements

`npx tsx scripts/battle-balance.ts --games N --white LEVEL --black LEVEL`
plays the computer against itself through the real reducer (seeds from 7000,
300-ply cap). Run on 2026-11-10:

| White    | Black    | Games | White / Black / Draw | Median plies | Battles per game | Fewest in a game | Plies with a battle | First battle (median / latest) |
| -------- | -------- | ----- | -------------------- | ------------ | ---------------- | ---------------- | ------------------- | ------------------------------ |
| Normal   | Normal   | 100   | 59 / 39 / 2          | 49           | 31.4             | 5                | 45%                 | ply 8 / ply 13                 |
| Advanced | Normal   | 24    | 15 / 7 / 2           | 69           | 36.7             | 9                | 38%                 | ply 7 / ply 15                 |
| Normal   | Advanced | 24    | 14 / 9 / 1           | 57           | 32.5             | 11               | 38%                 | ply 8 / ply 15                 |
| Normal   | Easy     | 30    | 25 / 5 / 0           | 59           | 32.9             | 10               | 46%                 | ply 8 / ply 15                 |

Across the four runs, 34–38% of battles defeated the defender, 46–49%
wounded it, 14–16% were repelled and about 1% cost the attacker its life. A
king fell after a median of 5–6 hits.

For comparison, the Hidden Kingdom playtest measured 0.6–1.5 player
hesitations per game, the only event there that interrupted play.

## Known gaps

- **White wins more than Black.** 59 of 100 Normal mirror games went to
  White. Moving first appears to matter more than in chess.
- **Advanced is not clearly stronger than Normal.** In the two 24-game
  pairings the side playing White won both, whichever level it was. The
  samples are small, and the Advanced search has a one-second budget, so it
  often does not finish its full depth.
- **Most battles wound, not defeat.** The stat table has had one tuning pass
  (the king was raised from 10 HP and 3 defence, which gave 36-ply games).
- **Online play is untested here.** The integration and browser tests that
  need MongoDB could not run in the environment this was built in.
