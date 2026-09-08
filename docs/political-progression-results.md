# Political progression results

Selected configuration: **2026-09-08.6**, frozen before independent seed ranges 70000?70499 (ordinary) and 80000?80249 (pressure). See [freeze record](progression/freeze-6.json), [all candidate measurements](progression/measurement-index.md), [configuration values](progression/configurations.json), and [calibration history, including failures](political-progression-implementation.md).

## Acceptance evidence

| Measure | Target | Comparison | Independent holdout | Result |
|---|---|---|---|---|
| Overall ordinary refusal | 0.5?2% | 960/94,495 (1.02%) | 887/94,088 (0.94%) | Pass |
| Calm refusal | <=0.8% | 270/70,898 (0.38%) | 258/70,779 (0.36%) | Pass |
| Retreats | <=0.5% | 0/94,495 (0.00%) | 0/94,088 (0.00%) | Pass |
| Regicide | <=1% | 0/1,000 (0.00%) | 0/1,000 (0.00%) | Pass |
| Discovery in games reaching ply 40 | 25?60% | 559/976 (57.27%) | 515/977 (52.71%) | Pass |
| Ordinary resolver p95 | <=5 ms | 1.540 ms | 1.559 ms | Pass |
| Pressure court eligibility | 5?20% | 73/500 (14.60%) | 70/500 (14.00%) | Pass |
| Pressure dispute seeds | >1 | 18 | 19 | Pass |
| Pressure plot seeds | >1 | 2 | 5 | Pass |
| Opening surprises/overt narration | 0 | 0 | 0 | Pass |
| Invalid states, stuck turns, hidden-state leaks, unwarned terminals | 0 | 0 | 0 | Pass |

Ordinary comparison: 1,000 games at seeds 10000?10499. Pressure comparison: 500 games at seeds 30000?30249. Each seed has two color assignments. The ordinary policy mix and pressure opponent remain fixed; all games retain repetition/draw rules and the 240-ply cap. No future-RNG inspection, forced gameplay draw, or subject survival exemption is used in these cohorts.

The independent holdout discovery estimate has a 49.2?56.2% approximate 95% interval; pressure court eligibility has a 11.0?17.2% interval. These are percentile bootstrap intervals from 2,000 resamples of seed pairs (analysis seed 20260908), preserving the two-color clustering. They describe these policies, not human player populations.

The selected comparison and holdouts passed **59/59 report checks**, including causal trace checks for every recorded pressure-holdout plot/dispute and exact equality of 1,000 historical v2 results. [Machine-readable acceptance audit](progression/acceptance.json). Earlier `.4` pressure holdout and `.5` plot-frequency failures remain in the archive. No failed cohort was relabeled or reused as an independent holdout.

## Discoverability and progression

The ordinary holdout discovered action-changing agency in **516/1,000 (51.60%)** of the whole cohort, including early endings and truncations. Among observed discoveries, median first event was ply 56, p90 was ply 124. There were 155 truncations; these are harness limits, not gameplay draws.

| Checkpoint | Discovered by checkpoint / all games | Games reaching checkpoint | Ended earlier without discovery |
|---|---|---:|---:|
| 20 | 66/1000 | 996 | 4 |
| 40 | 167/1000 | 977 | 22 |
| 60 | 282/1000 | 919 | 69 |
| 80 | 371/1000 | 832 | 124 |

The pressure holdout recorded 6070 exposures, 4216 neglect applications, 2038 repeated-risk applications, 573 rescues and 1873 effective protections. Its 1951 ambient clues are counted separately from action changes. Full policy/side/personality/phase breakdowns are in each `breakdown-corrected.json` sidecar; gate-crossing counts, court blocker histograms and original observations remain in the raw report. Metrics v2/v3 double-counted only group attempts (explicit attempt plus engine delta). The derived correction halves that field and reconciles attempts, eligible commands, refusals and AI decisions exactly with aggregate totals. Raw evidence is untouched; metrics v4 fixes future exports. Group attribution uses the commanded subject/side; it does not pretend that every affected witness was the commander.

The five holdout plots occurred at seeds **80117, 80153, 80155, 80172 and 80203**. They produced 10 warning stages: one plot reached three warnings, three reached two, and one reached one. Four were thwarted by participant capture; the fifth game ended by ordinary checkmate. The comparison's two plots reached all three warnings and were thwarted by king distance and separation. There were **zero natural assassination attempts**, so these games provide no empirical assassination-success rate. Guard, recovery, failed attempt and regicide paths are covered by explicitly constructed branch tests.

Natural disputes remained absent in both ordinary 1,000-game cohorts. Pressure play demonstrates their causal reachability; ordinary discovery is predominantly hesitation, with rare heroism. This implementation does not claim frequent ordinary conspiracies or human-tested enjoyment.

## Performance and bounds

The ordinary holdout resolver mean/p95/p99 was 1.170/1.559/2.279 ms. Leadership projection after refusal averaged 30.45 ms, p95 64.61 ms. It chose restraint 460 times and repetition 34 times; pressure-policy repeats are a different category. Restraint tactical cost median/p95 was -120/5 cp. Negative cost means the alternative was tactically better; terminal score sentinels make the mean unsuitable as an ordinary material estimate.

Observed per-subject storage maxima were six episodes, 12 memories and four relationships. Ordinary-holdout final private state p95 was 106,837 bytes; final public response p95 was 53,381 bytes. These are sampled final sizes, not maximum permitted request sizes. Public histories contribute most response growth.

Separate six-position AI measurements: Normal mean/p95 256.0/269.9 ms; Advanced 1015.6/1022.7 ms. Completed depths were 1?2, within the established soft-budget behavior; no claim that every position reaches nominal depth 2/4. [AI measurements](progression/ai-performance.json), [browser worker measurements](progression/browser-ai.json). Independent cohorts and some verification ran concurrently on the reference host recorded in the measurement index.

## Verification commands and results

| Command | Actual result |
|---|---|
| `npm run lint` | Passed, no warnings/errors |
| `npm run typecheck` | Passed; final run after build |
| `npm run format:check` | Passed |
| `npm test` | 104/104 passed, 19 files; real isolated MongoDB integration included |
| `npm run build` | Passed, production root app/API build |
| `npm run test:e2e` | 12/12 passed, 32.0 seconds, final `.6` production build and isolated MongoDB |
| `npm run measure:ai` | Completed; six positions per difficulty, all returned legal candidates |
| `npx tsx scripts/simulate-v2-baseline.ts` | 1,000 games; all per-game results exactly match the archived original after refactor |
| `npx tsx scripts/replay-progression.ts` | Legal normal-start causal replay reached disputes and court eligibility |
| `npx tsx scripts/summarize-progression.ts` | Indexed 20 candidate/development/holdout cohorts plus a two-game exporter check; exported versioned values |
| `npx tsx scripts/verify-progression-reports.ts` | 59/59 checks passed |
| `npx tsx scripts/correct-progression-breakdowns.ts` | Five corrected diagnostic breakdowns; all required count sums reconcile to aggregate totals; metrics v4 confirmed on two exporter-validation games |

Selected measurement commands (each output directory must be new):

```sh
npm run simulate -- --config 2026-09-08.6 --suite ordinary --games 1000 --seed-start 10000 --out docs/progression/candidate-6-comparison
npm run simulate -- --config 2026-09-08.6 --suite pressure --games 500 --seed-start 30000 --out docs/progression/pressure-6
npm run simulate -- --config 2026-09-08.6 --suite holdout --games 1000 --seed-start 70000 --out docs/progression/holdout-6
npm run simulate -- --config 2026-09-08.6 --suite pressure --games 500 --seed-start 80000 --out docs/progression/holdout-pressure-6
```

No integration or browser gate was skipped. Live deployment was intentionally not tested or changed. The local production build and isolated databases do not certify current production configuration. Implementation verification completed on `feat/political-progression` before publication. The subsequent user request authorizes committing and pushing this feature branch. No merge or production deployment is part of that follow-up.

See the [changed-file inventory](progression/changed-files.md) for the complete repository diff grouped by responsibility.
