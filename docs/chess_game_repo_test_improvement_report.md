# Chess Game Repository Test Review and Improvement Report

**Repository:** https://github.com/proyneon-hub/Chess-Game  
**Known deployed URL from repository README/about metadata:** https://chess-game-six-zeta.vercel.app  
**Previously provided test URL:** https://test-chess-game-roy-kappa-five.vercel.app/test  
**Review date:** 2026-06-30  
**Review type:** Remote repository/deployment accessibility review + gameplay/UX improvement plan

---

## 1. Testing Status

I attempted to inspect the GitHub repository and deployed routes remotely.

The repository is publicly visible and appears to contain a `chess-nextjs` project folder plus a `README.md`. The available repository metadata describes the project as a playable chess game built with **Next.js, TypeScript, and Tailwind CSS**, created as a Vercel deployment test project.

However, the browser/page inspection tools could not retrieve usable live page content from the deployed URLs. Because of that, this report should be treated as a **repository-level review and structured testing/improvement plan**, not a full click-by-click runtime QA report.

To perform complete hands-on gameplay testing later, provide either:

- a zipped copy of the project source,
- screenshots or gameplay recording,
- or a deployed route that renders accessible page content to external inspection tools.

---

## 2. Repository-Level Observations

Based on the publicly visible repository metadata:

- The project is a chess game.
- The main app appears to live inside the `chess-nextjs` folder.
- The codebase is primarily TypeScript.
- The README lists basic local setup instructions:

```bash
npm install
npm run dev
```

- The local development URL is expected to be:

```text
http://localhost:3000
```

This is good for a basic deployable prototype, but the README should be expanded if the game is evolving into an RPG-chess/chase-game system.

---

## 3. Main Improvement Summary

The core chess prototype should now be improved in two directions:

1. **Standard game usability**
   - Make the board, turns, move feedback, and invalid actions clear.

2. **RPG-chess hidden dice design**
   - Add invisible D&D-style rolls in a way that feels dramatic, not buggy.

The biggest risk for this project is not hidden randomness itself. The biggest risk is that users may interpret hidden randomness as broken chess logic unless the game communicates outcomes properly.

---

## 4. High-Priority Improvements

### 4.1 Add Clear Game State Feedback

Players should always know what is happening.

Add a visible game status area with messages such as:

```text
White to move.
Black to move.
Select a piece.
Invalid move.
Check.
Checkmate.
The knight hesitates.
The king's influence strengthens the move.
A rule-breaking move has occurred.
```

Why this matters:

- Chess players expect deterministic movement.
- RPG-style randomness needs explanation.
- Without feedback, a failed move can look like a click/input bug.

---

### 4.2 Highlight Selected Piece and Legal Moves

When the player selects a piece, the UI should show:

- selected piece square,
- legal destination squares,
- capture squares,
- dangerous squares if possible.

Recommended visual language:

```text
Selected piece: blue outline
Legal move: soft green dot
Capture: red ring
King danger/check: red glow
Special/RPG move: purple or gold glow
```

This improves both normal chess usability and future RPG-chess clarity.

---

### 4.3 Add a Move History / Event Log

Add a visible side panel or collapsible log.

For normal chess mode:

```text
1. White pawn e2 → e4
2. Black pawn e7 → e5
3. White knight g1 → f3
```

For RPG-chess mode:

```text
Turn 4: White knight advances.
Turn 5: Black bishop hesitates under pressure.
Turn 6: Rule Break — White rook pushes beyond its normal limit.
```

Do not reveal raw dice by default. Keep the player-facing version narrative.

---

### 4.4 Add Debug Mode for Development

Since this game will include hidden dice logic, the developer/tester needs a debug mode.

Debug mode should show:

```text
Piece ID
Move type
D20 roll
Piece modifier
King aura modifier
Board-state modifier
Final score
Success threshold
Outcome
Rule-break triggered: true/false
```

Example debug event:

```text
Move: white_knight_1 g1 → f3
Roll: 17
Piece Skill: +4
King Aura: +2
Threat Penalty: 0
Final Result: 23
Outcome: Critical Success
Rule Break: false
```

This is essential for balancing and bug fixing.

---

### 4.5 Improve README Documentation

The current README appears to be very minimal. Expand it so another developer, tester, or future collaborator understands the project.

Suggested README sections:

```md
# Chess Game

## Overview
## Features
## Tech Stack
## Getting Started
## Available Scripts
## Game Controls
## Current Chess Rules Supported
## Planned RPG-Chess Features
## Testing Instructions
## Deployment
## Known Issues
```

Add a dedicated section for the RPG-chess expansion:

```md
## Planned RPG-Chess Mode

This mode keeps the chess board visible but adds hidden RPG mechanics:

- hidden D20 rolls behind moves
- king strength rolls at game start
- success/failure probability
- rare rule-breaking moves
- piece morale and loyalty
- optional post-game hidden battle report
```

---

## 5. RPG-Chess Feature Recommendations

### 5.1 Start With a Mode Toggle

Do not immediately replace normal chess behavior.

Add two modes:

```text
Classic Chess Mode
RPG Chess Mode
```

This prevents confusion and gives testers a baseline comparison.

---

### 5.2 Add Hidden King Strength Roll

At game start in RPG Chess Mode:

```text
White King rolls D20 for base strength.
Black King rolls D20 for base strength.
```

Suggested tiers:

```text
1–4: Weak
5–9: Ordinary
10–14: Strong
15–19: Heroic
20: Legendary
```

Player-facing hint:

```text
The kings take command of the battlefield.
```

Do not reveal exact values during the match unless debug mode is enabled.

---

### 5.3 Add Hidden Move Resolution

Each move should pass through a hidden resolver.

Recommended first implementation:

```text
Normal safe move: almost always succeeds
Capture: roll-based success/failure
Risky move: roll-based success/failure
Rule-break attempt: rare success only
```

Do not make ordinary moves fail too often. If normal chess movement feels unreliable, players may quit before understanding the RPG concept.

Recommended tuning:

```text
Normal move success: 90–95%
Capture success: 70–85%
Risky move success: 55–75%
Rule-break success: 5–15%
Critical failure chance: 1–5%
```

---

### 5.4 Add Rule-Break Presentation

Rule-breaking moments should be visually and narratively obvious.

Use:

- animation pulse,
- unique color effect,
- short message,
- sound effect if available,
- event log entry.

Example message:

```text
Rule Break: The knight moves beyond its normal path.
```

This prevents players from assuming the move generator is broken.

---

### 5.5 Add Post-Game Battle Report

This would fit the RPG-disguised-as-chess design very well.

Example:

```text
Hidden Battle Report

White King: Heroic
Black King: Ordinary
Critical Successes: 2
Critical Failures: 1
Rule Breaks: 1
Most Courageous Piece: White Knight
Most Unstable Piece: Black Pawn
```

This lets the game stay mysterious during play while explaining the hidden RPG system after the match.

---

## 6. Suggested Manual Test Cases

Use this checklist once you run the game locally or on a working deployment.

### Test Case 1: App Loads

Steps:

1. Open the home route.
2. Confirm the board renders.
3. Confirm pieces render.
4. Confirm there is no console error.

Expected result:

```text
The board and all pieces appear correctly.
```

---

### Test Case 2: Basic Piece Selection

Steps:

1. Click a white piece.
2. Confirm it is highlighted.
3. Confirm legal moves appear.
4. Click another piece.

Expected result:

```text
Selection changes clearly and legal moves update.
```

---

### Test Case 3: Valid Move

Steps:

1. Select a legal piece.
2. Move it to a valid square.
3. Confirm the board updates.
4. Confirm turn changes.

Expected result:

```text
The move succeeds and the active player switches.
```

---

### Test Case 4: Invalid Move

Steps:

1. Select a piece.
2. Click an illegal destination.

Expected result:

```text
The piece does not move and the player gets a clear reason.
```

Recommended message:

```text
That piece cannot move there.
```

---

### Test Case 5: Capture

Steps:

1. Create or locate a capture opportunity.
2. Capture an opposing piece.
3. Confirm the captured piece is removed.
4. Confirm move history updates.

Expected result:

```text
Capture is visually clear and game state remains accurate.
```

---

### Test Case 6: Check and Checkmate

Steps:

1. Put a king in check.
2. Confirm the game displays check.
3. Continue to checkmate if supported.

Expected result:

```text
Check/checkmate rules are recognized and communicated clearly.
```

---

### Test Case 7: RPG Mode King Roll

Steps:

1. Enable RPG Chess Mode.
2. Start a game.
3. Check debug output.

Expected result:

```text
Both kings receive hidden strength values and tiers.
```

---

### Test Case 8: RPG Move Success

Steps:

1. Enable debug mode.
2. Attempt a normal move.
3. Confirm hidden D20 roll is generated.
4. Confirm final outcome is calculated.

Expected result:

```text
Move resolution includes roll, modifiers, threshold, and outcome.
```

---

### Test Case 9: RPG Critical Failure

Steps:

1. Force or seed a natural 1.
2. Attempt a risky move.

Expected result:

```text
The move fails with a clear narrative message.
```

Recommended message:

```text
The piece hesitates and refuses the command.
```

---

### Test Case 10: RPG Rule Break

Steps:

1. Force or seed a natural 20.
2. Attempt a rule-breaking move.

Expected result:

```text
The rule-break succeeds, the visual effect plays, and the event log records it.
```

---

## 7. Suggested File/Code Organization

If the project does not already have this structure, consider organizing the RPG logic separately from the UI.

Recommended structure:

```text
src/
  app/
  components/
    ChessBoard.tsx
    GameLog.tsx
    GameStatus.tsx
    ModeToggle.tsx
  game/
    chessRules.ts
    gameState.ts
    moveValidator.ts
  rpg/
    dice.ts
    kingStrength.ts
    moveResolver.ts
    morale.ts
    ruleBreaks.ts
    debugLog.ts
  types/
    chess.ts
    rpg.ts
```

Why this helps:

- keeps chess rules separate from RPG rules,
- makes testing easier,
- prevents UI components from becoming too complex,
- allows Classic Mode and RPG Mode to share the same board.

---

## 8. Recommended Automated Tests

Add unit tests for the RPG engine before deeply integrating it into the UI.

Suggested test files:

```text
rpg/dice.test.ts
rpg/kingStrength.test.ts
rpg/moveResolver.test.ts
rpg/ruleBreaks.test.ts
```

Test examples:

```text
- D20 roll always returns 1–20
- king strength maps to correct tier
- natural 1 causes critical failure
- natural 20 can trigger rule-break
- normal move usually succeeds
- debug mode exposes hidden data
- public state hides hidden dice data
```

---

## 9. Deployment Improvements

Since the deployed pages could not be inspected by the remote tool, verify the following:

- The correct Vercel project is deployed.
- The current production branch is `main`.
- The app route exists.
- The `/test` route exists if you are sharing that route.
- The app works in incognito mode.
- No authentication is required.
- No local-only environment variables are required for the frontend to render.
- The page has basic static content available before or during hydration.

Add a visible fallback if the app is loading:

```text
Loading chess board...
```

Add an error boundary:

```text
Something went wrong while loading the board. Please refresh.
```

---

## 10. Prioritized Action Plan

### Immediate

1. Confirm the deployed URL and route are correct.
2. Expand the README.
3. Add visible turn/status messaging.
4. Add selected-piece and legal-move highlighting.
5. Add a basic move/event log.

### Next

1. Add Classic Mode vs RPG Chess Mode.
2. Add hidden king strength roll.
3. Add hidden D20 move resolver.
4. Add debug mode.
5. Add narrative feedback for failures and rule-breaks.

### Later

1. Add morale and loyalty.
2. Add post-game battle report.
3. Add campaign progression.
4. Add piece experience.
5. Add faction personalities.

---

## 11. Final Recommendation

Before adding complex RPG mechanics, make sure the base chess interaction is very clear:

```text
select piece → see valid moves → move piece → see result → turn changes
```

Then layer the RPG system on top with strong feedback:

```text
hidden roll → narrative message → visual effect → event log
```

The target experience should be:

> The game looks like chess, but the pieces feel alive and the board secretly behaves like an RPG battlefield.

That idea is strong. The next step is to make every unusual outcome feel intentional, readable, and exciting.
