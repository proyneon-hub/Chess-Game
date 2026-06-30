# UI Improvement Implementation Plan for Chess Game

**Project:** Chess Game / RPG-Chess Expansion  
**Target platforms:** Desktop browsers, tablet browsers, and mobile browsers  
**Purpose:** Improve gameplay clarity, board usability, mobile responsiveness, and prepare the UI for future hidden RPG dice mechanics.

---

## 1. Design Goal

The current game UI is functional, but the gameplay experience can be improved by making player actions clearer and making the layout adapt better across desktop and mobile screens.

The main goal is:

> Every player action should be visually confirmed, easy to understand, and comfortable to perform on both desktop and mobile browsers.

The UI should support the basic chess flow first:

```text
select piece → see valid moves → move piece → see result → turn changes
```

Then the UI should support the future RPG-chess flow:

```text
hidden dice roll → narrative message → visual effect → event log update
```

---

## 2. Current UI Issues Observed

Based on the current screenshot, the game already has these useful elements:

- Centered title
- Dark theme
- Turn indicator
- Chess board
- Message panel
- Event log
- New Game button

However, the experience can be improved in these areas:

1. The board feels small on desktop.
2. The layout is vertically stacked even on wide screens.
3. The event log is below the board instead of beside the board on desktop.
4. The turn indicator is small and easy to miss.
5. The message panel feels visually plain.
6. Piece selection feedback is not obvious enough.
7. Legal moves and capture targets should be highlighted.
8. Mobile layout needs stronger touch support.
9. Controls such as New Game should be easier to access.
10. Future RPG events need stronger visual and narrative presentation.

---

## 3. Priority Implementation Summary

### High Priority

- Increase board size on desktop.
- Add selected-piece highlighting.
- Add legal move indicators.
- Add capture indicators.
- Add stronger turn/status display.
- Move event log to a side panel on desktop.
- Use full-width responsive board on mobile.
- Add clear invalid-move feedback.

### Medium Priority

- Add move history separate from event log.
- Add collapsible event log on mobile.
- Add Undo button.
- Add improved New Game placement.
- Add board shadow/border polish.
- Improve coordinate readability.

### Future RPG-Chess Priority

- Add Classic/RPG mode toggle.
- Add RPG event message styling.
- Add rule-break visual effects.
- Add post-game battle report.
- Add debug panel for hidden dice roll testing.

---

## 4. Recommended Desktop Layout

Desktop browsers should use a two-column gameplay layout.

```text
---------------------------------------------------------
|                         CHESS                         |
---------------------------------------------------------
|                                                       |
|   Chess Board                  Game Panel              |
|   560px x 560px                Turn Status             |
|                                Status Message          |
|                                Move History            |
|                                Event Log               |
|                                Controls                |
|                                                       |
---------------------------------------------------------
```

### Desktop Layout Requirements

- Board should be the visual focus.
- Game panel should sit to the right of the board.
- Event log should be visible without scrolling far down.
- Controls should be grouped together in the side panel.
- Board should not become wider than the available viewport.

### Suggested Desktop Container Structure

```tsx
<main className="gamePage">
  <h1 className="gameTitle">CHESS</h1>

  <section className="gameLayout">
    <div className="boardArea">
      <ChessBoard />
    </div>

    <aside className="gamePanel">
      <TurnIndicator />
      <StatusMessage />
      <MoveHistory />
      <EventLog />
      <GameControls />
    </aside>
  </section>
</main>
```

---

## 5. Recommended Mobile Layout

Mobile browsers should use a single-column layout with a large responsive board.

```text
CHESS
White to Move

Status Message

Chess Board

[ New Game ] [ Undo ] [ Menu ]

[ Show Move History ]
[ Show Event Log ]
```

### Mobile Layout Requirements

- Board should use almost full screen width.
- Board should avoid horizontal scrolling.
- Touch targets should be large and easy to tap.
- Event log should be collapsible.
- Primary controls should be close to the board.
- Status messages should remain visible and readable.

---

## 6. Responsive CSS Plan

Use responsive sizing for the board.

```css
.boardWrapper {
  width: min(94vw, 560px);
  aspect-ratio: 1 / 1;
  margin: 0 auto;
}

@media (min-width: 1024px) {
  .boardWrapper {
    width: 560px;
  }
}
```

Use a desktop grid layout.

```css
.gameLayout {
  display: grid;
  grid-template-columns: minmax(320px, 560px) minmax(280px, 360px);
  gap: 2rem;
  align-items: start;
  justify-content: center;
  width: 100%;
  max-width: 1040px;
  margin: 0 auto;
}

@media (max-width: 900px) {
  .gameLayout {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}
```

---

## 7. Board Visual Improvements

### 7.1 Board Size

Recommended board sizes:

```text
Desktop: 520px–640px
Tablet: 90vw, max 520px
Mobile: 94vw
```

### 7.2 Board Container Styling

Add a visual frame around the board so the board stands apart from the dark background.

```css
.boardFrame {
  padding: 0.75rem;
  border: 1px solid rgba(245, 158, 11, 0.35);
  border-radius: 16px;
  background: rgba(0, 0, 0, 0.45);
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.45);
}
```

### 7.3 Board Coordinates

Coordinates should be readable but not distracting.

Recommended behavior:

- Desktop: show coordinates by default.
- Mobile: make coordinates smaller or allow a toggle to hide them.

---

## 8. Piece Interaction States

The board should visually respond to all major interactions.

### 8.1 Selected Piece

When the player selects a piece, highlight the selected square.

```css
.squareSelected {
  outline: 3px solid #f59e0b;
  outline-offset: -3px;
  box-shadow: inset 0 0 18px rgba(245, 158, 11, 0.55);
}
```

### 8.2 Legal Move Indicator

Show a small dot in legal destination squares.

```css
.legalMove::after {
  content: "";
  width: 28%;
  height: 28%;
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.75);
  position: absolute;
  top: 36%;
  left: 36%;
}
```

### 8.3 Capture Indicator

Show a red ring around capturable pieces.

```css
.captureMove {
  box-shadow: inset 0 0 0 4px rgba(239, 68, 68, 0.85);
}
```

### 8.4 Last Move Indicator

Show a subtle highlight on the starting and ending squares of the last move.

```css
.lastMove {
  background-image: linear-gradient(
    rgba(250, 204, 21, 0.25),
    rgba(250, 204, 21, 0.25)
  );
}
```

### 8.5 King in Check Indicator

When the king is in check, use a red glow.

```css
.kingInCheck {
  box-shadow: inset 0 0 20px rgba(239, 68, 68, 0.9);
  animation: dangerPulse 1s infinite alternate;
}

@keyframes dangerPulse {
  from {
    box-shadow: inset 0 0 10px rgba(239, 68, 68, 0.55);
  }
  to {
    box-shadow: inset 0 0 24px rgba(239, 68, 68, 1);
  }
}
```

---

## 9. Turn Indicator Improvements

The current small text indicator should become a stronger visual badge.

### Recommended UI

```text
[ White to Move ]
```

or

```text
⚪ White to Move
```

### Suggested Component

```tsx
function TurnIndicator({ turn }: { turn: "white" | "black" }) {
  return (
    <div className={`turnBadge ${turn === "white" ? "turnWhite" : "turnBlack"}`}>
      <span className="turnDot" />
      {turn === "white" ? "White to Move" : "Black to Move"}
    </div>
  );
}
```

### Suggested Styling

```css
.turnBadge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.9rem;
  border-radius: 999px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
}
```

---

## 10. Status Message Improvements

The status message should look like a gameplay notification, not just plain text.

### Message Types

Use different message styles:

```text
info: normal gameplay instruction
success: move completed
warning: risky or blocked situation
error: invalid move
special: RPG or rule-breaking event
```

### Example Messages

```text
Your Turn: Select a white piece to move.
Invalid Move: The bishop cannot move through another piece.
Capture: White knight captures the black pawn.
Rule Break: The rook pushes beyond normal limits.
The king's presence strengthens nearby allies.
```

### Suggested Styling

```css
.statusMessage {
  padding: 0.85rem 1rem;
  border-radius: 12px;
  font-size: 0.95rem;
  line-height: 1.4;
  background: rgba(15, 23, 42, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.25);
}

.statusInfo {
  border-color: rgba(59, 130, 246, 0.5);
}

.statusSuccess {
  border-color: rgba(34, 197, 94, 0.55);
}

.statusWarning {
  border-color: rgba(245, 158, 11, 0.65);
}

.statusError {
  border-color: rgba(239, 68, 68, 0.65);
}

.statusSpecial {
  border-color: rgba(168, 85, 247, 0.75);
  box-shadow: 0 0 24px rgba(168, 85, 247, 0.18);
}
```

---

## 11. Event Log Improvements

### 11.1 Desktop Event Log

On desktop, place the event log inside the right-side game panel.

```text
Game Panel
- Turn Indicator
- Status Message
- Move History
- Event Log
- Controls
```

### 11.2 Mobile Event Log

On mobile, make the event log collapsible.

```tsx
<details className="mobileLog">
  <summary>Show Event Log</summary>
  <EventLog />
</details>
```

### 11.3 Event Log Content

The event log should use clear, concise entries.

```text
Game started. White to move.
White selected pawn on e2.
White pawn moved from e2 to e4.
Black attempted invalid move.
White knight captured black pawn.
```

For RPG mode:

```text
The knight hesitates under pressure.
Rule Break: The bishop moves beyond normal limits.
The king's command steadies nearby allies.
```

---

## 12. Move History Improvements

Move history and event log should be separate.

### Move History Example

```text
1. e4 e5
2. Nf3 Nc6
3. Bb5 a6
```

### Event Log Example

```text
Game started.
White to move.
Invalid move attempted.
Check.
```

This separation helps chess players track the match while also allowing RPG-style events to be displayed narratively.

---

## 13. Controls Improvements

### 13.1 Desktop Controls

Place controls in the side panel.

Recommended controls:

```text
[ New Game ]
[ Undo Move ]
[ Reset Board ]
[ Toggle Coordinates ]
[ Classic / RPG Mode ]
```

### 13.2 Mobile Controls

Use compact controls below the board.

```text
[ New ] [ Undo ] [ Menu ]
```

Optionally make controls sticky at the bottom of the screen.

```css
.mobileControls {
  position: sticky;
  bottom: 0;
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem;
  background: rgba(0, 0, 0, 0.82);
  backdrop-filter: blur(10px);
}
```

---

## 14. Mobile Touch Improvements

Mobile browsers need special care.

### Requirements

- Board should be nearly full width.
- Each square should be large enough to tap.
- Touch feedback should be immediate.
- The page should not accidentally scroll while moving pieces.
- Controls should not be too close to board squares.

### Suggested Touch Rules

```css
.chessBoard {
  touch-action: manipulation;
  user-select: none;
}

.square {
  min-width: 44px;
  min-height: 44px;
}
```

### Mobile Testing Checklist

- [ ] Board fits within viewport width.
- [ ] No horizontal scrolling.
- [ ] Pieces are easy to tap.
- [ ] Selected piece state is obvious.
- [ ] Legal move dots are visible.
- [ ] Event log does not push board too far down.
- [ ] New Game button is easy to reach.
- [ ] Text remains readable.

---

## 15. Future RPG-Chess UI Additions

These improvements prepare the game for hidden D&D-style mechanics.

### 15.1 Mode Toggle

Add a visible mode toggle.

```text
Classic Chess | RPG Chess
```

Recommended behavior:

- Classic Chess uses deterministic chess rules.
- RPG Chess enables hidden rolls, king strength, morale, and rule-breaking.

### 15.2 RPG Event Styling

Use a distinct style for special events.

```text
Rule Break: The knight surges beyond its path.
Critical Failure: The pawn loses courage.
King Aura: The king steadies nearby allies.
```

Recommended color:

```text
Purple/gold for RPG events
Red for failures
Green for successful heroic events
```

### 15.3 Rule-Break Animation

When a rule-breaking move happens:

1. Highlight the piece.
2. Show special glow on the destination square.
3. Animate the move.
4. Show a short message.
5. Add event log entry.

Example flow:

```text
Player selects knight.
Hidden roll succeeds.
Board flashes purple/gold.
Knight moves beyond normal path.
Message appears: Rule Break — The knight defies the board.
Event log records the moment.
```

### 15.4 Post-Game Battle Report

After the match, show a summary.

```text
Hidden Battle Report

White King: Heroic
Black King: Ordinary
Rule Breaks: 1
Critical Successes: 2
Critical Failures: 1
Most Courageous Piece: White Knight
```

---

## 16. Suggested Component Breakdown

If the current UI is mostly inside one component, split it into smaller components.

```text
components/
  ChessBoard.tsx
  ChessSquare.tsx
  Piece.tsx
  TurnIndicator.tsx
  StatusMessage.tsx
  EventLog.tsx
  MoveHistory.tsx
  GameControls.tsx
  ModeToggle.tsx
  DebugPanel.tsx
```

Recommended structure:

```text
src/
  app/
  components/
  game/
  rpg/
  types/
```

Example:

```text
src/
  components/
    ChessBoard.tsx
    GamePanel.tsx
    GameControls.tsx
  game/
    chessRules.ts
    moveValidator.ts
    gameState.ts
  rpg/
    dice.ts
    kingStrength.ts
    moveResolver.ts
    ruleBreaks.ts
  types/
    chess.ts
    rpg.ts
```

---

## 17. Implementation Checklist

### Board and Layout

- [ ] Increase board size on desktop.
- [ ] Make board responsive on mobile.
- [ ] Add desktop two-column layout.
- [ ] Add single-column mobile layout.
- [ ] Add board frame, border, and shadow.

### Interaction Feedback

- [ ] Add selected-piece highlight.
- [ ] Add legal move indicators.
- [ ] Add capture indicators.
- [ ] Add last-move highlight.
- [ ] Add king-in-check highlight.
- [ ] Add invalid-move message.

### Status and Logs

- [ ] Create stronger turn badge.
- [ ] Improve status message panel.
- [ ] Add message types: info, success, warning, error, special.
- [ ] Add event log to desktop side panel.
- [ ] Make event log collapsible on mobile.
- [ ] Add separate move history panel.

### Controls

- [ ] Move New Game button into controls group.
- [ ] Add Undo button.
- [ ] Add Reset Board button if useful.
- [ ] Add coordinates toggle.
- [ ] Add Classic/RPG mode toggle.

### Mobile

- [ ] Ensure board uses 94vw max width.
- [ ] Ensure squares are easy to tap.
- [ ] Prevent accidental page scrolling while interacting.
- [ ] Keep controls near board.
- [ ] Test on narrow screens.

### RPG-Chess Future UI

- [ ] Add RPG event message style.
- [ ] Add rule-break animation.
- [ ] Add king aura visual effect.
- [ ] Add debug panel for hidden rolls.
- [ ] Add post-game battle report.

---

## 18. Acceptance Criteria

The UI update is successful when:

- The board is comfortable to play on desktop.
- The board fits properly on mobile.
- The player can clearly see whose turn it is.
- Selecting a piece gives immediate visual feedback.
- Legal moves are visible.
- Invalid moves provide a clear explanation.
- The event log is readable without disrupting gameplay.
- Mobile users can tap pieces accurately.
- The UI has enough structure to support future RPG messages and rule-break effects.

---

## 19. Recommended Development Order

Implement the changes in this order:

1. Responsive board sizing.
2. Desktop two-column layout.
3. Mobile single-column layout.
4. Selected-piece highlight.
5. Legal move and capture indicators.
6. Stronger turn indicator.
7. Improved status message panel.
8. Event log side panel and mobile collapse.
9. Move history panel.
10. Controls group.
11. RPG mode toggle.
12. RPG event effects.

---

## 20. Final Design Principle

The strongest improvement is to make the game respond visibly to every action.

```text
Click a piece → show selected state.
Choose a square → show success or reason for failure.
Complete a move → update board, turn, history, and status.
Trigger a special event → show animation, message, and event log entry.
```

This will make the chess game feel more polished immediately and will also make the future RPG-chess mechanics feel intentional instead of confusing.
