# Chess Game

A playable chess game built with Next.js, TypeScript, and Tailwind CSS. The deployed experience presents as a chess game while the codebase includes an experimental hidden resolution layer for unusual piece behavior.

## Overview

Players select pieces, review highlighted legal moves, move or capture, and alternate turns. The interface intentionally avoids explaining every internal modifier so occasional hesitation or dramatic movement feels like part of the board's personality rather than a separate rules screen.

## Features

- Responsive chess board with file/rank labels
- Desktop two-column layout with a dedicated game panel
- Mobile-first single-column layout with collapsible logs
- Selected-piece highlighting
- Legal move dots and capture rings
- Last-move and checked-king highlights
- Check, checkmate, and stalemate status
- Move history and undo support
- Player-facing event log with narrative outcomes
- Hidden D20-style move resolution for captures, risky movement, morale, fatigue, and rare extended movement
- Developer diagnostics available only with `?debug=1`

## Tech Stack

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to play.

For diagnostics during local testing, open:

```text
http://localhost:3000?debug=1
```

## Available Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

For a direct TypeScript check:

```bash
npx tsc --noEmit --incremental false
```

## Game Controls

1. Select a piece belonging to the side to move.
2. Choose one of the highlighted destination squares.
3. Use `Undo` to step back one completed move.
4. Use `New Game` to reset the board and reroll hidden state.
5. Use diagnostics only during development by adding `?debug=1` to the URL.

## Current Chess Rules Supported

- Standard movement for kings, queens, rooks, bishops, knights, and pawns
- Captures
- Pawn promotion to queen
- Check detection
- Checkmate and stalemate detection

Castling and en passant are not currently implemented.

## Hidden Resolution Layer

The game intentionally keeps this layer out of the normal player UI. Internally it supports:

- hidden D20 rolls behind moves
- king strength rolls at game start
- king tiers and aura modifiers
- success, partial success, failure, critical failure, and critical success
- rare natural-20 extended movement
- piece morale and fatigue
- diagnostics with raw roll details when `?debug=1` is present

Normal players see only narrative results such as hesitation, resolve, or a piece surging beyond the line.

## Testing Instructions

Recommended local checks:

```bash
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

Manual smoke test:

1. Confirm the board renders and pieces are visible.
2. Select a white piece and confirm legal moves appear.
3. Make a legal move and confirm the turn changes.
4. Try an illegal destination and confirm the status/event log explains it.
5. Confirm move history, last-move highlighting, and undo behavior.
6. Open `/?debug=1` and make moves until diagnostics show hidden rolls.
7. Confirm captures, check, checkmate, and stalemate messages remain readable.

## Deployment

The project is configured for Vercel as a Next.js app. The production branch is expected to be `main`.

## Known Issues

- Castling is not implemented.
- En passant is not implemented.
- The hidden resolution layer is experimental and may need balancing.
- The nested `chess-nextjs` folder exists as a deployment shim that mirrors the root app setup.
