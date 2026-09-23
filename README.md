# Chess

Chess for local pass-and-play, computer opponents, and private online invites. The interface uses ordinary chess controls. Pieces have persistent, hidden political memories: they may hesitate, make requests, form rivalries and, late in a game, conspire. Their behavior follows the same deterministic rules in every mode.

[Play Chess — no sign-in required](https://test-chess-game-roy-kappa-five.vercel.app)

## Run

Use Node **22.13+ or 24** and npm. The framework is Next.js 16 / React 19.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). Local and computer games need no database. For online games, copy `.env.example` to `.env.local`, supply `MONGODB_URI`, and set a long random `CHESS_AUTH_SECRET`. Never commit that file.

## Play

- **Play here:** two players, one board, with Undo for up to 20 completed turns.
- **Play computer:** White against a worker-based opponent. Normal targets depth 2 / 250 ms; Advanced targets depth 4 / 1,000 ms. These are soft search budgets.
- **Play online:** create a private invite. The creator is White; the recipient explicitly selects **Join as Black**. Black sees the board from Black's side. Keep the same browser profile to retain the signed guest identity; it renews with activity and expires after 30 days without a visit, like inactive matches.
- Select a piece and a legal destination. Tab and arrow keys focus squares; Enter selects. Promotion defaults to queen and offers rook, bishop, and knight.
- After a piece hesitates, **Repeat order** executes that command; a different legal order also completes the turn. **Retry connection** resends the same network request.
- Undo during a pending hesitation restores the start of that turn first. A later Undo reverses the preceding completed turn. New Game resets the seed; Leave cancels online work and clears the invite URL.

## Verify

```sh
npm run lint
npm run typecheck
npm run format:check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm test` includes behavioral fixtures, pinned replay fingerprints, and real MongoDB concurrency tests using an isolated `mongodb-memory-server` process. `npm run test:e2e` starts the **production build** on port 3100 with another isolated MongoDB database. It verifies separate browser sessions, transport retry, persistent warnings, promotion, keyboard controls, mobile layout, lifecycle cancellation, and accessibility (axe). Neither suite uses the database in `.env.local`. Initial runs download test browser/MongoDB binaries and need network access. On restricted Windows hosts, child-process creation may need sandbox approval.

## Documentation

- [Architecture](docs/architecture.md): code layout, rules generations, concealment, and online persistence.
- [Deployment](docs/deployment.md): Vercel, environment variables, secret rotation, rate limiting, and the release check.
- [History and measurements](docs/history.md): what each release added, verification reports, and how to reproduce simulations.
