# Frozen v5 measurement results

These are actual normal-start measurements. A passed test suite does not imply product acceptance. See acceptance.json for every gate and denominator.

| Cohort | Games / independent paired seeds | Discovery 16 | Mechanical resolution 24 | Offers 40 / 64 | Three families 64 | Conflict 64 | Retreat / attempt seeds | Truncated |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| freeze7-development-aware | 1000 / 500 | 99.80% | 97.29% | 5 / 8 | 89.64% | 0.11% | 0 / 0 | 45 |
| freeze7-development-pressure | 500 / 250 | 100.00% | 37.08% | 5 / 8 | 99.25% | 0.50% | 0 / 0 | 17 |
| freeze7-holdout-aware | 1000 / 500 | 100.00% | 95.79% | 5 / 8 | 90.76% | 0.11% | 0 / 0 | 42 |
| freeze7-holdout-pressure | 500 / 250 | 99.79% | 31.65% | 5 / 8 | 97.91% | 1.04% | 0 / 0 | 20 |
| freeze7-board-ordinary | 200 / 100 | 100.00% | 49.49% | 5 / 8 | 92.06% | 0.00% | 0 / 0 | 33 |
| freeze7-board-protective | 200 / 100 | 100.00% | 66.67% | 5 / 9 | 98.11% | 0.00% | 0 / 0 | 41 |
| freeze7-board-mistreatment | 200 / 100 | 100.00% | 20.00% | 5 / 8 | 92.89% | 15.23% | 12 / 0 | 87 |

Resolution-at-24 acceptance applies to the aware policy. Checkpoint percentages use games reaching that checkpoint; acceptance.json also records all-game denominators and games ending earlier. Each color-swapped pair is one independent seed. Truncation at 240 plies is not a gameplay draw.

Raw inter-start gaps include checks and cooldowns; eligible-only pacing remains a separate measurement limitation. Source hashes match freeze 7. Holdouts were not used to retune the candidate.

## Unmet measured gates

- freeze7-development-pressure: raw gap median = 7; required 4–6.
- freeze7-development-pressure: conflict by 64 = 0.005025125628140704; required >= 0.50.
- freeze7-development-pressure: distinct warned retreat seeds = 0; required >= 5.
- freeze7-development-pressure: distinct warned attempt seeds = 0; required >= 3.
- freeze7-holdout-pressure: raw gap median = 7; required 4–6.
- freeze7-holdout-pressure: conflict by 64 = 0.010443864229765013; required >= 0.50.
- freeze7-holdout-pressure: dispute relevance = 0; required >= 0.60.
- freeze7-holdout-pressure: distinct warned retreat seeds = 0; required >= 5.
- freeze7-holdout-pressure: distinct warned attempt seeds = 0; required >= 3.
- freeze7-board-ordinary: raw gap p90 = 12; required <= 10.
- freeze7-board-protective: refusal rate = 0.0033224400871459695; required 0.005–0.025.
- freeze7-board-mistreatment: raw gap p90 = 11; required <= 10.
- freeze7-board-mistreatment: refusal rate = 0.025609379821042888; required 0.005–0.025.

Human playtesting is pending. No commit, push, merge, deployment, or production verification was performed for v5.
