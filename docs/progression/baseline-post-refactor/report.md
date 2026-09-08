# Hidden Kingdom balance measurement

Config 2026-09-07.3; 1000 seeded games, 500 color-swapped pairs; 240-ply harness cap. 100 games use depth-one tactical search; other policies sample legal commands with material/protection/promotion preferences. Truncations are not gameplay draws.

| Measurement | Result |
|---|---|
| refusal: numerator / eligible denominator | 39/96063 (0.041%) |
| retreat: numerator / eligible denominator | 0/96063 (0.000%) |
| plots: numerator / eligible denominator | 0/0 (no eligible observations) |
| regicidePerMatch: numerator / eligible denominator | 0/1000 (0.000%) |
| regicidePerAttempt: numerator / eligible denominator | 0/0 (no eligible observations) |
| Repeats / alternatives / extensions | 23 / 16 / 1 |
| Opening anomalies / invalid / stalls / errors | 0 / 0 / 0 / 0 |
| resolverMs: mean / p95 | 1.028 / 1.351 |
| aiDecisionMs: mean / p95 | 4.175 / 15.593 |
| finalStateBytes: mean / p95 | 71185.515 / 100936.000 |
| finalApiBytes: mean / p95 | 31937.225 / 52787.000 |

Terminal distribution: {"truncated":168,"insufficient-material":98,"stalemate":369,"checkmate":257,"fivefold":90,"seventy-five-move":18}. White wins 116, Black wins 141; mean paired color difference -0.0250, approximate 95% interval [-0.0551, 0.0051]. This policy sample does not establish fairness or human chess quality.

Raw counts by personality, side, phase, policy pairing and match: [seeded-games.json](balance/seeded-games.json). Payload samples are final states with full public history. The harness measures depth-one AI; difficulty budgets are measured separately.

Tuning .2 changes only the refusal baseline from .005 to .04 after the original 1000-game run produced zero refusals across 95,932 eligible commands. Original .1 rules and results remain available. Conspiracy probabilities and prerequisites were not raised. Constructed court tests demonstrate staged reachability, failure and counterplay. A zero plot denominator means ordinary policies did not generate eligible kingdoms, not that self-play tested regicide.
Configuration .3 adds a bounded -10 grievance only when a repeated losing order relies solely on an envied defender; this closes the otherwise unreachable -30 dispute threshold. See [rule decisions](hidden-kingdom-rules.md). Breakdown keys are leadership policy / commanded side / commanded personality / phase. Independent [AI timings](balance/ai-performance.json) and [browser worker observations](balance/browser-ai.json) measure difficulty budgets separately.

Reproduce: `npm run simulate` on Node 22.13+ or 24. Optional SIM_GAMES is for shorter diagnostics; delivery uses 1000.
Elapsed 250.6 seconds.
