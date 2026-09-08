# Measurement index

Reference host: AMD Ryzen 5 5600X 6-Core Processor             ; 12 logical CPUs; 32 GiB RAM; win32/x64; Node v24.15.0. Some independent cohorts ran concurrently. Timings describe this environment.

| Run | Config | First seed | Games | Refusals / eligible commands | Discovery / games reaching 40 | Eligible court / games | Distinct dispute / plot seeds | Resolver p95 ms | Invariant failures |
|---|---|---:|---:|---|---|---|---:|---:|---:|
| [candidate-1-comparison](candidate-1-comparison/summary.json) | 2026-09-08.1 | 10000 | 1000 | 1093/93780 (1.17%) | 610/977 (62.44%) | 0/1000 (0.00%) | 0 / 0 | 1.547 | 0 |
| [candidate-4-comparison](candidate-4-comparison/summary.json) | 2026-09-08.4 | 10000 | 1000 | 964/94615 (1.02%) | 560/976 (57.38%) | 3/1000 (0.30%) | 0 / 1 | 1.545 | 0 |
| [candidate-5-comparison](candidate-5-comparison/summary.json) | 2026-09-08.5 | 10000 | 1000 | 961/94565 (1.02%) | 559/976 (57.27%) | 5/1000 (0.50%) | 0 / 1 | 1.601 | 0 |
| [candidate-6-comparison](candidate-6-comparison/summary.json) | 2026-09-08.6 | 10000 | 1000 | 960/94495 (1.02%) | 559/976 (57.27%) | 20/1000 (2.00%) | 0 / 2 | 1.540 | 0 |
| [development-1-ordinary](development-1-ordinary/summary.json) | 2026-09-08.1 | 20000 | 100 | 120/9273 (1.29%) | 62/94 (65.96%) | 0/100 (0.00%) | 0 / 0 | 1.538 | 0 |
| [development-1-pressure](development-1-pressure/summary.json) | 2026-09-08.1 | 40000 | 100 | 39/3634 (1.07%) | 30/84 (35.71%) | 0/100 (0.00%) | 0 / 0 | 1.378 | 0 |
| [development-1-pressure-policy2](development-1-pressure-policy2/summary.json) | 2026-09-08.1 | 40000 | 100 | 142/9371 (1.52%) | 68/99 (68.69%) | 0/100 (0.00%) | 0 / 0 | 1.537 | 0 |
| [development-2-ordinary](development-2-ordinary/summary.json) | 2026-09-08.2 | 20000 | 100 | 107/9293 (1.15%) | 55/94 (58.51%) | 0/100 (0.00%) | 0 / 0 | 1.846 | 0 |
| [development-2-pressure](development-2-pressure/summary.json) | 2026-09-08.2 | 40000 | 100 | 115/8727 (1.32%) | 61/98 (62.24%) | 1/100 (1.00%) | 0 / 0 | 1.837 | 0 |
| [development-2-pressure-policy3](development-2-pressure-policy3/summary.json) | 2026-09-08.2 | 40000 | 100 | 115/8540 (1.35%) | 61/99 (61.62%) | 0/100 (0.00%) | 0 / 0 | 1.627 | 0 |
| [development-3-pressure](development-3-pressure/summary.json) | 2026-09-08.3 | 40000 | 200 | 277/17860 (1.55%) | 131/194 (67.53%) | 8/200 (4.00%) | 0 / 2 | 1.841 | 0 |
| [development-5-pressure](development-5-pressure/summary.json) | 2026-09-08.5 | 40000 | 200 | 279/17868 (1.56%) | 132/194 (68.04%) | 12/200 (6.00%) | 6 / 2 | 1.537 | 0 |
| [development-6-pressure](development-6-pressure/summary.json) | 2026-09-08.6 | 40000 | 200 | 284/17851 (1.59%) | 132/194 (68.04%) | 31/200 (15.50%) | 6 / 3 | 1.639 | 0 |
| [harness-validation](harness-validation/summary.json) | 2026-09-08.6 | 90000 | 2 | 6/108 (5.56%) | 2/2 (100.00%) | 0/2 (0.00%) | 0 / 0 | 1.626 | 0 |
| [holdout-4](holdout-4/summary.json) | 2026-09-08.4 | 50000 | 1000 | 1008/94157 (1.07%) | 573/971 (59.01%) | 7/1000 (0.70%) | 0 / 0 | 1.527 | 0 |
| [holdout-6](holdout-6/summary.json) | 2026-09-08.6 | 70000 | 1000 | 887/94088 (0.94%) | 515/977 (52.71%) | 17/1000 (1.70%) | 0 / 1 | 1.559 | 0 |
| [holdout-pressure-4](holdout-pressure-4/summary.json) | 2026-09-08.4 | 60000 | 500 | 546/47060 (1.16%) | 322/482 (66.80%) | 23/500 (4.60%) | 20 / 0 | 1.529 | 0 |
| [holdout-pressure-6](holdout-pressure-6/summary.json) | 2026-09-08.6 | 80000 | 500 | 572/44832 (1.28%) | 306/478 (64.02%) | 70/500 (14.00%) | 19 / 5 | 1.781 | 0 |
| [pressure-4](pressure-4/summary.json) | 2026-09-08.4 | 30000 | 500 | 664/46350 (1.43%) | 350/489 (71.57%) | 26/500 (5.20%) | 19 / 2 | 1.638 | 0 |
| [pressure-5](pressure-5/summary.json) | 2026-09-08.5 | 30000 | 500 | 666/46538 (1.43%) | 352/489 (71.98%) | 37/500 (7.40%) | 19 / 1 | 1.514 | 0 |
| [pressure-6](pressure-6/summary.json) | 2026-09-08.6 | 30000 | 500 | 670/46448 (1.44%) | 355/489 (72.60%) | 73/500 (14.60%) | 18 / 2 | 1.556 | 0 |

Each seed has two color-swapped games. Development runs are tuning evidence, not holdouts. See each raw.json for full-cohort discovery, checkpoint censoring, first-event times, extrema, storage bounds and commanded policy/side/personality/phase counts. Counts absent from a counter dictionary are zero; a zero denominator means no opportunity was observed. Metrics v1 gate crossings use the initial candidate's thresholds; v2 and later include explicit selected thresholds and observed calm-command denominators. Metrics v3 also records causal participant snapshots when natural disputes/plots arise. Metrics v2/v3 group attempts were counted twice; use breakdown-corrected.json sidecars for reconciled group attempts and AI choices. Metrics v4 fixes the exporter. These diagnostic changes do not change choices or RNG.

The simulation's duplicateMutations field is a sampled deterministic resolver replay check. Actual HTTP/database receipt and concurrency behavior is verified separately by integration/browser tests. Private/public sizes sample final states; they are not worst-case network packet limits. No simulation is human playtesting.
