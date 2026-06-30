# Chase Game RPG-Chess Expansion Design

> **Project note:** This document defines an expansion layer for an existing **chase/chess-style game** where the visible game still looks like chess, but the hidden rules operate like a D&D-inspired role-playing system. The player sees pieces move on a board; behind the scenes, invisible dice rolls determine strength, morale, success, failure, and whether normal chess rules can be bent or broken.

## 1. Concept Summary

The goal is to turn the base chase/chess game into a **role-play game disguised as chess**.

At a high level:

- The board, pieces, turns, and movement still resemble chess.
- Every action secretly triggers a dice-based RPG resolution system.
- Players do **not** see the dice rolls by default.
- Kings are treated as RPG leaders with hidden base strength values.
- Moves can succeed, fail, partially succeed, or trigger special outcomes.
- Standard chess rules can occasionally be broken if the hidden roll supports it.
- The experience should feel like chess on the surface, but behave like a tactical fantasy RPG underneath.

This is inspired by the idea of a chess game that is not purely chess, but a larger game of will, morale, power, and role-play hidden behind chess-like presentation. For additional thematic reference, *No Game No Life* includes chess variants such as “Living Chess,” where pieces have their own will and may refuse sacrifice, betray sides, or act less like ordinary chess pieces and more like participants in a larger war game. Source: No Game No Life Wiki — Chess page, retrieved as design reference. `turn1search1`

---

## 2. Core Design Pillars

### 2.1 Chess as the Mask

The player should initially believe they are playing a normal chess-like chase game.

Visible layer:

- Chess board or chess-inspired board
- Kings and opposing forces
- Piece movement
- captures
- threats
- check/checkmate-adjacent logic, if already present in the base project

Hidden layer:

- Dice rolls
- Character strength
- move difficulty
- morale
- loyalty
- fatigue
- luck
- rule-breaking events

### 2.2 D&D-Inspired Resolution

Every meaningful action should be resolved through a hidden roll, similar to a tabletop RPG skill check.

Example internal formula:

```text
Final Roll = Dice Roll + Piece Modifier + King Aura Modifier + Board State Modifier + Status Modifier
```

The result determines whether the move succeeds.

### 2.3 Invisible to the Player by Default

The player should not see:

- raw dice values
- probability percentages
- hidden strength values
- modifiers
- failure thresholds

The player may only see outcomes:

- move succeeds
- move fails
- piece hesitates
- piece defies command
- move goes farther than expected
- capture fails
- illegal-looking move happens
- king’s presence changes the result

Optional developer/debug mode can expose the hidden RPG data.

---

## 3. Opening King Strength Roll

At the beginning of the game, both opposing kings secretly roll for base strength.

### 3.1 Purpose

The king strength roll determines the hidden power level of each side’s leader.

This affects:

- success probability of allied moves
- resistance to enemy pressure
- chance of rule-breaking moves
- morale of nearby pieces
- capture resistance
- endgame strength
- special events

### 3.2 Suggested Roll

Use a D20 roll for each king.

```text
White King Base Strength = random(1, 20)
Black King Base Strength = random(1, 20)
```

Optional expanded version:

```text
King Base Strength = D20 + Faction Modifier + Difficulty Modifier
```

### 3.3 Strength Bands

| Roll Range | King Tier | Gameplay Meaning |
|---:|---|---|
| 1–4 | Weak King | Allied pieces are unstable; rule-breaking is rare; failures are more common. |
| 5–9 | Ordinary King | Standard balance; minor bonuses only. |
| 10–14 | Strong King | Allied moves are more reliable; morale bonus nearby. |
| 15–19 | Heroic King | Increased chance of special actions and rule-breaking. |
| 20 | Legendary King | Major hidden advantage; rare impossible moves can occur. |

---

## 4. Hidden Move Resolution System

Every move has a hidden probability of success or failure.

### 4.1 Move Roll

Whenever a player or AI selects a move, the game rolls secretly.

Recommended base mechanic:

```text
Move Roll = D20 + Piece Skill + King Influence + Position Modifier - Move Difficulty
```

The move succeeds if:

```text
Move Roll >= Success Threshold
```

### 4.2 Default Success Thresholds

| Move Type | Suggested Threshold |
|---|---:|
| Normal legal move | 5 |
| Capture | 8 |
| Escaping danger | 10 |
| Moving while threatened | 11 |
| Defending king | 12 |
| Breaking normal chess movement rule | 16 |
| Capturing stronger piece | 17 |
| Sacrificial move | 18 |
| Impossible/legendary move | 20+ |

### 4.3 Outcome Types

A move should not only succeed or fail. It can have graded results.

| Result | Condition | Example Outcome |
|---|---|---|
| Critical Failure | Natural 1 | Piece refuses, stumbles, loses morale, or creates disadvantage. |
| Failure | Below threshold | Move is canceled or weakened. |
| Partial Success | Threshold - 1 or -2 | Move happens but with a penalty. |
| Success | Meets threshold | Move occurs normally. |
| Strong Success | Beats threshold by 5+ | Bonus effect may trigger. |
| Critical Success | Natural 20 | Rule-breaking or heroic outcome may trigger. |

---

## 5. Piece Stats

Each chess piece can have hidden RPG-like stats.

### 5.1 Suggested Stats

```text
Piece Stats:
- Skill: affects move success
- Courage: affects sacrifice and threat response
- Loyalty: affects obedience to risky orders
- Power: affects captures
- Agility: affects movement under pressure
- Will: affects resistance to enemy influence
```

### 5.2 Example Piece Profiles

| Piece | Skill | Courage | Loyalty | Power | Agility | Will |
|---|---:|---:|---:|---:|---:|---:|
| King | 2 | 4 | 5 | 3 | 1 | 5 |
| Queen | 5 | 4 | 4 | 5 | 4 | 4 |
| Rook | 3 | 4 | 5 | 4 | 2 | 3 |
| Bishop | 4 | 3 | 4 | 3 | 3 | 4 |
| Knight | 4 | 5 | 3 | 3 | 5 | 3 |
| Pawn | 1 | 2 | 3 | 1 | 2 | 2 |

These values can be adjusted for balance.

---

## 6. King Influence System

The king should affect nearby allied pieces.

### 6.1 Aura Radius

Recommended radius:

```text
King Aura Radius = 2 tiles
```

Pieces inside the aura receive bonuses based on the king’s base strength.

### 6.2 Aura Modifier

| King Tier | Aura Bonus |
|---|---:|
| Weak | -1 |
| Ordinary | 0 |
| Strong | +1 |
| Heroic | +2 |
| Legendary | +3 |

### 6.3 Example

If a knight attempts a risky capture while within 2 tiles of a Heroic King:

```text
Move Roll = D20 + Knight Skill + Heroic King Aura - Capture Difficulty
Move Roll = D20 + 4 + 2 - 8
```

---

## 7. Rule-Breaking System

The defining feature is that dice rolls can allow chess rules to break.

### 7.1 Rule-Break Trigger

Rule-breaking should be rare and exciting.

Possible triggers:

- natural 20
- roll exceeds threshold by 8 or more
- king is Heroic or Legendary
- piece is under extreme pressure
- move would create a dramatic comeback
- special hidden event is active

### 7.2 Types of Rule-Breaking

| Rule Break | Description |
|---|---|
| Extended Movement | Piece moves 1 extra tile beyond normal range. |
| Defiant Capture | Piece captures even when normal movement would not allow it. |
| Refusal | Piece refuses to move into obvious sacrifice. |
| Loyalty Break | Enemy piece may hesitate or switch allegiance under special conditions. |
| Heroic Guard | Piece intercepts an attack against the king. |
| Phantom Step | Piece ignores blocking for one move. |
| Last Stand | King survives one otherwise fatal capture/checkmate condition. |
| Rally | Nearby pieces receive temporary bonuses. |
| Betrayal | Low-loyalty piece may disobey, freeze, or change side. |

### 7.3 Rule-Break Risk

Rule-breaking should have consequences.

Example penalties:

- fatigue
- morale loss
- cooldown before another special action
- vulnerability next turn
- reduced loyalty
- increased enemy morale

---

## 8. Success and Failure Probability

### 8.1 Probability Model

Each move should calculate a success chance from hidden stats.

Simple approach:

```text
Success Chance = clamp(Base Chance + Modifiers, 5%, 95%)
```

Example:

```text
Base Chance = 70%
Piece Skill Modifier = +5% per Skill point
King Aura Modifier = +5% per Aura point
Difficulty Modifier = -10% to -50%
Threat Modifier = -10% if threatened
```

### 8.2 Suggested Base Chances

| Action | Base Success Chance |
|---|---:|
| Normal move | 90% |
| Capture | 75% |
| Escape | 70% |
| Defend king | 65% |
| Sacrifice | 55% |
| Rule-breaking move | 25% |
| Legendary move | 10% |

### 8.3 Dice-Based Probability Alternative

Instead of direct percentages, use a D20 roll.

Example:

```text
Roll >= 10 means success
```

This gives a 55% success rate before modifiers.

---

## 9. Morale and Loyalty

To make the game feel RPG-like, pieces should behave as if they have willpower.

### 9.1 Morale

Morale changes based on events:

| Event | Morale Change |
|---|---:|
| Allied capture | +1 |
| Allied piece captured | -1 |
| King threatened | -2 |
| King escapes danger | +2 |
| Critical success | +2 |
| Critical failure | -2 |
| Legendary king action | +3 |

### 9.2 Loyalty

Loyalty affects whether a piece obeys risky commands.

Low loyalty may cause:

- hesitation
- refusal
- weakened move
- betrayal event

High loyalty may cause:

- sacrifice acceptance
- heroic defense
- bonus against threats

---

## 10. AI Behavior Implications

The AI should also be affected by hidden rolls.

### 10.1 AI Should Not Always Pick Mathematically Best Chess Move

Because this is RPG-chess, the AI should consider:

- hidden king strength
- piece morale
- probability of move success
- risk of failure
- chance of rule-breaking
- personality of side/faction

### 10.2 AI Move Scoring

Suggested scoring:

```text
Move Score = Chess Value + Tactical Value + RPG Success Chance + Morale Impact + Rule-Break Potential - Failure Risk
```

---

## 11. Player Experience

### 11.1 What the Player Sees

The player sees:

- normal board movement
- unexpected outcomes
- dramatic piece behavior
- mysterious failures
- special visual effects
- flavor text such as “The knight hesitates” or “The king’s command strengthens the line.”

### 11.2 What the Player Does Not See

The player does not see:

- exact dice rolls
- hidden modifiers
- hidden stats
- raw probabilities

### 11.3 Optional Reveal System

After the game, the player may unlock a battle log showing hidden events.

Example:

```text
Turn 12: Knight attempted forbidden capture.
Hidden roll: 19 + 4 Skill + 2 King Aura = 25.
Result: Critical rule-break success.
```

This should be optional.

---

## 12. Suggested Data Structures

### 12.1 King Data

```json
{
  "id": "white_king",
  "baseStrength": 17,
  "tier": "Heroic",
  "auraRadius": 2,
  "auraBonus": 2,
  "morale": 5,
  "will": 5
}
```

### 12.2 Piece Data

```json
{
  "id": "white_knight_1",
  "type": "knight",
  "side": "white",
  "position": "g1",
  "stats": {
    "skill": 4,
    "courage": 5,
    "loyalty": 3,
    "power": 3,
    "agility": 5,
    "will": 3
  },
  "morale": 3,
  "fatigue": 0,
  "statusEffects": []
}
```

### 12.3 Move Resolution Data

```json
{
  "moveId": "turn_8_white_knight_g1_f3",
  "pieceId": "white_knight_1",
  "moveType": "normal",
  "visibleMove": "Ng1-f3",
  "hiddenRoll": {
    "die": "d20",
    "result": 14,
    "modifiers": {
      "pieceSkill": 4,
      "kingAura": 1,
      "threatPenalty": 0,
      "fatiguePenalty": -1
    },
    "finalResult": 18
  },
  "threshold": 5,
  "outcome": "success",
  "ruleBreak": false
}
```

---

## 13. Pseudocode

### 13.1 Game Start

```pseudo
function startGame():
    whiteKing.baseStrength = rollD20()
    blackKing.baseStrength = rollD20()

    whiteKing.tier = determineKingTier(whiteKing.baseStrength)
    blackKing.tier = determineKingTier(blackKing.baseStrength)

    assignAuraValues(whiteKing)
    assignAuraValues(blackKing)

    initializePieceStats()
    beginFirstTurn()
```

### 13.2 Move Attempt

```pseudo
function attemptMove(piece, targetSquare, moveType):
    difficulty = getMoveDifficulty(moveType, piece, targetSquare)
    kingAura = getKingAuraModifier(piece)
    pieceModifier = getPieceModifier(piece, moveType)
    boardModifier = getBoardStateModifier(piece, targetSquare)
    statusModifier = getStatusModifier(piece)

    roll = rollD20()
    finalRoll = roll + pieceModifier + kingAura + boardModifier + statusModifier

    if roll == 1:
        return criticalFailure(piece)

    if roll == 20:
        return checkCriticalSuccessOrRuleBreak(piece, targetSquare, finalRoll)

    if finalRoll >= difficulty:
        return success(piece, targetSquare)

    if finalRoll >= difficulty - 2:
        return partialSuccess(piece, targetSquare)

    return failure(piece)
```

### 13.3 Rule-Break Check

```pseudo
function checkRuleBreak(piece, targetSquare, finalRoll):
    requiredScore = 16

    if piece.king.tier == "Heroic":
        requiredScore -= 1

    if piece.king.tier == "Legendary":
        requiredScore -= 2

    if finalRoll >= requiredScore:
        selectedRuleBreak = chooseRuleBreakType(piece, targetSquare)
        applyRuleBreak(selectedRuleBreak, piece, targetSquare)
        applyRuleBreakCost(piece)
        return true

    return false
```

---

## 14. Balancing Guidelines

### 14.1 Avoid Too Much Randomness

The player should feel surprised, not cheated.

Recommendations:

- Normal legal moves should almost always work.
- Rule-breaking should be uncommon.
- Critical failures should be rare.
- Stronger pieces should feel more reliable.
- King strength should matter, but not decide the whole game instantly.

### 14.2 Suggested Frequency

| Event | Target Frequency |
|---|---:|
| Normal move success | 85–95% |
| Capture failure | 10–25% |
| Rule-break event | 3–10% |
| Betrayal/refusal | 1–5% |
| Legendary event | <1–3% |

### 14.3 Player Trust

Because hidden randomness can frustrate players, add subtle feedback:

- animations
- sound cues
- flavor text
- visual aura around kings
- shaken/empowered piece states
- post-game battle report

---

## 15. Optional Features

### 15.1 Debug Mode

Developer/debug overlay may show:

- current king strength
- piece stats
- hidden roll
- success probability
- rule-break chance
- morale
- loyalty

### 15.2 Campaign Mode

Pieces may persist between games and gain experience.

Possible progression:

- pawns gain courage after surviving captures
- knights gain agility from successful risky moves
- bishops gain will after resisting enemy influence
- kings gain aura power through victories

### 15.3 Faction Personalities

Different armies can have different hidden behavior.

Examples:

- disciplined army: high loyalty, low rule-breaking
- chaotic army: low loyalty, high critical events
- royal army: strong king aura
- undead army: low morale effects, high will
- rebel army: high betrayal chance, high comeback potential

---

## 16. Implementation Checklist

- [ ] Add hidden dice roller utility.
- [ ] Roll each king’s base strength at game start.
- [ ] Convert king strength into tier and aura bonus.
- [ ] Add hidden stats to each piece.
- [ ] Add move difficulty categories.
- [ ] Add hidden move resolution before executing movement.
- [ ] Support success, failure, partial success, critical success, and critical failure.
- [ ] Add rare rule-breaking outcomes.
- [ ] Add morale and loyalty values.
- [ ] Ensure AI uses success probability, not only chess value.
- [ ] Add subtle player-facing feedback.
- [ ] Add optional debug mode.
- [ ] Add optional post-game hidden roll report.

---

## 17. Minimum Viable Version

For a first implementation, only build the following:

1. Hidden D20 roll on game start for each king.
2. King tier assignment.
3. Hidden D20 roll for each move.
4. Success/failure check for captures and risky moves.
5. Natural 20 allows one rule-breaking move type.
6. Natural 1 causes move failure.
7. Optional debug log for testing.

Recommended first rule-break:

```text
On natural 20, a piece may move one square beyond its normal movement range if the destination is valid and not occupied by an allied piece.
```

---

## 18. Design Intent

This feature should make the game feel like:

```text
Chess on the surface.
D&D under the hood.
A hidden battlefield of morale, leadership, luck, and impossible moments.
```

The player should slowly realize that the game is not only about perfect chess logic, but about commanding pieces with hidden personalities, strengths, weaknesses, and dramatic RPG-style turning points.
