# Replaying visible encounters

Use the frozen source identified by each report. Commands below rebuild the game
from a normal initial board and its seed, submit the recorded legal intentions,
and compare every public event and action revision. They do not preload politics,
force RNG, or bypass the reducer.

```sh
npx tsx scripts/replay-encounter-trace.ts docs/v5-encounters/freeze7-board-ordinary/340000-0.json.gz
npx tsx scripts/replay-encounter-trace.ts docs/v5-encounters/freeze7-board-protective/341001-0.json.gz
npx tsx scripts/replay-encounter-trace.ts docs/v5-encounters/freeze7-board-mistreatment/342002-0.json.gz
npx tsx scripts/replay-encounter-trace.ts docs/v5-encounters/freeze7-board-mistreatment/342020-0.json.gz
```

All four commands were run successfully. The ordinary game has 166 completed plies:
Black's bishop requests development at ply 10 and fulfills it at ply 12. A shared
pawn/rook petition appears at ply 40 and is answered at ply 43. Later opportunities
can expire or be interrupted by changes in the position; these are not counted
as successful responses.

The protective game has 125 completed plies. White fulfills an initiative at ply
17. Shared petitions appear from ply 54, with responses at plies 55 and 71.
Renewed resolve appears at plies 88 and 108, followed by responses at 91 and 109.
Its counters record one actually applied steady modifier and one actually applied
support modifier. These are gameplay consumers, not merely token creation counts.
The recorded verification output is `replays/verified-protective-341001.json`.

The board-only mistreatment game 342002/0 has 124 completed plies. A rook's strain
warning appears at ply 58. At ply 68, an order from a6 to a8 instead produces a
warned withdrawal to d6; both intended and actual squares remain in public history.
This is one of twelve distinct retreat seeds in the 200-game mistreatment cohort,
not a substitute for the separately required 500-game pressure gate.

Game 342020/0 reaches a complaint at ply 54, renews it after continued harm at
ply 57, and recovers at ply 59. A different complaint appears at 60 and recovers
at 62. Later harm creates another at 66 and its second stage at 71. The game
reaches the 240-ply harness cap without an assassination attempt. The trace also
contains disputes and mechanically effective mediation. These normal-start paths
establish that recoverable political consequences work; the aggregate pressure
frequency targets remain independently measured and can still fail.

The browser suite separately plays a ten-ply opening with visible controls,
fulfills the displayed bishop's request, and restores it with Undo. The screenshot
`visible-request.png` shows the compact request beside the ordinary chessboard.
Online protection and dispute/mediation browser scenarios use isolated preloaded
fixtures. Their assertions establish behavior, not natural occurrence frequency.

## Selected cooperative escalation

```sh
npx tsx scripts/replay-encounter-arc.ts 42 <new-output-file>
```

This is deliberately cooperative and must not be pooled with normal policy
cohorts. The freeze-7 run reached 240 plies, 26 disputes, seven complaints, one
second-stage complaint, and one plot with all three warnings. The plot ended
because its leader was too far from the king. It produced no assassination
attempt and no retreat. Earlier seeds and source snapshots are retained, but
their outcomes are not claims about the frozen candidate.

Human observation is still pending under `playtesting.md`. No automated replay
establishes whether an uninformed person understood causality or counterplay.
