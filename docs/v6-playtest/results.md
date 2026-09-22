# Playtest tuning: `2026-09-22.1`

A playtest found the hidden politics almost invisible in real games against the
computer: about one hesitation every six games, with no withdrawals, complaints,
warnings or plots. `2026-09-22.1` is the new default for new games. It is still
generation 5 (`hidden-kingdom-v5`), and saved `2026-09-10.1` games keep their rules.

## What changed

| Setting | `2026-09-10.1` | `2026-09-22.1` | Why |
|---|---|---|---|
| `agencyBase` | 0.005 | 0.035 | Baseline hesitation was negligible |
| `progression.calmCap` | 0.006 | 0.03 | Most orders are calm, and the cap held them under 0.6% |
| `progression.fearWeight` | 0.1 | 0.35 | Hesitation should follow danger and mistreatment… |
| `progression.resentmentWeight` | 0.09 | 0.3 | …so harsh play hesitates more than careful play |
| `progression.harmWeight` | 0.025 | 0.1 | Repeated harm should show |
| `encounters.aiAccommodation` | 75 | 25 | The computer played weakening moves (a7–a6–a5, b7–b5) to satisfy its own requests |

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

| Style | Config | W/D/L | Median plies | Hesitations W / B | Games with a hesitation | Requests W / B |
|---|---|---|---|---|---|---|
| aware | 09-10.1 | 0/0/200 | 48 | 0.13 / 0.05 | 16% | 2.56 / 3.65 |
| aware | **09-22.1** | 0/0/200 | 50 | **0.67 / 0.49** | **69%** | 2.52 / 3.77 |
| engine | 09-10.1 | 18/163/19 | 64 | 0.10 / 0.09 | 15% | 4.58 / 5.41 |
| engine | **09-22.1** | 29/151/20 | 64 | **1.02 / 1.09** | **81%** | 5.43 / 6.21 |
| reckless | 09-10.1 | 0/0/200 | 50 | 0.14 / 0.06 | 19% | 1.88 / 4.10 |
| reckless | **09-22.1** | 0/0/200 | 48 | **0.76 / 0.49** | **71%** | 1.85 / 4.06 |

### Against Easy

| Style | Config | W/D/L | Median plies | Hesitations W / B | Games with a hesitation |
|---|---|---|---|---|---|
| aware | 09-10.1 | 20/129/51 | 120 | 0.20 / 0.13 | 26% |
| aware | **09-22.1** | 20/134/46 | 120 | **1.41 / 0.93** | **89%** |
| engine | 09-10.1 | 200/0/0 | 43 | 0.04 / 0.10 | 12% |
| engine | **09-22.1** | 200/0/0 | 51 | **0.67 / 0.40** | **59%** |
| reckless | 09-10.1 | 0/4/196 | 64 | 0.23 / 0.10 | 29% |
| reckless | **09-22.1** | 0/8/192 | 64 | **0.89 / 0.94** | **78%** |

The engine style's many draws against Normal are fivefold repetitions between
two identical searches. That's a known AI issue, tracked separately.

## Against the plan's targets

| Target | Result |
|---|---|
| Careful play: 1–2 hesitations per game | **Met.** 1.2–2.3 in total (0.7–1.4 for the player's own pieces) |
| At least 60% of careful games see a hesitation | **Met,** except the engine style against Easy (59%), whose games are short wins |
| Harsh play hesitates more than careful | **Met for the player's pieces against Normal** (0.76 vs 0.67). Well short of the plan's 3–5 per game: reckless games against Normal are short (48 plies) |
| Warned withdrawals in at least 20% of reckless games | **Not met: 0.** Withdrawals need a warned "strain" request, which needs a piece to stay threatened for two turns with fear ≥ 40. Against a computer that takes hanging pieces, that barely happens (maximum fear observed: 35). No config value fixes this. |
| Complaints and warnings reachable in harsh games | **Not met: 0.** A complaint needs the same pair of pieces harmed together twice. Reckless play harms a different piece each time (median 8 harms on 8 different pieces), and related pairs are rare. |

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
