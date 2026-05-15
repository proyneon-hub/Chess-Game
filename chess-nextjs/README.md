# Chess - Next.js Starter

A fully playable chess game built with Next.js 14, TypeScript, and Tailwind CSS.

## Features

- Full chess rules (check, checkmate, stalemate, pawn promotion)
- Click-to-move with legal move highlighting
- Turn indicator and game status messages
- Zero dependencies - pure TypeScript chess engine

## Project Structure

```text
chess-nextjs/
app/
  layout.tsx       # Root layout
  page.tsx         # Home page
  globals.css      # Tailwind imports
components/
  ChessBoard.tsx   # Interactive board UI
lib/
  chess.ts         # Chess engine (moves, check, etc.)
...config files
```

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to play.

## Deploy to Vercel

```bash
# Push to GitHub, then:
npx vercel --prod
# or connect your repo at vercel.com
```

## Extending

Ideas for next steps:

- **AI opponent** - run Stockfish via WebAssembly (use `stockfish.js` from npm)
- **Multiplayer** - add WebSocket support with Vercel Edge Functions + Pusher
- **Move history** - track SAN notation and show a sidebar
- **En passant & castling** - extend `lib/chess.ts`
- **User accounts** - add NextAuth.js + a database (Vercel Postgres / Supabase)
- **Game persistence** - save game state to localStorage or a database
