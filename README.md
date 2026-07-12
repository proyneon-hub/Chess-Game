# Chess Game

A private, two-player chess game built with Next.js, TypeScript, and Tailwind CSS. Play locally, against a lightweight computer opponent, or invite a friend to a MongoDB-backed online match.

Chess movement is validated using standard piece rules, while an intentionally hidden RPG-style resolution layer can affect whether a move succeeds and, on rare critical successes, where a piece ends up. Players see narrative outcomes; the raw rolls are available only in local development diagnostics.

## Features

- Local pass-and-play, computer, and private online-invite modes
- Responsive board with coordinate labels, selected-piece styling, legal-move markers, capture markers, and last-move highlights
- Check, checkmate, stalemate, captures, and automatic queen promotion
- Move history, narrative event log, and local-game undo (up to 20 accepted moves)
- Private online matches persisted in MongoDB
- Signed, HTTP-only guest sessions that assign the creator to White and the invited player to Black
- Explicit invite acceptance: opening a link does not claim the Black seat
- Automatic online-board refreshes every 1.5 seconds
- Hidden D20 move resolution with king auras, morale, fatigue, and rare extended moves
- Optional local diagnostics at `?debug=1`; hidden state is never returned by the online-match API

## Tech stack

- Next.js 14 and React 18
- TypeScript
- Tailwind CSS
- MongoDB with Mongoose (online matches)

## Requirements

- Node.js 18.17 or later
- MongoDB only if you plan to use online matches

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Local and computer games work without configuration. To enable online invites, create `.env.local` from the provided example and supply your MongoDB connection string and a long random signing secret:

```bash
Copy-Item .env.example .env.local
```

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27017/rpg_chess
CHESS_AUTH_SECRET=replace-with-a-long-random-secret
MONGODB_SERVER_SELECTION_TIMEOUT_MS=5000
```

For local diagnostics, open [http://localhost:3000/?debug=1](http://localhost:3000/?debug=1). Diagnostics are available in local and computer games only.

## How to play

1. Choose **Play here**, **Play computer**, or **Play online**.
2. Select a piece belonging to the side whose turn it is, then select a highlighted destination.
3. For an online game, the creator selects **Copy invite link**. The recipient opens the link and selects **Join as Black**.
4. Online players use the same browser profile to retain their guest-session identity. A game can have only one player per color.
5. Use **Undo** only in a local pass-and-play game. It is unavailable for computer and online games.

## Rules and gameplay notes

The board enforces normal movement for all standard pieces and prevents moves that leave the moving king in check. It supports captures, check, checkmate, stalemate, and automatic promotion of pawns to queens.

Castling and en passant are not implemented.

After a legal destination is chosen, the hidden resolution layer rolls for the attempted move. A piece may hesitate or refuse the command; a natural 20 can, when safe and possible, carry it one extra square beyond the selected destination. This is deliberate game behavior, so the experience is not a strict implementation of tournament chess.

## Online matches

Online games use private, unlisted UUID invite links. The server stores the complete game state in MongoDB and uses an optimistic version check to reject simultaneous conflicting updates. The browser receives only the visible board, move history, and event messages; piece identities and RPG state remain server-side.

Set `MONGODB_URI` and `CHESS_AUTH_SECRET` in your deployment environment as well as locally. `CHESS_AUTH_SECRET` is required in production; use a long, unique random value.

## Scripts

```bash
npm run dev      # start the development server
npm run build    # create a production build
npm run start    # run the production build
npm run lint     # run Next.js linting
npx tsc --noEmit --incremental false  # type-check without emitting files
```

## Verification checklist

```bash
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

For a manual check, start each game mode, make a legal move, verify the board and event log update, and test an online invite in a separate browser profile. In local mode, also confirm undo works; with `?debug=1`, confirm the diagnostics panel can be opened.

## Deployment

The repository includes a Vercel configuration for a Next.js deployment. Configure the MongoDB URI and signing secret in the deployment provider before enabling online play in production.

## Project layout

```text
app/                    Next.js pages and online-match route handlers
components/ChessBoard.tsx  Interactive board and game-mode UI
lib/chess.ts            Chess movement and position validation
lib/game.ts             Game state and move submission
lib/rpgChess.ts         Hidden RPG resolution system
lib/serverMatches.ts    MongoDB-backed match coordination
models/GameMatch.ts     Mongoose match schema
```
