# Chess

Chess for local pass-and-play, computer opponents, and private online invites. The interface uses ordinary chess controls. Pieces have persistent, hidden political memories; their behavior follows the same deterministic rules in every mode.

[Play Chess — no sign-in required](https://test-chess-game-roy-kappa-five.vercel.app)

The Hidden Kingdom release adds persistent piece agency, tyranny and fear, rivalries, staged conspiracies, deterministic turn handling, private online state, and computer opponents using the shared rules engine. The board retains ordinary chess controls with no visible RPG selector or hidden statistics.

## Run

Use Node **22.13+ or 24** and npm. The framework remains Next.js 14.2.35 / React 18.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). Local and computer games need no database. For online games, copy `.env.example` to `.env.local`, supply `MONGODB_URI`, and set a long random `CHESS_AUTH_SECRET`. Never commit that file.

## Play

- **Play here:** two players, one board, with Undo for up to 20 completed turns.
- **Play computer:** White against a worker-based opponent. Normal targets depth 2 / 250 ms; Advanced targets depth 4 / 1,000 ms. These are soft search budgets.
- **Play online:** create a private invite. The creator is White; the recipient explicitly selects **Join as Black**. Black sees the board from Black's side. Keep the same browser profile to retain the signed guest identity.
- Select a piece and a legal destination. Tab and arrow keys focus squares; Enter selects. Promotion defaults to queen and offers rook, bishop, and knight.
- After a piece hesitates, **Repeat order** executes that command; a different legal order also completes the turn. **Retry connection** resends the same network request.
- Undo during a pending hesitation restores the start of that turn first. A later Undo reverses the preceding completed turn. New Game resets the seed; Leave cancels online work and clears the invite URL.

Castling, en passant, promotion choice, checkmate, stalemate, insufficient material, threefold/50-move claims, and fivefold/75-move automatic draws are supported. Draw rights deliberately use the visible chess position and ignore politics. This is an intentional chess variant, not a claim of certified tournament compliance.

## Developer rule notes

New games in this working branch use `hidden-kingdom-v3` (selected configuration `2026-09-08.6`). Existing v2 saves retain their original configuration and behavior. The first eight completed plies always execute ordinary legal moves. Later commands may encounter bounded hesitation, a safe retreat, or a rare heroic extension. There is one refusal budget per turn. Kings and check escapes always obey. Obeyed avoidable exposure and continued neglect can damage trust; meaningful rescue and protection can repair it. Subjects remember coercion, losses, promotion, and rivalries. After a refusal the v3 computer weighs a safer alternative against repeating the order. Tyranny can improve immediate compliance while increasing grievances.

A late-game conspiracy needs strict causal prerequisites, two eligible own turns, three persistent warning stages, and three response turns before an attempt. Guards, separation, leadership recovery, or king movement provide counterplay. Regicide retains the king on the board and creates an explicit terminal result. Ordinary chess results take precedence.

The UI has no RPG selector, hidden statistics, or diagnostics panel. `?debug=1` does not reveal them. Local/computer concealment is experiential: browser source and memory can be inspected. Online RNG, subjects, political values, and internal plot objects remain server-private behind a nested public allowlist.

## Online persistence

MongoDB stores the complete match in one document. Every submitted intent has a UUID and expected match version. A compare-and-swap commit writes the board, politics, RNG, events, revision, and receipt together. Rejections do not advance RNG. Concurrent losers reload and check receipts; they never reroll automatically.

The latest 64 `(player, actionId)` receipts are retained. An identical retry returns a duplicate acknowledgement and current public state. Reusing an id with changed payload returns 409. After a receipt ages out, its old expected revision still blocks replay; reusing that aged id with a new revision is a new intent. Polls are serialized and gated by match identity and revision; leaving aborts in-flight work.

Unversioned matches use an idempotent legacy adapter. Their D20 behavior continues with king-safety, promotion, bounded-refusal, and deterministic future-RNG fixes; they do not gain new subjects or conspiracies. The original prototype did not save its `Math.random` history, so past draws cannot be reconstructed. Unknown future schemas/configurations return a controlled incompatibility response without rewriting the match.

## Verify

```sh
npm run lint
npm run typecheck
npm run format:check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run simulate
```

`npm test` includes behavioral fixtures and real MongoDB concurrency tests using an isolated `mongodb-memory-server` process. `npm run test:e2e` starts the **production build** on port 3100 with another isolated MongoDB database. It verifies separate browser sessions, transport retry, persistent warnings, promotion, keyboard controls, mobile layout, and lifecycle cancellation. Neither suite uses the database in `.env.local`. Initial runs download test browser/MongoDB binaries and need network access. On restricted Windows hosts, child-process creation may need sandbox approval.

`npm run simulate -- --config 2026-09-08.6 --games 1000 --seed-start 90000 --out docs/progression/my-run` writes 1,000 seeded games (500 color-swapped pairs), raw JSON, a summary and a Markdown report. Use `--suite pressure` for the causal pressure policy or `--suite holdout` for the ordinary policy mix. Existing output directories are rejected. The fixed 240-ply harness cap is reported as truncation, not a gameplay draw. Optional `SIM_GAMES` is for shorter diagnostics. The tests follow the [Vitest guide](https://vitest.dev/guide/) and [Playwright web-server workflow](https://playwright.dev/docs/test-webserver).

The current, undeployed progression work is documented in the [phase checklist](docs/political-progression-implementation.md), [final results](docs/political-progression-results.md), [progression rules and replay walkthrough](docs/political-progression-rules.md), and [measurement index](docs/progression/measurement-index.md). Raw reports distinguish constructed rare-event tests, cooperative causal replays, natural seeded pressure play, and independent holdouts. No merge or deployment was performed for this work.

Read the historical [implementation checklist and verification report](docs/hidden-kingdom-implementation.md), [balance measurements](docs/hidden-kingdom-balancing.md), and [rule decisions](docs/hidden-kingdom-rules.md). Historical design plans are retained as context and superseded by these documents.

## Layout and deployment compatibility

| Path                                | Responsibility                                                      |
| ----------------------------------- | ------------------------------------------------------------------- |
| `app/`                              | Canonical Next.js page and online API routes                        |
| `components/chess/`, `hooks/`       | Board, promotion, history, local undo, online polling, AI lifecycle |
| `lib/chess.ts`, `lib/chessRules.ts` | Ordinary movement, attack maps, special rights and draws            |
| `lib/game.ts`, `lib/game/`          | Shared reducer, versioned types, validation, public DTO, migration  |
| `lib/rpg/`                          | Seeded subjects, leadership, relationships, agency, court scheduler |
| `lib/rpgChess.ts`                   | Legacy-only D20 compatibility resolver                              |
| `lib/ai/`                           | Iterative worker search and own-side political evaluation           |
| `lib/serverMatches.ts`, `models/`   | MongoDB authority, versions and receipts                            |
| `tests/`, `scripts/`                | Behavioral, database and browser tests; reproducible measurements   |

The repository root is the supported full application/deployment root. `chess-nextjs/` is retained for compatibility with historical URLs/build configuration; it imports the root UI but has no online route tree, so it offers local/computer play only. It is not a supported full online deployment.

## Previously deployed release

Vercel builds the connected GitHub repository. Pushes to `main` trigger Production deployments; feature branches receive preview deployments. Play at the public production domain, [test-chess-game-roy-kappa-five.vercel.app](https://test-chess-game-roy-kappa-five.vercel.app), or manage the project in its [Vercel dashboard](https://vercel.com/pramits-projects-ce654619/chess-game). The project uses the repository root and Node 24; `vercel.json` explicitly selects the Next.js framework.

Public access was verified on 2026-09-07 against production commit `0e73af7`: HTTP 200 without Vercel sign-in, ordinary chess controls, local moves and undo, a computer reply, and online invites between two independent guest sessions. Online checks covered Black orientation, synchronized moves in both directions, reconnect, hidden-state privacy, and Leave. Both smoke checks reported zero browser page errors. Online verification created one new test match and did not modify existing matches.

Vercel's generated deployment/team URLs remain sign-in protected; share the public production domain above. The historical `chess-game-six-zeta.vercel.app` address returns `DEPLOYMENT_NOT_FOUND`. No deployment-protection change was needed once the configured public domain was identified.

Configure `MONGODB_URI` and a stable, long random `CHESS_AUTH_SECRET` in Vercel's Production environment for private online games. Keep the signing secret stable across releases so existing guest sessions retain access. Existing unversioned matches continue through the legacy adapter; new matches use Hidden Kingdom rules. No destructive database migration is required.

The release passed lint, TypeScript, formatting, the production build, **62 unit/integration tests**, and **9 production-browser tests**. The recorded 1,000-game simulation had zero invalid states, stalls, errors, or opening anomalies. See the [verification report](docs/hidden-kingdom-implementation.md) for coverage and numerical tuning. Nine high dependency findings remain documented in the retained Next.js 14/eslint stack.

After a production push, verify the Vercel deployment status for that exact commit before treating the release as live. Local tests use isolated databases; they do not certify the production database configuration.
