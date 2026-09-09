# Responsibility and readable politics implementation

The shared reducer retains the player's normalized intention and records the
agency resolver's explicit `obeyed`, `retreat` or `heroic` outcome internally.
Schema 4 leadership derives command responsibility from a counterfactual intended
board and physical consequences from the actual board. This does not recursively
run the reducer or advance RNG. Legacy, v2 and all six v3 configurations continue
through their original rules; 48 pre-change v3 full-result hash sequences and the
older historical goldens verify this boundary.

## Responsibility rules

- A safe order followed by autonomous danger produces physical fear/fatigue and
  a private hazard, without a loyalty/resentment penalty or player-harm episode.
- Explicit avoidable danger keeps the existing bounded penalty. If retreat
  avoids the danger, the command grievance is immediately closed and does not
  pretend that physical exposure occurred.
- Neglect requires danger before the command, after the intended command and on
  the actual board, plus an available safer move. A later qualifying order can
  neglect a private autonomous hazard; the hazard itself is never grave history.
- Protection requires an actual improvement. Unexpected autonomous protection
  credits the helpful piece's relationship and physical relief, while omitting
  player leadership/loyalty rewards. Existing cooldowns and episode reward flags
  prevent farming. Autonomous escape closes the live episode without awarding a
  later accidental rescue reward.
- Captures use the actual board and the victim's own-turn clock. They clear a
  captured subject's hazard. Histories remain bounded at six episodes, twelve
  memories, four relationships and one nullable hazard per subject.

`lib/rpg/factsV4.ts` composes the existing pure fact derivation with intended and
actual contexts; `leadershipV3.ts` applies the version-gated facts. The file name
is retained because v3 and v4 share the bounded subject update machinery. V4 AI
projections preserve the same schema/configuration and attribution path while
substituting neutral enemy data and omitting real RNG state.

## Feedback

V4 check text is appended to the action explanation. Terminal results remain the
main status; the move/event history retains the causal explanation and the public
event's intended/actual squares. Older saved rules retain their historical text.

Relationship observations compare surviving pairs across a completed action.
Opening disputes can be observed; reconciliation requires an actual score
improvement across the close threshold. Capture, eviction and administrative
dispute removal are silent. Refusal names a rival only when it is the command's
sole disputed defender. The common ambient selector uses stable category/subject
ordering, a four-own-turn side cooldown and a six-own-turn cooldown for the
observation's subject/category. It emits no opening clues and consumes no RNG.

Public action requests and DTO fields are unchanged. Private hazard, fact,
forecast, diagnostic and relationship identities never enter the public DTO.
The UI retains local, computer and online choices with no RPG selector or hidden
statistics. The simulation diagnostics and candidate selection exist only in
CLI tools, not the production interface.

## Measurement and decisions

Metrics v5 added read-only transitions and separate board-only policies. Metrics
v6 corrects the opening classifier to allow ordinary checkmate/stalemate/draw
terminal resolutions. The original false-positive report remains archived and
is explicitly marked superseded in acceptance reporting. No gameplay changes
were made to correct that measurement.

Six immutable bounded candidates were evaluated: four individual changes and two
combinations. None passed the declared natural retreat/attempt screen, so new
games retain corrected `.1` without balance tuning. This is the approved fallback,
not a claim that deeper progression is solved. See the [ledger](tuning-ledger.md),
[raw acceptance](acceptance.json), [results](results.md), and [replay and human
playtest protocol](replay-and-playtest.md).
