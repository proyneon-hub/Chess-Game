# Readable political agency: actual results

**Status:** RPG-01, RPG-03 and RPG-04 implemented and verified. RPG-02 remains unresolved. New games use schema 4 / hidden-kingdom-v4 / 2026-09-09.1. No balance candidate passed the declared natural progression screen, so the corrected baseline remains selected. No commit, push, merge or deployment was performed.

## Verification

- 176 unit/integration tests passed in 23 files, including isolated MongoDB concurrency and nested privacy. No tests skipped.
- 13 tests passed against the final local production build, including local undo, AI completion/recovery/cancellation, online retries and v3/v4 warning reconnects.
- Lint, type checking, formatting and production build passed. The captured worker measurement has no main-thread long tasks.
- All 48 pre-change v3 full-result replay cases, the legacy/v2 goldens, and the unforced normal-start v4 replay passed.
- Report verification: 150 checks passed; five progression checks remain failed. One historical opening-classifier failure is retained as a superseded measurement, with an exact corrected rerun. The verifier deliberately exits nonzero.
- Human playtesting is pending. Automation and selected replays are not human results.

See [complete verification](verification-release.json), [acceptance checks](acceptance.json), [frozen rules/source hashes](freeze.json), and [implementation decisions](implementation.md).

## Main paired cohorts

| Cohort | Games | Refusals / eligible | Discovery among games reaching 40 | Retreats | Dispute seeds | Plots | Attempts | Regicides | Resolver p95 ms | Truncated |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| [review-ordinary](review-ordinary/raw.json) | 100 | 106/9402 | 61/97 | 0 | 0 | 0 | 0 | 0 | 1.531 | 17 |
| [review-pressure](review-pressure/raw.json) | 100 | 93/9135 | 57/98 | 0 | 0 | 3 | 0 | 0 | 1.578 | 22 |
| [v3-development-ordinary](v3-development-ordinary/raw.json) | 1000 | 960/91009 | 533/958 | 0 | 1 | 0 | 0 | 0 | 1.582 | 139 |
| [v3-development-pressure](v3-development-pressure/raw.json) | 1000 | 1300/93847 | 691/973 | 0 | 47 | 13 | 1 | 0 | 1.548 | 257 |
| [v4-development-ordinary](v4-development-ordinary/raw.json) | 1000 | 960/91009 | 533/958 | 0 | 1 | 0 | 0 | 0 | 1.830 | 139 |
| [v4-development-pressure](v4-development-pressure/raw.json) | 1000 | 1300/93847 | 691/973 | 0 | 47 | 13 | 1 | 0 | 1.820 | 257 |
| [holdout-ordinary](holdout-ordinary/raw.json) | 1000 | 969/93126 | 555/967 | 0 | 0 | 3 | 1 | 0 | 2.700 | 149 |
| [holdout-pressure](holdout-pressure/raw.json) | 1000 | 1215/91787 | 649/970 | 0 | 25 | 1 | 1 | 0 | 2.697 | 224 |

The review cohorts exactly reproduced the reported gameplay counts (ordinary seeds 92000-92049; pressure 91000-91049). Development used paired seeds 100000-100499 and 110000-110499. The configuration and source hashes were frozen before independent holdouts 200000-200499 and 210000-210499. No tuning followed holdout inspection. The ordinary policy mix is the existing mixed harness; pressure reads its own hidden politics. Neither uses forced gameplay rolls.

Discovery in this table means an event at any point among games reaching ply 40; it does **not** mean discovery by ply 40. Ordinary holdout discovery by ply 40 was 179/1000; pressure was 338/1000. Raw reports retain checkpoints and ended-before-discovery counts. The 240-ply cap is truncation, not a chess draw.

## Remaining gates

| Cohort | Retreat opportunity -> retreat | Seeds with dispute-relevant orders | Eligible court turns -> plots -> warning 2 -> warning 3 -> attempts | Unresolved |
|---|---|---:|---|---|
| v4-development-pressure | 80 -> 0 | 23 | 519 -> 13 -> 8 -> 5 -> 1 | Retreat and attempt in more than one seed |
| holdout-pressure | 51 -> 0 | 13 | 450 -> 1 -> 1 -> 1 -> 1 | Retreat and attempt in more than one seed; plots in more than one seed |

Both pressure attempts failed; no successful regicide minimum is required. Development attempt seed 110456 and holdout attempt seed 210397 are separate natural observations, but pooling them would bypass the declared independent-cohort gates. Ordinary holdout seed 200131 also naturally reached a warned failed attempt; it does not substitute for the pressure gate.

## Bounded candidate screening

Each candidate used the same first 200 ordinary and 400 pressure development games. Ordinary results were identical: 207/19,318 refusals, 108/191 discovery, no retreats or plots. All screens had zero invariant failures. These repeated development seeds are not independent extra trials.

| Config | Change | Pressure retreat opportunities | Retreats | Dispute seeds | Relevant-order seeds | Plots | Attempts |
|---|---|---:|---:|---:|---:|---:|---:|
| [2026-09-09.2](screen-2026-09-09.2-pressure/raw.json) | Fear 60 | 31 | 0 | 17 | 8 | 3 | 0 |
| [2026-09-09.3](screen-2026-09-09.3-pressure/raw.json) | Rivalry window 12 | 22 | 0 | 19 | 9 | 3 | 0 |
| [2026-09-09.4](screen-2026-09-09.4-pressure/raw.json) | Prefer qualified nearby leader | 22 | 0 | 17 | 8 | 3 | 0 |
| [2026-09-09.5](screen-2026-09-09.5-pressure/raw.json) | Four deferrals | 22 | 0 | 17 | 8 | 3 | 0 |
| [2026-09-09.6](screen-2026-09-09.6-pressure/raw.json) | Fear + nearby leader + deferrals | 31 | 0 | 17 | 8 | 3 | 0 |
| [2026-09-09.7](screen-2026-09-09.7-pressure/raw.json) | All four | 31 | 0 | 19 | 9 | 3 | 0 |

The lower fear threshold added opportunities and the longer rivalry window added two dispute seeds, but no screened candidate or combination reached a retreat or attempt. All three screened plots ended through capture. No refusal, retreat-interval, heroism, plot or assassination probability increased. See the [tuning ledger](tuning-ledger.md) for the predeclared sequence and selection.

## Separate board-only scenarios

| Policy | Games | Refusals / eligible | Discovery among games reaching 40 | Court-eligible games | Retreats / plots / attempts |
|---|---:|---:|---:|---:|---|
| [board-ordinary](board-2026-09-09.1-board-ordinary/raw.json) | 200 | 66/13872 | 52/192 | 0 | 0 / 0 / 0 |
| [board-protective](board-2026-09-09.1-board-protective/raw.json) | 200 | 38/12062 | 42/173 | 0 | 0 / 0 / 0 |
| [board-mistreatment](board-mistreatment-corrected/raw.json) | 200 | 66/11857 | 59/180 | 0 | 0 / 0 / 0 |

These policies cannot read hidden attributes and have no protected victims. None reached deeper progression. Board-only ordinary refusal was about 0.48%, below the reference 0.5% lower target; protective discovery was 42/173 (24.3%), also below the reference 25% lower target. They are separate diagnostic policies, not a passing substitute for the established ordinary cohort.

Metrics v5 mistakenly flagged the six-ply ordinary checkmate at seed 122036 as an opening agency anomaly. Metrics v6 corrects that classifier; the exact 200-game rerun preserved every outcome and counter while removing the false anomaly. The original failed report remains unchanged. See [correction evidence](measurement-correction.json).

## Evidence limits and delivery

The archive contains 10,604 game executions, including repeated seeds, baseline comparisons, candidate screens and exploratory replays; this is not that many independent samples. All current cohorts have zero measured state, turn, privacy, terminal or retry invariant failures. Timing varies with the host. Constructed rare-event tests remain separate from natural-frequency evidence.

The corrected baseline ships as uncommitted work on `feat/readable-political-agency`. Existing saved rules are preserved, including historical attribution/text behavior. Public DTOs and online requests retain their shape; the UI has no RPG selector or hidden statistics. Human playtesting and deployment were not performed. See [changed files](changed-files.md), [phase checklist](../readable-politics-checklist.md), and [replay / human protocol](replay-and-playtest.md).
