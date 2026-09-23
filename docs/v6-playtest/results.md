# Playtest tuning: `2026-09-22.1`

A playtest found the hidden politics almost invisible in real games against the
computer: about one hesitation every six games, with no withdrawals, complaints,
warnings or plots. `2026-09-22.1` is the new default for new games. It is still
generation 5 (`hidden-kingdom-v5`), and saved `2026-09-10.1` games keep their rules.

## What changed

| Setting                        | `2026-09-10.1` | `2026-09-22.1` | Why                                                                               |
| ------------------------------ | -------------- | -------------- | --------------------------------------------------------------------------------- |
| `agencyBase`                   | 0.005          | 0.035          | Baseline hesitation was negligible                                                |
| `progression.calmCap`          | 0.006          | 0.03           | Most orders are calm, and the cap held them under 0.6%                            |
| `progression.fearWeight`       | 0.1            | 0.35           | Hesitation should follow danger and mistreatment…                                 |
| `progression.resentmentWeight` | 0.09           | 0.3            | …so harsh play hesitates more than careful play                                   |
| `progression.harmWeight`       | 0.025          | 0.1            | Repeated harm should show                                                         |
| `encounters.aiAccommodation`   | 75             | 25             | The computer played weakening moves (a7–a6–a5, b7–b5) to satisfy its own requests |

The guarantees are unchanged: the first 8 plies, kings and check escapes always
obey, there is one refusal per turn, and `refusalMax` stays 0.18.

## Results

`npm run playtest -- --games 200 --config <version> [--difficulty easy] --json true`,
seeds 7000–7199. White plays one of three styles against the real computer (Black):

- `aware` answers public request cards;
- `engine` is a Normal-strength search;
- `reckless` is `board-mistreatment`.

White repeats a hesitated order half the time. Hesitations are per game, for
White (the player) and Black (the computer).

### Against Normal

| Style    | Config      | W/D/L     | Median plies | Hesitations W / B | Games with a hesitation | Requests W / B |
| -------- | ----------- | --------- | ------------ | ----------------- | ----------------------- | -------------- |
| aware    | 09-10.1     | 0/0/200   | 48           | 0.13 / 0.05       | 16%                     | 2.56 / 3.65    |
| aware    | **09-22.1** | 0/0/200   | 50           | **0.67 / 0.49**   | **69%**                 | 2.52 / 3.77    |
| engine   | 09-10.1     | 18/163/19 | 64           | 0.10 / 0.09       | 15%                     | 4.58 / 5.41    |
| engine   | **09-22.1** | 29/151/20 | 64           | **1.02 / 1.09**   | **81%**                 | 5.43 / 6.21    |
| reckless | 09-10.1     | 0/0/200   | 50           | 0.14 / 0.06       | 19%                     | 1.88 / 4.10    |
| reckless | **09-22.1** | 0/0/200   | 48           | **0.76 / 0.49**   | **71%**                 | 1.85 / 4.06    |

### Against Easy

| Style    | Config      | W/D/L     | Median plies | Hesitations W / B | Games with a hesitation |
| -------- | ----------- | --------- | ------------ | ----------------- | ----------------------- |
| aware    | 09-10.1     | 20/129/51 | 120          | 0.20 / 0.13       | 26%                     |
| aware    | **09-22.1** | 20/134/46 | 120          | **1.41 / 0.93**   | **89%**                 |
| engine   | 09-10.1     | 200/0/0   | 43           | 0.04 / 0.10       | 12%                     |
| engine   | **09-22.1** | 200/0/0   | 51           | **0.67 / 0.40**   | **59%**                 |
| reckless | 09-10.1     | 0/4/196   | 64           | 0.23 / 0.10       | 29%                     |
| reckless | **09-22.1** | 0/8/192   | 64           | **0.89 / 0.94**   | **78%**                 |

The engine style's many draws against Normal are fivefold repetitions between
two identical searches. That's a known AI issue, tracked separately.

## Against the plan's targets

| Target                                               | Result                                                                                                                                                                                                                                                      |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Careful play: 1–2 hesitations per game               | **Met.** 1.2–2.3 in total (0.7–1.4 for the player's own pieces)                                                                                                                                                                                             |
| At least 60% of careful games see a hesitation       | **Met,** except the engine style against Easy (59%), whose games are short wins                                                                                                                                                                             |
| Harsh play hesitates more than careful               | **Met for the player's pieces against Normal** (0.76 vs 0.67). Well short of the plan's 3–5 per game: reckless games against Normal are short (48 plies)                                                                                                    |
| Warned withdrawals in at least 20% of reckless games | **Not met: 0.** Withdrawals need a warned "strain" request, which needs a piece to stay threatened for two turns with fear ≥ 40. Against a computer that takes hanging pieces, that barely happens (maximum fear observed: 35). No config value fixes this. |
| Complaints and warnings reachable in harsh games     | **Not met: 0.** A complaint needs the same pair of pieces harmed together twice. Reckless play harms a different piece each time (median 8 harms on 8 different pieces), and related pairs are rare.                                                        |

The last two need rule changes, not tuning. They are planned as a
generation-6 change. Phase C moved their thresholds into `ENCOUNTER_RULES`
(`complaint*`, `plotPly`, `withdrawalMax`), so v6 can tune them.

## Reproduce

```sh
npm run playtest -- --games 200 --config 2026-09-10.1 --json true
npm run playtest -- --games 200 --config 2026-09-22.1 --json true
npm run playtest -- --games 200 --config 2026-09-22.1 --difficulty easy --json true
```

The computer's time budget is soft. At depth 1–2 the search finishes inside it,
so reruns match. The Easy spread uses a seeded draw in the harness.

---

# Generation 6: `2026-09-23.1`

Generation 6 (`hidden-kingdom-v6`) is the default for new games. It keeps the
v5 state shape and the `2026-09-22.1` tuning, and adds rule changes behind
three capability flags (`lib/rpg/capabilities.ts`):

| Flag                   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `requestStakes`        | An ignored personal request (initiative, confidence, protection, relief, strain) leaves its piece **restless**: +4% refusal for 4 own turns. The card says so ("…grows restless; its next orders may meet hesitation").                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `soundRequests`        | No initiative requests for rook pawns ("the pawn at a2 looks for room to act").                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `frightenedWithdrawal` | Any piece whose fear reaches 18 is warned in public ("The knight at d4 is shaken; ordering it back into danger may make it withdraw."), at most once per 8 own turns, not only one that raised a strain request. After one free turn, ordering it into real danger gives it a 40–50% chance to withdraw to a safer square.                                                                                                                                                                                                                                                                                                                                                                            |
| `courtComplaints`      | A complaint comes from a harsh court whose side took 3+ harms within 10 own turns (tyranny ≥ 12, legitimacy ≤ 62). The most-harmed living piece speaks, with its nearest ally. A captured speaker is replaced by the survivor's nearest free ally, and an unanswerable complaint stays open until its 7-turn deadline. Further harm renews it (stage 2, a public warning) after one own turn. If the player doesn't answer in the following turn, it becomes a plot between the two pieces, provided the court is still harsh (ply > 40, tyranny ≥ 15, legitimacy ≤ 62). The existing three plot warnings, counterplay (guards, separation, recovery, king distance) and armed attempt are unchanged. |

Other v6 settings:

- Strain can be requested after one dangerous turn at fear ≥ 18.
- A warned withdrawal has a 40–50% chance.
- A plot breaks up when the court recovers (tyranny < 8, legitimacy > 66).

v5 gates that were literals are now `ENCOUNTER_RULES` entries with unchanged v5 values: `strainDangerTurns`, `complaintDeadline`, `complaintStageTurns`, `withdrawalMax`.

## Results (200 games per style, seeds 7000–7199)

Complaint and plot counts include both sides: the player's court and the computer's.

| Opponent | Style    | W/D/L     | Hesitations W / B | Complaints (games reaching 50) | Stage-2 renewals | Plots | Warnings (games reaching 60) | Regicides |
| -------- | -------- | --------- | ----------------- | ------------------------------ | ---------------- | ----- | ---------------------------- | --------- |
| Normal   | aware    | 0/1/199   | 0.72 / 0.47       | 19%                            | 11               | 5     | 3%                           | 0         |
| Normal   | engine   | 75/64/61  | 1.64 / 1.48       | 6%                             | 3                | 2     | 1%                           | 0         |
| Normal   | reckless | 0/0/200   | 0.76 / 0.50       | 8%                             | 9                | 2     | 0%                           | 0         |
| Easy     | aware    | 19/121/60 | 1.25 / 1.05       | 25%                            | 10               | 5     | 2%                           | 0         |
| Easy     | engine   | 200/0/0   | 0.43 / 0.56       | 15%                            | 4                | 2     | 4%                           | 0         |
| Easy     | reckless | 0/5/195   | 0.90 / 0.88       | 26%                            | 20               | 5     | 4%                           | 0         |

With `2026-09-22.1`, all of these were 0.

## Against the plan's targets

| Target                                                | Result                                                                                                                                                          |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complaints in ≥ 25% of reckless games reaching ply 50 | **Met against Easy (26%)**, not against Normal (8%), where reckless games end around ply 48                                                                     |
| Warnings in ≥ 10% of reckless games reaching ply 60   | **Not met:** 0–4%. The arc is reachable but rare. About 1 in 40–100 games sees a plot. Most complaints are answered or defused by separation before they renew. |
| Regicide ≤ 3% of reckless games, 0 in careful games   | **Met:** 0 in 1,200 games                                                                                                                                       |
| Warned withdrawals in ≥ 20% of reckless games         | **Not met:** about 0. A withdrawal needs the same warned piece to be ordered into danger again, which play against the computer rarely produces.                |
| Requests stay about 1 per 6–10 plies                  | Met                                                                                                                                                             |

The conspiracy is now a rare climax that play can bring about, where before it was unreachable. If it should be more common, the next levers are the renewal step (`complaintStageTurns`, `complaintHarms`) and the plot court gates. Withdrawals would need a rule change: for example, warning every frightened piece rather than only the strained one.

## Reproduce

```sh
npm run playtest -- --games 200 --json true
npm run playtest -- --games 200 --difficulty easy --json true
```

## Frightened withdrawals (`frightenedWithdrawal`)

Added after the first v6 results showed warned withdrawals effectively absent:
only a piece that raised a strain request was ever warned. v6 had not shipped,
so its capability row was extended rather than creating generation 7. The pinned
replay for later configs changed accordingly.

The playtest harness now seeds the Easy computer's randomness per game. Earlier
Easy runs shared one random stream across styles, so a style's results depended
on which ran before it. The numbers below use the fixed harness.

200 games per style, seeds 7000–7199:

| Opponent | Style    | Shaken warnings/game (both sides) | Games with a warned withdrawal | Complaints (games reaching 50) | Plots | Regicides |
| -------- | -------- | --------------------------------- | ------------------------------ | ------------------------------ | ----- | --------- |
| Normal   | aware    | 4.08                              | 3%                             | 19%                            | 5     | 0         |
| Normal   | engine   | 1.74                              | 0%                             | 6%                             | 2     | 0         |
| Normal   | reckless | 5.05                              | **15%**                        | 10%                            | 2     | 0         |
| Easy     | aware    | 5.58                              | 10%                            | 23%                            | 3     | 0         |
| Easy     | engine   | 4.20                              | 2%                             | 24%                            | 5     | 0         |
| Easy     | reckless | 6.73                              | **11%**                        | 26%                            | 4     | 0         |

Against the targets: warned withdrawals appear in 11–15% of reckless games, up
from about 0, but short of the plan's 20%. Careful play stays at or below 2%
(target ≤ 5%). The remaining limit is that a withdrawal needs the player to
order the specific shaken piece into real danger after the warning.

---

# Presence baseline: what a player actually sees

Every earlier table in this document counts _new_ things: a fresh hesitation,
a card offered for the first time, a changed warning message. That undercounts
what's on screen, because a request card stays visible for 3–7 own turns once
offered, and a standing warning persists until it's resolved. A player looking
at the board mid-game sees whichever of these are still open, not just the
turn each one started.

`lib/rpg/presence.ts` measures this directly: a ply "has presence" if, right
after it, any of a request card, a standing warning, a pending or
just-resolved hesitation, an unexpected move (a withdrawal or a heroic
overrun), or a fresh RPG event-log line is showing. `npm run playtest` now
reports this as `presence` alongside the old metric, renamed `event plies`
(a ply where something new happened, not just persisted). Fixing a
ply-counting bug (a refusal doesn't advance `ply`, so the old code could count
one ply twice) and folding in event codes the old code never tracked
(`encounterOutcome`, `shaken`) means `event plies` doesn't read as a corrected
version of the old `signal plies` number: it reads noticeably higher, because
it now covers more of what actually happens, not less.

## Results (200 games per style, seeds 7000–7199)

`npm run playtest -- --games 200 --config <version> [--difficulty easy] --json true`.
`presence >10` excludes the opening (grace(8) plus the first request at ply
10, where nothing can show yet). `presence W-turn` is presence measured right
as White is about to move, which is what a human player actually looks at.
`games ≥60%` is the share of individual games whose own presence, not the
pooled average, reaches the target.

### Against Normal

| Config           | Style        | Presence | Presence >10 | Presence W-turn | Cards W\|B | Hesitation | Event plies | Median game presence | Games ≥60% |
| ---------------- | ------------ | -------- | ------------ | --------------- | ---------- | ---------- | ----------- | -------------------- | ---------- |
| 2026-09-10.1     | aware        | 51%      | 61%          | 56%             | 17%\|35%   | 0%         | 23%         | 50%                  | 12%        |
| 2026-09-10.1     | reckless     | 57%      | 70%          | 60%             | 19%\|40%   | 0%         | 23%         | 57%                  | 40%        |
| 2026-09-22.1     | aware        | 52%      | 62%          | 57%             | 17%\|36%   | 2%         | 25%         | 52%                  | 14%        |
| 2026-09-22.1     | reckless     | 58%      | 71%          | 61%             | 19%\|41%   | 3%         | 25%         | 58%                  | 42%        |
| **2026-09-23.1** | **aware**    | **55%**  | 65%          | 57%             | 19%\|34%   | 2%         | 30%         | 54%                  | 23%        |
| **2026-09-23.1** | **reckless** | **60%**  | 74%          | 61%             | 19%\|41%   | 3%         | 32%         | 61%                  | 55%        |
| 2026-09-23.1     | engine       | 54%      | 58%          | 59%             | 25%\|31%   | 2%         | 27%         | 56%                  | 32%        |

### Against Easy

| Config           | Style        | Presence | Presence >10 | Presence W-turn | Cards W\|B | Hesitation | Event plies | Median game presence | Games ≥60% |
| ---------------- | ------------ | -------- | ------------ | --------------- | ---------- | ---------- | ----------- | -------------------- | ---------- |
| 2026-09-10.1     | aware        | 44%      | 48%          | 49%             | 21%\|25%   | 0%         | 20%         | 46%                  | 12%        |
| 2026-09-10.1     | reckless     | 66%      | 75%          | 68%             | 13%\|54%   | 0%         | 22%         | 64%                  | 60%        |
| 2026-09-22.1     | aware        | 47%      | 51%          | 52%             | 19%\|29%   | 2%         | 22%         | 50%                  | 16%        |
| 2026-09-22.1     | reckless     | 67%      | 76%          | 69%             | 13%\|55%   | 3%         | 24%         | 64%                  | 63%        |
| **2026-09-23.1** | **aware**    | **50%**  | 54%          | 54%             | 19%\|30%   | 2%         | 25%         | 50%                  | 23%        |
| **2026-09-23.1** | **reckless** | **69%**  | 79%          | 69%             | 15%\|53%   | 3%         | 31%         | 66%                  | 69%        |
| 2026-09-23.1     | engine       | 50%      | 60%          | 58%             | 21%\|27%   | 2%         | 28%         | 49%                  | 16%        |

`warning`, `unexpected` and `ambient` are all near 0% across every row (the
ambient channel doesn't exist yet; see the next section) and are left out of
these tables for space; they're in the full `--json true` output.

## Which rows the target applies to, and where the honest baseline lands

The target is `aware` and `reckless` against both opponents: `aware` because
it's closest to an attentive human, `reckless` because harsh play is meant to
surface more, not less. `engine` is reported for context but isn't held to
it, since it mirrors the computer's own search rather than a human style, and
its long, evenly-matched games against Normal skew the number.

**On the current default (`2026-09-23.1`), `reckless` already clears 60%
against both opponents (60%/69%). `aware` is close but under (55% Normal,
50% Easy).** That's a materially smaller gap than the project expected: the
event-based numbers this document opened with (13–17%) measured something a
player barely registers, not how often the board actually shows something.
Most of the honest number was already earned by cards simply staying open
once offered: `2026-09-10.1`, the current production config, already reads
44–66% under this metric, before any of this document's tuning.

## Reproduce

```sh
npm run playtest -- --games 200 --config 2026-09-10.1 --json true
npm run playtest -- --games 200 --config 2026-09-22.1 --json true
npm run playtest -- --games 200 --config 2026-09-23.1 --json true
npm run playtest -- --games 200 --config <version> --difficulty easy --json true
```

Add `--trace <seed>` to print `ply mover channels event-lines` for one game
in the run, to check the metric by eye against what the board would show.

---

# Ambient flavor (`ambientFlavor`, v6 only)

`leadershipV3.ts`'s `trust()`/`ambient()` collect "the pawn at b2 settles
after the change of orders"-style observations every turn once responsibility
is on (schema 4+), but they were only ever surfaced by `observationsAtLeadership`,
true for schema 4 alone. In v5 and v6 that data was computed and thrown away
on every single move.

`ambientFlavor` (a new v6-only capability) surfaces it, but only to fill a
ply that would otherwise show nothing: it checks, using the private event
codes, whether any of the request/warning/hesitation/court lines in
`RPG_LINE_CODES` already fired since the move started, and skips a subject
that already has its own active card. `emitObservation`'s existing cooldowns
(one line per side every 4 own turns, per subject every 6) and priority order
are unchanged, so this can still only ever add one line.

A real bug came out of building this: a move that resolves an earlier
hesitation runs as a second, separate `submitMove` call, so its own
`seqBefore` can't see the refusal's event from the first call. Fixed by also
skipping ambient whenever `state.pendingRefusal` was already set when the
call started — that ply already has its own signal regardless of what this
call's own event log shows.

## Results (200 games per style, seeds 7000-7199, `2026-09-23.1`)

| Opponent | Style    | Presence      | Core presence | Ambient | Games ≥60%    |
| -------- | -------- | ------------- | ------------- | ------- | ------------- |
| Normal   | aware    | 55% → **56%** | 55%           | 2%      | 23% → **25%** |
| Normal   | reckless | 60% → **61%** | 60%           | 2%      | 55% → **57%** |
| Easy     | aware    | 50% → **51%** | 50%           | 1%      | 23% → **25%** |
| Easy     | reckless | 69% → 69%     | 69%           | 2%      | 69% → **71%** |

(Left arrow values are the P1 baseline for the same config, before this
change.) Ambient stays capped near 1-2% of plies everywhere, well inside the
guard rail (core presence, excluding ambient, must stay ≥50% on its own —
it does, unchanged). The gain is real but small: `aware` moves closer to 60%
but doesn't cross it on its own (56% Normal, 51% Easy). Closing the rest of
the gap is P5's job.

## Reproduce

```sh
npm run playtest -- --games 200 --config 2026-09-23.1 --json true
npm run playtest -- --games 200 --config 2026-09-23.1 --difficulty easy --json true
```

---

# Presence tuning (`V6_CONFIG.encounters`, v6 only)

P4 left `aware` short of the 60% target (56% Normal, 51% Easy) while
`reckless` already cleared it. Two levers from the plan's candidate list were
tried on seeds 7000-7199 against Normal, `reckless` style (the row with the
most headroom to lose, and the one that ended up mattering):

**Lever 1 — longer card windows.** `personalWindow` 3→4 and `petitionWindow`
4→5 own turns in `V6_CONFIG.encounters`: an unanswered card simply stays on
screen one turn longer. Isolated (firstPly left at 10): presence 61%→62%,
games ≥60% 57%→61%. Small, clean, in the expected direction. **Shipped.**

**Lever 5 — earlier start.** `encounters/state.ts`'s `initialEncounters` and
`encounters/validation.ts` both had `firstPly` hardcoded to `10` independently
of config (two separate spots — neither read `ENCOUNTER_RULES.firstPly` at
all, let alone a per-config override), so lowering it in config alone didn't
even work until both were fixed to read from config. Once wired through and
set to 9, isolated (windows left unwidened): presence collapsed to 51%,
games ≥60% to 14% — a large *regression*, not the small gain the lever was
supposed to be. Combined with lever 1: 53% / 19%, still well under the 61% /
57% baseline.

That direction is backwards from what the change should do — starting the
window one ply earlier should only ever add opportunities, and `presence
>10` (which excludes the un-fillable opening entirely) *also* dropped, from
75% to 59%, which a genuinely earlier start can't explain either. The likely
cause: every encounter/stochastic decision in a game shares one seeded RNG
stream, and moving the director's first eligible ply earlier means it starts
calling `draw()` one ply sooner than before. That reshuffles the sequence of
random draws for every later encounter decision in the same game — offer
timing, acceptance, withdrawals, complaints, plot rolls — for the *entire
rest of the game*, on top of and unrelated to the one extra opportunity the
change intended to add. On a fixed seed range that reshuffle can land well
either direction; here it landed hard against `reckless`/Normal. **Dropped**
— the risk of an uncontrolled per-seed swing, on real player seeds too, isn't
worth a lever whose own isolated effect can't be told apart from noise.

`lib/rpg/encounters/state.ts` and `lib/rpg/encounters/validation.ts` keep
their fix (both now read `firstPly` from config instead of a hardcoded `10`)
since it's correct regardless of whether any config actually overrides the
value — `V6_CONFIG` doesn't, so `ENCOUNTER_RULES.firstPly` (10) still applies
everywhere, unchanged.

## Results (200 games per style, seeds 7000-7199, `2026-09-23.1`)

### Against Normal

| Style    | Presence      | Presence >10 | Core presence | Ambient | Games ≥60%    |
| -------- | ------------- | ------------ | -------------- | ------- | ------------- |
| aware    | 56% → 56%     | 67%          | 55%             | 2%      | 25% → 28%     |
| engine   | —             | 60%          | 55%             | 2%      | 42%           |
| reckless | 61% → **62%** | 75%          | 61%             | 2%      | 57% → **61%** |

### Against Easy

| Style    | Presence      | Presence >10 | Core presence | Ambient | Games ≥60%    |
| -------- | ------------- | ------------ | -------------- | ------- | ------------- |
| aware    | 51% → **52%** | 56%          | 51%             | 1%      | 25% → **29%** |
| engine   | —             | 64%          | 52%             | 2%      | 25%           |
| reckless | 69% → **70%** | 80%          | 69%             | 2%      | 71% → **72%** |

(Left arrow values are the P4 result for the same config; `engine` wasn't
broken out separately in P4's tables, so it has no baseline to compare.) The
guard rail holds everywhere: core presence (all channels but ambient) stays
within a point of total presence, so the gain isn't manufactured by ambient
filler.

**`aware` still doesn't clear 60% on its own (56% Normal, 52% Easy).** The
plan's remaining levers (2-4: faster cadence, a configurable multi-card slot,
per-side director clocks) were not attempted — lever 5's outcome is a strong
signal that any further change to *when* the director acts, not just how
long a card stays up, needs the same seed-reshuffle scrutiny before being
trusted, and that's a larger investigation than this PR's scope. `reckless`
comfortably clears the target against both opponents (62%/70%); `aware`
landed close but under, same as P4 — closing that remaining gap is left for
a future PR, not assumed to be worth forcing here.

## Reproduce

```sh
npm run playtest -- --games 200 --style aware,engine,reckless --config 2026-09-23.1 --json true
npm run playtest -- --games 200 --style aware,engine,reckless --config 2026-09-23.1 --difficulty easy --json true
```
