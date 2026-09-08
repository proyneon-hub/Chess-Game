# Hidden Kingdom implementation and verification

Implemented in the existing repository on `feat/hidden-kingdom`, from baseline `340f779`. The complete supplied `CHESS_HIDDEN_KINGDOM_CODEX_IMPLEMENTATION.md` (2026-09-07) was read before implementation. No applicable AGENTS.md files or pre-existing user changes were found. Node 24.15.0 / npm 11.17.0 were used. After implementation and verification, the user authorized committing and pushing the feature branch, then merging into `main` for production deployment and updating the README. The release procedure is documented in the README; the measurements below describe local verification.

## Phase checklist

- [x] **0 — Baseline:** inspect current source, instructions, historical plans and shim; establish branch/checklist; baseline lint, TypeScript and production build pass; capture two failing regression fixtures before their fixes.
- [x] **1 — Foundation:** attack maps, king-capture protection, castling, en passant, four promotions, draw semantics, versioned types, deterministic RNG, independent counters/results, public allowlist. Initial gate: 15 tests, including perft 20/400/8902.
- [x] **2 — Government:** paired personalities, bounded memories and relationships, fear/fatigue recovery, rescue/protection, promotion envy, tyranny, legitimacy and disputes. Causal gate: 20 tests.
- [x] **3 — Agency/UI:** opening grace, one refusal per turn, repeat/restraint, safe retreats, bounded heroism, full local undo, promotion controls, accessible status/history, keyboard squares, Black orientation, lifecycle cancellation. Engine gate: 26 tests; browser flows subsequently verified.
- [x] **4 — Court:** eligibility streaks, three committed warnings and response turns, counterplay, bounded check deferral, failure without casualties, regicide with king retained, ordinary-terminal precedence. Scheduler gate: 31 tests; full command-sequence scenario added later.
- [x] **5 — Online/AI:** strict request schemas, same-origin routes, CAS receipts, serialized/versioned/aborted polling, legacy adapter, runtime saved-state validation, own-side political projection, iterative worker search. Real MongoDB concurrency and separate-browser invite tests pass.
- [x] **6 — Delivery:** final 1,000-game measurement exported with policy/side/personality/phase counts; rare paths verified in stress fixtures; desktop/mobile screenshots inspected; documentation reconciled; lint, types, formatting, 62 unit/integration tests, 9 production-browser tests and production build pass.

Integration-dependent API/UI work was completed in its dependency phases rather than forcing all application checks to remain green between intermediate module changes. The final app shares one transition engine across local, computer and online play.

## Changed files and responsibilities

| Files                                                                                                                                 | Change                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `lib/chess.ts`, `lib/chessRules.ts`                                                                                                   | Correct attack maps, special-move rights, promotion, king safety, repetition keys, material/draw rules and perft             |
| `lib/game.ts`, `lib/game/{types,publicState,validation,migrate,undo}.ts`                                                              | Authoritative reducer; structured outcomes; nested DTO allowlist; runtime contracts; legacy routing; complete turn snapshots |
| `lib/rpg/{config,rng,initialize,context,subjects,relationships,leadership,agency,conspiracy,events}.ts`                               | Versioned political simulation, causal facts, bounded state, deterministic agency and staged court events                    |
| `lib/rpgChess.ts`                                                                                                                     | Legacy compatibility, injected future RNG, protected kings and corrected promotion stats                                     |
| `lib/ai.ts`, `lib/ai/{search,politicalEvaluation,worker}.ts`                                                                          | Retained material/PST evaluation, ordered iterative alpha-beta search, time/node budgets, bounded own-politics shortlist     |
| `lib/serverMatches.ts`, `lib/serverHttp.ts`, `lib/session.ts`, `models/GameMatch.ts`, `app/api/matches/**`                            | Atomic authority/receipts, validation, origin/body limits, generic errors, schema metadata and signed-cookie hardening       |
| `components/ChessBoard.tsx`, `components/chess/{Board,Promotion,GameHistory}.tsx`, `hooks/use{LocalGame,OnlineMatch,ComputerTurn}.ts` | Ordinary chess UI composition, promotion, persistent warnings/history, undo, polling and worker lifecycle                    |
| `app/globals.css`, `chess-nextjs/app/page.tsx`                                                                                        | Reduced-motion treatment, movement annotations; retained shim with unsupported online control disabled                       |
| `tests/unit/*`, `tests/integration/online.test.ts`, `tests/e2e/*`, `tests/{fixtures,scenarios}.ts`                                    | Deterministic mechanics, runtime/migration/receipt tests, real MongoDB and production-browser flows                          |
| `scripts/{simulate-balance,measure-ai,e2e-server}.ts`, `vitest.config.ts`, `playwright.config.ts`                                     | Reproducible measurements and isolated browser/database tooling                                                              |
| `package*.json`, `tsconfig.json`, `.gitignore`, `.prettierignore`, `.env.example`                                                     | Test dependencies/scripts, Node tooling requirement, modern compilation target, ignored test artifacts and setup notes       |
| `README.md`, historical documents, `docs/hidden-kingdom-*.md`, `docs/balance/*`                                                       | Current setup/rules, supersession notices, checklist, decisions, measured results and limitations                            |

`app/page.tsx`, `lib/db.ts`, and the deployment configuration retain their existing responsibilities. No secrets were read into reports or committed.

## Verification evidence

| Command / check                   | Result                                                                                                                                                                |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                    | Pass, no warnings/errors                                                                                                                                              |
| `npm run typecheck`               | Pass                                                                                                                                                                  |
| `npm run format:check`            | Pass                                                                                                                                                                  |
| `npm test`                        | **62 passing tests** across 11 files, including real isolated MongoDB                                                                                                 |
| `npm run build`                   | Pass, production page and all three API route families built; worker bundled                                                                                          |
| `npm run test:e2e`                | **9 passing Chromium tests** against the final production build + isolated MongoDB; pre-commit rerun 25.2 seconds                                                            |
| `npm run simulate`                | **1,000 games / 500 swapped-color pairs**, 240-ply cap; repeated for original and tuned configurations; final export includes policy/side/personality/phase breakdown |
| `npm run measure:ai`              | Six positions per difficulty; Normal mean 228 ms / p95 264 ms, Advanced mean 1,010 ms / p95 1,020 ms                                                                  |
| Browser worker observation        | Full search ran in worker; measured sample completed depth 3 in ~1,003 ms; zero observed main-thread long tasks                                                       |
| `git diff --check`                | Pass                                                                                                                                                                  |
| Network-backed `npm audit --json` | **9 high findings remain** in the retained dependency ecosystem; no framework migration attempted                                                                     |

The original baseline lint/type/build passed before changes. Windows sandbox restrictions blocked some worker spawning; approved reruns completed. An early browser warning fixture used a newer configuration than the already-built server and was correctly rejected; rebuilding the matching configuration resolved that test failure.

The authoritative final measurement is `docs/balance/seeded-games.json`, configuration `2026-09-07.3`; it includes 1,000 results and approximately 244 seconds of measured harness execution (exact elapsed time is in the JSON).

## Acceptance coverage map

| Contract                                                                                                                           | Evidence                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Ordinary chess, attacks, pinned pieces, adjacent kings, king capture, special rights, promotions                                   | `chess.test.ts`, `baseline.test.ts`, `contracts.test.ts`                            |
| Mate/stalemate/dead material; repetition and move-count draws; terminal immutability                                               | `chess.test.ts`, `contracts.test.ts`, `conspiracy.test.ts`                          |
| First eight plies, refusal budget, repeat normalization, restraint, forced execution, undo/replay, retreat and extension safety    | `agency.test.ts`, `contracts.test.ts`, browser opening/undo                         |
| Protection/coercion causality, envy eligibility, dispute caps/reconciliation, memory bounds                                        | `leadership.test.ts`, `scenarios.test.ts`, `config.test.ts`                         |
| Every plot prerequisite, streaks/stages, warnings, response turns, guards/capture/separation, check deferral, success/failure      | `conspiracy.test.ts`, full late-game command sequence in `scenarios.test.ts`        |
| Baseline/regicide/promotion regressions; tyrant can win; equal treatment                                                           | `baseline.test.ts`, `leadership.test.ts`, `scenarios.test.ts`                       |
| Request shape, coordinates, UUID/version, authorization, schema compatibility, changed payload, concurrency losers and 64 receipts | `online.test.ts` against MongoDB                                                    |
| Nested public privacy, duplicate/error handling, production debug suppression, signed guests                                       | `online.test.ts`, `session.test.ts`, browser API/privacy tests                      |
| Restart during AI, worker completion, dropped response retry, double-click, leave during poll, warning reconnect, older revisions  | `ai.test.ts`, `contracts.test.ts`, `game.spec.ts`, `recovery.spec.ts`               |
| Keyboard squares/promotion, status, Black orientation, 320px layout, reduced motion                                                | Production browser suite and inspected desktop/mobile screenshots                   |
| Bounded values, identities/current kinds, kings present, legal completion and hidden-state privacy                                 | Seeded randomized unit sequences and every accepted state in the 1,000-game harness |

The eight requested authored scenarios are represented by the opening/rescue, tyrant's victory, frightened bishop retreat, rival protection, guard counterplay, full regicide sequence, equal-treatment and online-refusal-retry fixtures. Rare conditions use injected draws or valid constructed states; no production debug endpoint or forced-event environment flag exists.

## Tuning and limitations

See [rule decisions](hidden-kingdom-rules.md) for exact numerical changes and the dispute-causality extension. Configurations `.1`, `.2`, and `.3` remain pinned and readable. The legacy prototype did not persist past random draws or castling/en-passant rights; the adapter preserves historical state and supplies deterministic future legacy resolution without inventing missing history.

The tuned ordinary harness observed **39 refusals / 96,063 eligible commands (0.041%)**, 23 repeats, 16 alternative orders, one extension, and zero opening anomalies, invalid states, stalls or errors. It did not produce plot-eligible kingdoms or safe retreats. Those rare paths are demonstrated by causal stress fixtures, not claimed as measured ordinary-play frequencies. Truncated games are recorded separately. Color outcomes and uncertainty are reported without a fairness claim.

AI depth is a target, not a guarantee: the Node measurement completed depths 1–2 at Normal and 2 at Advanced within its budgets; the optimized browser sample completed depth 3. It always retained a legal completed iteration or fallback and never searched the full tree on the main thread.

The full browser suite covers Chromium, keyboard controls and a narrow viewport; it is not exhaustive device or assistive-technology certification. Automated unit/integration and full browser suites use isolated MongoDB processes and leave production data untouched. The preserved Next.js 14/eslint dependency stack has nine network-audited high findings; addressing those requires separate dependency/framework review. Local hidden state is inspectable by its browser owner, while online hidden state is server-private.

## Production follow-up

After the user authorized merging, deployment and public play, Vercel confirmed Production deployment of `0e73af7`. On 2026-09-07, authenticated inspection identified `https://test-chess-game-roy-kappa-five.vercel.app` as the configured public production domain. It serves the game anonymously; generated deployment/team aliases require Vercel sign-in. No protection settings were changed.

Live Chromium smoke checks passed for HTTP 200, production debug suppression, local movement and undo, computer completion, an online invite with two separate signed guest sessions, Black orientation, moves synchronized in both directions, reconnect, public DTO privacy and Leave. Both checks recorded zero page errors. This bounded production test created one new match and did not modify existing matches; it supplements the isolated suites rather than replacing their broader coverage.
