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
outcomes of a battle cannot share a search window, so each is searched one
ply shallower than a quiet move. The evaluation is the chess evaluation less
what each side's wounds cost, with king HP weighted heavily.

| Level    | Depth | Time budget | Notes                                            |
| -------- | ----- | ----------- | ------------------------------------------------ |
| Easy     | 1     | 150 ms      | Plays any move within 0.8 pawns of its best      |
| Normal   | 3     | 400 ms      | About 12 ms per move in the balance runs         |
| Advanced | 5     | 1.5 s       | About 500 ms per move; reached depth 5 (least 4) |

In the browser, Advanced replied in a median of 0.2 s and at most 1.5 s over
45 moves, including the one-second pause after a player's battle.

## Measurements

`npx tsx scripts/battle-balance.ts` plays the computer against itself through
the real reducer (300-ply cap). The runs below used `--nodes 5000000`, which
stops searches on a node count so the figures repeat exactly; a repeat of the
first row reproduced every number. Run on 2026-11-10 with configuration
`2026-11-10.2`.

**Normal against Normal** (300 games: seeds 7000–7149 and 9000–9149)

| Measure                           | Seeds 7000–7149 | Seeds 9000–9149 |
| --------------------------------- | --------------- | --------------- |
| White / Black / Draw              | 72 / 67 / 11    | 68 / 67 / 15    |
| Median plies                      | 61              | 94              |
| Battles per game (fewest)         | 33.1 (9)        | 36.0 (10)       |
| Plies with a battle               | 32%             | 29%             |
| First battle, median / latest ply | 8 / 18          | 8 / 15          |
| Defeated / wounded / repelled     | 49% / 35% / 15% | 50% / 33% / 15% |
| Hits to defeat a king (median)    | 4               | 4               |

White won 140 of the 274 decisive games, 51%.

**Between levels** (every seed played twice with colours swapped)

| Pairing            | Games | Stronger level wins | Weaker level wins | Draws |
| ------------------ | ----- | ------------------- | ----------------- | ----- |
| Advanced v. Normal | 100   | 62                  | 23                | 15    |
| Normal v. Easy     | 60    | 51                  | 3                 | 6     |

## Retuning (`2026-11-10.1` to `2026-11-10.2`)

The first table (pawn attack 2, knight and bishop 4, rook 5, queen 6, king
14 HP with attack 4; equal totals hit; minimum damage 1) left three gaps:

- only 35% of battles defeated the defender, and 48% only wounded it;
- Advanced was not measurably stronger than Normal;
- White won 59 of the first 100 mirror games. A 300-game rerun put that at
  54% of decisive games, so part of it was noise.

Candidates were tried with `--rules` at 100 mirror games each:

| Change from the first table                             | Defeated | Wounded | Repelled | Median plies |
| ------------------------------------------------------- | -------- | ------- | -------- | ------------ |
| None                                                    | 36%      | 48%     | 15%      | 46           |
| Attack +1                                               | 44%      | 46%     | 9%       | 48           |
| Minimum damage 2                                        | 40%      | 44%     | 14%      | 63           |
| Lower HP for knight, bishop, rook, queen                | 41%      | 43%     | 15%      | 101          |
| Attack +1, minimum damage 2, king 16 HP                 | 46%      | 45%     | 8%       | 62           |
| Attack +1, minimum damage 3, king 16 HP                 | 52%      | 38%     | 9%       | 62           |
| **Attack +1, minimum damage 3, ties repel, king 16 HP** | **50%**  | **34%** | **15%**  | **55–91**    |

Raising attack alone made hits more deadly but nearly removed the risk of
being repelled. Sending ties to the defender restored it. Lower HP produced
long endgames with too few pieces left to finish a king. Raising the repel
damage to 2 changed little and was dropped.

Advanced's strength came from the search, not the table: with battle
outcomes searched a ply shallower, depth 3 costs what depth 2 did, so Normal
moved to depth 3 and Advanced to depth 5.

## Known gaps

- **Online play is untested here.** The integration and browser tests that
  need MongoDB could not run in the environment this was built in.
- **Some games run long.** One of the two 150-game mirror runs had a median
  of 94 plies, and 7–10% of mirror games ended at the 300-ply cap or on a
  move-count draw.
- **A slow start is possible.** The first battle came as late as ply 18 in
  one game of 300; the median is ply 8.
- **Easy is very weak against Normal** (3 wins in 60). That is against the
  computer, not a person, but the step from Easy to Normal is large.
- **Black won more often in the Advanced v. Normal pairing** (55 games to
  White's 30 over 100 colour-swapped games), although Normal mirror games
  are even. The cause was not investigated.
