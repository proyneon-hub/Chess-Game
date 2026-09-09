# Replay walkthrough and human playtest

## Evidence categories

`natural-replay-110456/raw.json` records a normally initialized, seeded pressure
game. No gameplay rolls or political values were injected. The pressure player
reads its own private politics; this is diagnostic pressure, not an uninformed
human. Its opponent samples eight legal tactical moves. The replay was selected
from development data and is **not additional independent frequency evidence**.

`tests/unit/responsibility.test.ts`, `court-v4.test.ts` and the browser database
fixtures deliberately construct positions or rolls. They establish branch
correctness, never natural rarity. Historical cooperative v3 replays remain
separate. The board-only suites use legal position, repetition, visible pending
refusal and a separate policy RNG; they cannot read political attributes.

## Naturally reached attempt: seed 110456, Black pressure

| Ply | Observation / transition | Counterplay still available |
|---|---|---|
| 16 | Knight f6 remains exposed after another order passes it by | Protect or move the threatened piece |
| 34 | Knight f6 and pawn g7 are at odds after their recent orders | Reduce dependence on the disputed pair; allow recovery |
| 80 | Bishop f5 turns away from its king; gathering begins, king distance 3 | Capture a participant, separate the pair, repair leadership or add loyal guards |
| 82 | Bishop e6 and pawn d5 confer; preparing, distance 2 | Both sides have acted since the previous warning |
| 84 | Third warning: the king's own court is turning against him; armed | No attempt on this warning turn |
| 86 | Bishop e4 remains outside attempt range; one deferral | Distance prevents an attempt |
| 88 | Bishop g6 comes within two squares; fully warned attempt fails | King remains physically on the board; ordinary play continues |

The recorded warning own-turns are 40, 41 and 42. Resolution occurs on Black's
44th completed turn. Both conspirators survive to that point; no loyal guard is
within the guard radius. This is one seed, so it alone does not satisfy the
requirement for attempts in multiple pressure seeds.

Run `npm test -- tests/unit/natural-v4.test.ts` to replay every recorded command
through the shared reducer without overriding RNG. To regenerate independently,
use a new output directory:

```sh
node --import tsx scripts/simulate-balance.ts --config 2026-09-09.1 --suite pressure --games 2 --seed-start 110456 --trace-seed 110456 --out docs/readable-politics/my-replay
```

## Human playtest — pending

No human session has been performed for this branch. Automated browser tests and
policy simulations must not be entered as human results. Use the local production
build from the verified branch; publishing a release is not required.

1. Ask participants to play ordinary local and computer games without describing
   hidden statistics. Record version, mode, completed plies and any hesitation or
   autonomous action they notice. Do not select a seed to force an outcome.
2. Have participants play a second game where they decide how to respond after
   hesitation, exposure or relationship observations. Record actual commands.
3. Ask: What did you notice? What seemed to cause it? Which response did you think
   would help? Were warning stages distinct from the final consequence?
4. Offer the documented replay separately to evaluate warning comprehension and
   counterplay. Label it a selected replay, not naturally discovered by that human.
5. Record non-discovery, misunderstandings and incomplete games as observations.
   No political-event minimum should be fabricated by preloading the live session.

| Session | Build | Mode / plies | Agency noticed | Cause understood | Counterplay identified | Status |
|---|---|---|---|---|---|---|
| No participants yet | — | — | Not measured | Not measured | Not measured | Pending |
