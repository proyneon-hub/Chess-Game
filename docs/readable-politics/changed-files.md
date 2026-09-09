# Changed files

Implementation changes (line-ending-only worktree differences are excluded by Git):

- [README.md](../../README.md)
- [hooks/useComputerTurn.ts](../../hooks/useComputerTurn.ts)
- [lib/ai/leadershipView.ts](../../lib/ai/leadershipView.ts)
- [lib/ai/politicalEvaluation.ts](../../lib/ai/politicalEvaluation.ts)
- [lib/ai/restraint.ts](../../lib/ai/restraint.ts)
- [lib/game.ts](../../lib/game.ts)
- [lib/game/types.ts](../../lib/game/types.ts)
- [lib/game/validateProgression.ts](../../lib/game/validateProgression.ts)
- [lib/game/validation.ts](../../lib/game/validation.ts)
- [lib/rpg/agency.ts](../../lib/rpg/agency.ts)
- [lib/rpg/config.ts](../../lib/rpg/config.ts)
- [lib/rpg/conspiracy.ts](../../lib/rpg/conspiracy.ts)
- [lib/rpg/facts.ts](../../lib/rpg/facts.ts)
- [lib/rpg/initialize.ts](../../lib/rpg/initialize.ts)
- [lib/rpg/leadership.ts](../../lib/rpg/leadership.ts)
- [lib/rpg/leadershipV3.ts](../../lib/rpg/leadershipV3.ts)
- [lib/rpg/pressure.ts](../../lib/rpg/pressure.ts)
- [lib/rpg/relationships.ts](../../lib/rpg/relationships.ts)
- [scripts/simulate-balance.ts](../../scripts/simulate-balance.ts)
- [scripts/verify-progression-reports.ts](../../scripts/verify-progression-reports.ts)
- [tests/e2e/game.spec.ts](../../tests/e2e/game.spec.ts)
- [tests/e2e/recovery.spec.ts](../../tests/e2e/recovery.spec.ts)
- [tests/integration/online.test.ts](../../tests/integration/online.test.ts)
- [tests/progression-fixtures.ts](../../tests/progression-fixtures.ts)
- [tests/unit/pressure-contracts.test.ts](../../tests/unit/pressure-contracts.test.ts)
- [tests/unit/progression-version.test.ts](../../tests/unit/progression-version.test.ts)

Added code and tests:

- [lib/rpg/factsV4.ts](../../lib/rpg/factsV4.ts)
- [lib/rpg/observations.ts](../../lib/rpg/observations.ts)
- [scripts/board-policies.ts](../../scripts/board-policies.ts)
- [scripts/capture-v3-goldens.ts](../../scripts/capture-v3-goldens.ts)
- [scripts/freeze-readable.ts](../../scripts/freeze-readable.ts)
- [scripts/political-diagnostics.ts](../../scripts/political-diagnostics.ts)
- [scripts/screen-readable.ts](../../scripts/screen-readable.ts)
- [scripts/verify-readable-reports.ts](../../scripts/verify-readable-reports.ts)
- [tests/unit/court-v4.test.ts](../../tests/unit/court-v4.test.ts)
- [tests/unit/natural-v4.test.ts](../../tests/unit/natural-v4.test.ts)
- [tests/unit/observations.test.ts](../../tests/unit/observations.test.ts)
- [tests/unit/responsibility.test.ts](../../tests/unit/responsibility.test.ts)

Added evidence and documentation:

- `tests/goldens/pre-v4.json`: 48 immutable pre-change v3 cases.
- `docs/readable-politics-checklist.md`: phase progress and explicit pending human testing.
- `docs/readable-politics/`: raw/summary/report triplets for all cohorts; freeze hashes, candidate ledger, acceptance failures, implementation notes, replay walkthrough, verification and measurement correction.

See `manifest.json` for the complete evidence file inventory and hashes. No commit, push, merge or deployment was performed.
