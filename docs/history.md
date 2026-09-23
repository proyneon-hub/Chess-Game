# Release history and measurements

The measurement documents preserve pre-publication verification snapshots; git history records subsequent publication. Bulky raw output was moved out of the tree; see the [measurements archive](measurements-archive.md) to restore it.

## V5 encounters (current)

Piece requests, protection and relief, disputes, petitions, supportive courts, and complaint-gated conspiracies. Early encounters work in browser tests, but deeper pressure-progression acceptance remains unresolved. The verification reports record the pre-publication snapshot; production deployment of v5 has not been verified.

- [Checklist](v5-encounters-checklist.md), [implementation notes](v5-encounters/implementation.md), [tuning ledger](v5-encounters/tuning-ledger.md)
- [Frozen results](v5-encounters/results.md) and [reviewer notes](v5-encounters/reviewer-notes.md) distinguish passing technical checks from unresolved product acceptance and remaining implementation work.
- [Replay walkthrough](v5-encounters/replay-walkthrough.md), [playtesting](v5-encounters/playtesting.md), [data notes](v5-encounters/DATA.md)

## Readable politics (v4)

Separates player commands from autonomous consequences, preserves action explanations during check and terminal history, and adds sparse causal relationship feedback. Deeper progression remains measurement-gated; human testing is pending. The six bounded candidate configurations remain available for reproducible CLI experiments and are not selectable in the game UI.

- [Implementation checklist](readable-politics-checklist.md), [tuning ledger](readable-politics/tuning-ledger.md), [results](readable-politics/results.md), [natural replay / human playtest protocol](readable-politics/replay-and-playtest.md)

## Political progression (v3)

- [Phase checklist](political-progression-implementation.md), [final results](political-progression-results.md), [progression rules and replay walkthrough](political-progression-rules.md), [measurement index](progression/measurement-index.md)

Raw reports distinguish constructed rare-event tests, cooperative causal replays, natural seeded pressure play, and independent holdouts. The implementation was verified before promotion to main; the reports distinguish local verification from live deployment checks.

## Hidden Kingdom (v2)

- [Implementation checklist and verification report](hidden-kingdom-implementation.md), [balance measurements](hidden-kingdom-balancing.md), [rule decisions](hidden-kingdom-rules.md)

Public access was verified on 2026-09-07 against production commit `0e73af7`: HTTP 200 without Vercel sign-in, ordinary chess controls, local moves and undo, a computer reply, and online invites between two independent guest sessions. That release passed 62 unit/integration tests and 9 production-browser tests, and its 1,000-game simulation had zero invalid states, stalls, errors, or opening anomalies.

## Superseded plans

Early design and review documents in [archive/](archive/) are retained as context. They do not describe the current product.

## Reproducing measurements

`npm run simulate -- --config 2026-09-08.6 --games 1000 --seed-start 90000 --out docs/progression/my-run` writes 1,000 seeded games (500 color-swapped pairs), raw JSON, a summary and a Markdown report. Use `--suite pressure` for the causal pressure policy or `--suite holdout` for the ordinary policy mix. Existing output directories are rejected. The fixed 240-ply harness cap is reported as truncation, not a gameplay draw. Optional `SIM_GAMES` is for shorter diagnostics. Raw output is ignored by git.
