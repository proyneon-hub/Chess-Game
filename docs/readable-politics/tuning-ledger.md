# Tuning ledger

## Corrected baseline, frozen before screening

Schema 4, `hidden-kingdom-v4`, `2026-09-09.1` inherits every numerical value
from `2026-09-08.6`. Autonomous danger uses the existing physical fear increment
of 2 instead of the commanded exposure penalty. It has one nullable hazard per
subject, excluded from harm/grave histories. A reckless order avoided by retreat
creates a closed command grievance, not an open physical exposure. No reward is
earned by an autonomous rescue or unintended protection; the helpful piece can
gain the existing +4 relationship improvement (+6 for a disputed pair).

Ambient priorities are dispute opening, reconciliation, neglect, then trust
repair. Only one candidate is emitted, with the existing four-own-turn side and
six-own-turn subject/category cooldowns. No queued stale observations or RNG.

Both 1,000-game development cohorts retain identical game outcomes and agency
counts to v3 in this sample. Constructed rare branches establish the attribution
fix separately. Ordinary: 960/91,009 refusals, 533/958 discovery, no retreats.
Pressure: 1,300/93,847 refusals, 13 plots, one warned failed attempt (seed
110456), no retreats, 23 distinct seeds with dispute-relevant commands.

Measured pressure blockers: 28 dangerous commands at fear 60–64, 80 retreat
opportunities, 211 observations where the rivalry window of 8 excludes a pair
of qualifying episodes that 12 retains, three armed deferrals. Raw plot stage
traces retain survival, king distance, guards and actual termination reasons.

## Individual screening protocol (declared before runs)

Use the first 200 ordinary games (100000–100099, paired colors) and first 400
pressure games (110000–110199, paired colors) of the development ranges.
No holdout data has been read. All games start normally; no event RNG overrides.

| Config | Only change from corrected baseline | Measured reason to test |
|---|---|---|
| 2026-09-09.2 | Retreat fear eligibility 65 → 60 | 28 dangerous orders in that interval |
| 2026-09-09.3 | Rivalry episode window 8 → 12 own turns | 211 window-blocked observations |
| 2026-09-09.4 | Prefer already-qualified, streak-qualified leaders within two squares of king | Plot traces show distant leaders |
| 2026-09-09.5 | Armed deferrals 2 → 4 | Three actual deferrals; distance termination exists |

Refusal, retreat (1%), heroism, plot creation and assassination odds are fixed.
Leader selection never moves a piece. Captures, separation, guards, recovery,
all warnings and response opportunities remain intact. Individual results must
be inspected before combinations. If bounded candidates fail, ship verified
fixes at `.1` and record deeper progression as unresolved.

## Individual results and bounded combination decision

All four individual screens completed without invariant failures. Every ordinary
screen produced 207/19,318 refusals and 108/191 discovery among games reaching
40 plies. Each pressure screen had zero retreats and zero attempts. `.2` raised
retreat opportunities from 22 to 31. `.3` increased dispute seeds from 17 to 19
and seeds with relevant orders from 8 to 9. `.4` and `.5` did not change gameplay
outcomes in the fixed screen: all three plots ended through capture, including
the one that reached armed. This subset does not estimate the tail reliably.

After inspecting all individual results, screen two combinations on **the same**
subsets: `.6` combines retreat 60, nearby qualified leader preference and four
deferrals; `.7` adds the 12-turn rivalry window to `.6`. These are the final
bounded combinations for this pass. No further threshold or probability search
will follow failures. A fully passing combination would require full development
comparison before freezing; otherwise the approved fallback is corrected `.1`.

## Combination outcome and selection

`.6` and `.7` both completed all 600 screening games without engine invariant
failures. Both had zero retreats and attempts. `.7` retained the additional
dispute/relevant-order seed from the longer window; it did not pass the natural
progression gates. Select **2026-09-09.1**, with no balance change, under the
approved fallback. This does not claim that deeper progression is solved or
that the screen can rule out rare improvements in larger populations.

## Measurement correction before holdout

The separate board-only mistreatment cohort found a **harness false positive**:
seed 122036 ended in ordinary checkmate at ply 6. Metrics v5 classified every
opening `terminal` resolution as anomalous, despite six guaranteed moves and
zero agency events. Metrics v6 accepts ordinary terminal results while still
rejecting opening regicide, special actions, refusal, retreat or ambient clues.
Keep the original report and its failed counter intact. Repeat the exact
200-game cohort into `board-mistreatment-corrected`, tracing seed 122036. No
engine rule or game outcome changes as part of this correction.
