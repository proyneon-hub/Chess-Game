# Chess

**Battle Chess** for local pass-and-play, computer opponents, and private online invites. Pieces move as in chess, but every piece has HP, attack and defence, every capture is a dice battle, and you win by defeating the enemy king. The same rules run in every mode.

[Play Chess — no sign-in required](https://test-chess-game-roy-kappa-five.vercel.app)

## Rules in brief

- Select a piece to see its HP, attack and defence, and its chance to defeat each enemy it can reach. A wounded piece shows its remaining HP on the board.
- Moving onto an enemy piece starts a battle. Both sides roll a six-sided die; the attacker adds its attack and the defender its defence.
- If the attack total beats the defence total, the defender loses the difference in HP (at least 3). At 0 HP it is defeated and the attacker takes the square. A defender that survives keeps its square, and the attacker stays where it was.
- Otherwise, including on a tie, the attack is repelled and the attacker loses 1 HP. A piece that drops to 0 HP this way is removed.
- Damage is permanent. A promoted pawn becomes a full-strength piece.
- There is no check or checkmate. Kings can move into danger and can be attacked; the game ends when a king reaches 0 HP.

The full rules, the stat table and the balance measurements are in [docs/battle-rules.md](docs/battle-rules.md).

## Run

Use Node **22.13+ or 24** and npm. The framework is Next.js 15.5 / React 19.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). Local and computer games need no database. For online games, copy `.env.example` to `.env.local`, supply `MONGODB_URI`, and set a long random `CHESS_AUTH_SECRET`. Never commit that file.

## Play

- **Play here:** two players, one board, with Undo for up to 20 completed turns.
- **Play computer:** White against a worker-based opponent. Easy searches depth 1 and plays any move within 0.8 pawns of its best; Normal searches depth 3; Advanced searches depth 5 within about 1.5 s. These are soft search budgets.
- **Play online:** create a private invite. The creator is White; the recipient explicitly selects **Join as Black**. Black sees the board from Black's side. Keep the same browser profile to retain the signed guest identity; it renews with activity and expires after 30 days without a visit, like inactive matches.
- Select a piece and a highlighted destination. Tab and arrow keys focus squares; Enter selects. Promotion defaults to queen and offers rook, bishop, and knight.
- A battle always uses the turn, whether it is won or repelled. Undo restores the position before it, and the same attack then rolls the same dice, so Undo cannot be used to re-roll.
- **Retry connection** resends the same network request. New Game resets the seed; Leave cancels online work and clears the invite URL.

Castling is allowed even while the king is attacked, en passant is a battle against the pawn, and promotion offers a choice. Threefold and 50-move draws can be claimed; fivefold repetition and 75 quiet moves end the game. A battle resets the draw counters, because lost HP never returns. This is an intentional chess variant, not a claim of tournament compliance.

## Developer notes

A game is schema 7, ruleset `battle-v1`, and records the configuration it began with (currently `2026-11-10.2`, in `lib/battle/config.ts`). Never alter a released configuration; add a new version when the rules or the stat table change. Games saved under the rules that preceded Battle Chess are refused as incompatible: a local save is discarded and an online match reports the error.

`tests/unit/battle-replay.test.ts` pins seeded games played through the real reducer, so a refactor must leave its hashes unchanged. `npm run balance` plays the computer against itself and reports how often battles happen and who wins; `--nodes` makes a run repeat exactly.

A game's stats, dice rules and last battle are public. Piece ids and the dice state stay private: in an online match they never leave the server, behind a nested public allowlist. In local and computer games the concealment is experiential only, since browser memory can be inspected.

## Online persistence

MongoDB stores the complete match in one document. Every submitted intent has a UUID and expected match version. A compare-and-swap commit writes the board, HP, dice state, events, revision, and receipt together. Rejections do not advance the dice. Concurrent losers reload and check receipts; they never reroll automatically.

The latest 64 `(player, actionId)` receipts are retained. An identical retry returns a duplicate acknowledgement and current public state. Reusing an id with changed payload returns 409. After a receipt ages out, its old expected revision still blocks replay; reusing that aged id with a new revision is a new intent. Polls are serialized and gated by match identity and revision; leaving aborts in-flight work.

Unchanged polls answer `304` (`If-None-Match` carries the last version). Opening a match link does not create a guest identity; the first join or move does. Inactive matches expire after 30 days, as do unused guest identities. The app caps each guest at 20 unjoined invites per day, but a new cookie gets around that. For real abuse protection, add Vercel Firewall rate-limit rules on `POST /api/matches` and `POST /api/matches/*` (for example, per IP per minute). `GET /api/health` reports database reachability for uptime checks.

## Layout

| Path                                | Responsibility                                                        |
| ----------------------------------- | --------------------------------------------------------------------- |
| `app/`                              | Next.js page and online API routes                                    |
| `components/chess/`, `hooks/`       | Board, battle panel, promotion, history, undo, polling, computer turn |
| `lib/chess.ts`, `lib/chessRules.ts` | Piece movement, castling and en passant rights, repetition keys       |
| `lib/battle/`                       | Stats and odds, movement, the battle reducer, computer search, config |
| `lib/game.ts`, `lib/game/`          | Game shell, types, validation, public state, undo, dice state         |
| `lib/ai/`                           | Difficulty budgets, board evaluation, the search worker               |
| `lib/serverMatches.ts`, `models/`   | MongoDB authority, versions and receipts                              |
| `tests/`, `scripts/`                | Unit, database and browser tests; the balance run                     |

The repository root is the application and deployment root.

## Deployment

Vercel builds the connected GitHub repository. Pushes to `main` trigger Production deployments; feature branches receive preview deployments. Play at the public production domain, [test-chess-game-roy-kappa-five.vercel.app](https://test-chess-game-roy-kappa-five.vercel.app). Vercel's generated deployment and team URLs are sign-in protected; share the public production domain. The project uses the repository root and Node 24; `vercel.json` explicitly selects the Next.js framework.

Configure `MONGODB_URI` and a stable, long random `CHESS_AUTH_SECRET` in Vercel's Production environment for private online games. Keep the signing secret stable across releases so existing guest sessions retain access. To rotate it, move the old value to `CHESS_AUTH_SECRET_PREVIOUS`; guests are re-signed on their next request, and the previous secret can be removed after 30 days.

After a production push, verify the Vercel deployment status for that exact commit before treating the release as live. Local tests use isolated databases; they do not certify the production database configuration.
