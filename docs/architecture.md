# Architecture

## Layout

| Path                                  | Responsibility                                                      |
| ------------------------------------- | ------------------------------------------------------------------- |
| `app/`                                | Next.js page and online API routes                                  |
| `components/ChessBoard.tsx`           | Page layout; wires the session to the board and side panel          |
| `components/chess/`                   | Board, mode menu, promotion, history, encounters, online controls   |
| `hooks/`                              | Game session, local undo and saves, online polling, AI lifecycle    |
| `lib/chess.ts`, `lib/chessRules.ts`   | Ordinary movement, attack maps, special rights and draws            |
| `lib/game.ts`, `lib/game/`            | Shared reducer, versioned types, validation, public DTO, migration  |
| `lib/rpg/`                            | Seeded subjects, leadership, relationships, agency, court scheduler |
| `lib/rpgChess.ts`                     | Legacy-only D20 compatibility resolver                              |
| `lib/ai/`                             | Iterative worker search and own-side political evaluation           |
| `lib/serverMatches.ts`, `models/`     | MongoDB authority, versions and receipts                            |
| `lib/session.ts`, `lib/serverHttp.ts` | Signed guest identity and shared route handling                     |
| `tests/`, `scripts/`                  | Behavioral, database and browser tests; reproducible measurements   |

## Rules generations

New games use schema 5, `hidden-kingdom-v5` (configuration `2026-09-10.1`). Existing legacy, v2, v3 and v4 saves retain their recorded rules and behavior. What each generation does differently is named in `lib/rpg/capabilities.ts`; a row must never change once saves exist, so new behavior needs a new generation. `tests/unit/replay-fingerprint.test.ts` pins seeded replays across v2–v5, so refactors must leave its hashes unchanged.

V5 adds piece requests, protection and relief, disputes, petitions, supportive courts, and complaint-gated conspiracies. Requests appear below move status and are answered through ordinary moves.

The first eight completed plies always execute ordinary legal moves. Later commands may encounter bounded hesitation, a safe retreat, or a rare heroic extension. There is one refusal budget per turn. Kings and check escapes always obey. Obeyed avoidable exposure and continued neglect can damage trust; meaningful rescue and protection can repair it. Subjects remember coercion, losses, promotion, and rivalries. After a refusal the v3/v4 computer weighs a safer alternative against repeating the order. Tyranny can improve immediate compliance while increasing grievances.

A late-game conspiracy needs strict causal prerequisites, two eligible own turns, three persistent warning stages, and three response turns before an attempt. Guards, separation, leadership recovery, or king movement provide counterplay. Regicide retains the king on the board and creates an explicit terminal result. Ordinary chess results take precedence.

Castling, en passant, promotion choice, checkmate, stalemate, insufficient material, threefold/50-move claims, and fivefold/75-move automatic draws are supported. Draw rights deliberately use the visible chess position and ignore politics. This is an intentional chess variant, not a claim of certified tournament compliance.

Unversioned matches use an idempotent legacy adapter. Their D20 behavior continues with king-safety, promotion, bounded-refusal, and deterministic future-RNG fixes; they do not gain new subjects or conspiracies. The original prototype did not save its `Math.random` history, so past draws cannot be reconstructed. Unknown future schemas/configurations return a controlled incompatibility response without rewriting the match.

## Concealment

The UI has no RPG selector, hidden statistics, or diagnostics panel. `?debug=1` does not reveal them. Local/computer concealment is experiential: browser source and memory can be inspected. Online RNG, subjects, political values, and internal plot objects remain server-private behind a nested public allowlist (`lib/game/publicState.ts`).

## Online persistence

MongoDB stores the complete match in one document. Every submitted intent has a UUID and expected match version. A compare-and-swap commit writes the board, politics, RNG, events, revision, and receipt together. Rejections do not advance RNG. Concurrent losers reload and check receipts; they never reroll automatically.

The latest 64 `(player, actionId)` receipts are retained. An identical retry returns a duplicate acknowledgement and current public state. Reusing an id with changed payload returns 409. After a receipt ages out, its old expected revision still blocks replay; reusing that aged id with a new revision is a new intent. Polls are serialized and gated by match identity and revision; leaving aborts in-flight work.

Unchanged polls answer `304` (`If-None-Match` carries the last version). Opening a match link does not create a guest identity; the first join or move does. Inactive matches expire after 30 days, as do unused guest identities. The app caps each guest at 20 unjoined invites per day, but a new cookie gets around that; see [deployment](deployment.md#rate-limiting) for real abuse protection. `GET /api/health` reports database reachability for uptime checks.
