# Political progression implementation

Specification: `CHESS_RPG_IMPROVEMENTS_CODEX.md`, read in full (538 lines), 2026-09-08. Baseline `3001374dae79c58bd8acad3a848f16a524f0bbec`. No applicable AGENTS.md or unrelated changes. Work remains local on `feat/political-progression`; no merge, push or deployment authorized for this brief.

## Checklist

- [x] Phase 0: baseline tests, immutable archived measurements, pre-change legacy/v2 goldens.
- [x] Phase 1: version routing, v3 state and strict runtime validation; historical goldens and privacy gate.
- [x] Phase 2: causal consequences, bounded episodes, active attributes and anti-farming tests.
- [x] Phase 3: shared forecast, disputes, court eligibility, natural-state progression.
- [x] Phase 4: AI restraint, feedback, menu reset, lifecycle and online verification.
- [x] Phase 5: candidate/development/pressure/independent holdout measurement; final checks and documentation.

## Evidence ledger

- Baseline `npm test`: 62/62 tests, 11 files, including isolated MongoDB integration, passed.
- Baseline lint and TypeScript: passed.
- Historical committed `.3` data copied unchanged to `docs/progression/baseline-committed/`.
- Baseline reproduction: all 1,000 per-game results match exactly; 234 seconds. Zero invalid states, stalls and errors. Raw archive: `baseline-reproduced/seeded-games.json`.
- Baseline build and nine browser tests passed (25.4 seconds). Isolated MongoDB was available; no integration gates were skipped.
- Fourteen legacy/v2 pre-change golden cases still match complete result hashes, including RNG and scripted draw consumption.
- Phase 3: normal-start seed 20000 with fixed legal commands reaches disputes and stable court eligibility. This is explicitly cooperative/scripted causal reachability, not naturally seeded occurrence. A protective branch from the same history preserves more trust than neglect.
- Initial phase 4 check: 91 unit/integration tests passed, including explicit v2/v3 reconnect, one-time pressure mutation and AI restraint/coercion. Later checks expanded this to 104 tests and 12 browser scenarios, all passing.

## Calibration history (development evidence)

- `.1`: supplied starting model/deltas. 100 ordinary development games: 120/9273 refusals (1.29%), 62/94 games reaching ply 40 discovered agency. Initial pressure policy vs full depth-one search: 0/100 eligible courts, pieces generally captured before grievances accumulated.
- Pressure policy v2 increases material preservation weight from .05 to .5; opponent samples eight seeded legal moves and selects material/PST minus destination exchange risk. It takes favorable sampled captures, without exempting victims. `.1` control: 0/100 eligible courts. This policy change is measured separately from numerical tuning.
- `.2`: base .008 -> .005, calm cap .008 -> .006, resentment probability weight .09 -> .07; exposure resentment 5 -> 8, loyalty -2 -> -4; repeated-risk resentment 3 -> 4, loyalty -1 -> -2; neglect resentment 6 -> 10, loyalty -3 -> -5, tyranny 3 -> 5, legitimacy -2 -> -3. Court tyranny 40 -> 30, leader resentment 60 -> 45, accomplice resentment 50 -> 35; recovery resentment 45 -> 30, tyranny 30 -> 20. All aggregate/attribute bounds retained. Ordinary 100: 107/9293 refusals, discovery 55/94. Pressure policy v2: 1/100 eligible courts; no disputes or plots.
- Pressure policy v3 explicitly cycles dangerous dependence on actual sole defenders; the opponent remains unchanged and noncooperative. `.2`: 0/100 eligible courts. This exposes the remaining joint participant/history bottleneck rather than hiding it with a plot-odds increase.
- `.3`: grave-history window 12 -> 20 own turns; leader resentment 45 -> 35 and loyalty 45 -> 55; accomplice resentment 35 -> 25 and loyalty 50 -> 60; recovery loyalty 55 -> 65, resentment 30 -> 25, legitimacy 60 -> 65. Two distinct causally grave episodes for the leader and one for the accomplice remain mandatory. Pressure development: 8/200 eligible games, plots in two distinct seeds, no disputes despite nine friction events. Lottery remains .02; assassination and heroism odds are unchanged throughout.

## Calibration protocol

Baseline/comparison seeds 10000–10499 (1000 games, swapped colors). Development seeds start 20000; pressure development starts 40000. Required pressure evaluation starts 30000 (500 games). Holdout starts 50000 (1000 games) and remains untouched until the selected configuration is frozen. Configurations are immutable; any subsequent tuning needs a new version and new independent holdout.

Constructed/forced branch fixtures, legal command causal scenarios, seeded adversarial pressure play, isolated online integration and browser verification are separate evidence categories. A missing or failed gate will be recorded as such.

- `.4`: friction -8 -> -20 after the existing two-episode causal gate; leader resentment 35 -> 30. Pressure comparison: 26/500 eligible games (5.2%), disputes in 19 distinct seeds and plots in two. Ordinary comparison: 964/94615 refusals, discovery 560/976 games reaching 40. Frozen in `progression/freeze.json`.
- **Failed extra pressure holdout for `.4`:** fresh seeds 60000?60249 produced eligibility in 23/500 games (4.6%) and no plots across 54 eligible turns. Disputes occurred in 20 seeds. Ordinary holdout seeds 50000?50499 passed: 1008/94157 refusals and discovery 573/971. These results were retained; those seed ranges were not reused as independent holdouts after tuning.
- `.5`: grave window 20 -> 32 own turns, leader loyalty 55 -> 60, resentment 30 -> 25, ambition 60 -> 55; accomplice loyalty 60 -> 65, resentment 25 -> 20; recovery loyalty 65 -> 70 and resentment 25 -> 15. Development eligibility 12/200 and plots in two seeds. Pressure comparison eligibility 37/500 (7.4%), but only one plot seed: **plot-frequency gate failed**. No `.5` holdout was declared.
- `.6`: leader loyalty 60 -> 65, resentment 25 -> 20, ambition 55 -> 50; accomplice loyalty 65 -> 70 and resentment 20 -> 10; recovery loyalty 70 -> 75, resentment 15 -> 8. Longer-lived actual grave histories remain the primary causal gate; two leader histories, one accomplice history, proximity, government adversity and consecutive pair eligibility are unchanged. Development: 31/200 eligible games (15.5%), plots in three seeds. Pressure comparison: 73/500 eligible (14.6%), disputes in 18 seeds, plots in two. Lottery stays .02; no randomness quota, seed reset or participant exemption was introduced.

The original statement of immutable configurations applies to every saved version above. Calibration changed numeric thresholds and history duration explicitly, rather than silently modifying prior versions. The 32-own-turn grave/protection memory horizon and reduced participant thresholds are the largest deviations from the supplied starting values; they avoid letting a few quiet turns erase a history of repeated mistreatment. Six episodes and 12 memories per subject remain hard bounds.

## Verification notes

- Latest unit/integration run: **104/104 passed in 19 files**. MongoDB ran successfully in isolation; none skipped. Added capture-clock/cap, deterministic max-two neglect, episode identity, anti-farming, en passant confidence, shared forecast, undo, historical initialization and current-version natural progression checks.
- Browser suite: **12/12 passed** on the `.5` production build (29.2 seconds), including two sessions reconnecting to v3 refusal/warning history. The final selected-version build and all 12 browser tests subsequently passed (32.0 seconds); see final results.
- The CLI replay reached exposure at ply 9, neglect at 11, protection at 27, friction at 77, court eligibility at 87, rescue at 124 and dispute at 125. This fixed `.1` legal-command scenario is cooperative/scripted evidence, not natural lottery occurrence.
- An initial added fixture accidentally let neighboring pieces defend the intended three neglect targets; another moved a king onto an attacked square. The fixtures were corrected to legal, genuinely threatened positions, and the behavioral tests passed. No runtime rule was loosened to make those tests pass.
- One TypeScript invocation overlapped `next build`, which regenerates `.next/types`; it failed on missing generated files. Running TypeScript sequentially after the successful build passed. Future final checks run sequentially where they share generated files.


## Final completion

Phases 0?5 completed. Selected `.6` passed both full comparisons and fresh ordinary/pressure holdouts. See the [final verification and experience report](political-progression-results.md) and [59-check acceptance audit](progression/acceptance.json). The final historical replay reproduced all 1,000 original v2 per-game results exactly after the refactor. No external-service verification gate was skipped. No deployment, merge, push or commit was performed.

A final evidence audit found metrics v2/v3 counted per-group attempts twice. Aggregate rates and trajectories were correct. Original raw reports remain unchanged; `scripts/correct-progression-breakdowns.ts` writes five reconciled sidecars and metrics v4 fixes future exports. This was a diagnostic correction after freeze, with no rules or policy changes.

## Publication follow-up

After implementation verification, the user explicitly requested a commit and push of `feat/political-progression`. This supersedes the original brief's no-push restriction for this feature branch. No merge or production deployment is authorized by this follow-up.
