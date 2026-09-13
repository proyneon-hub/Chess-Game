# Human playtesting — pending

No human participants have tested this candidate. Automated browser operation
does not count as human testing.

## Uninformed session

Give the participant the ordinary opponent screen and ask them to play chess for
at least 32 moves if the game continues. Do not explain the encounter system first.
Record when they first notice agency, what they believe caused it, whether they
identify a useful ordinary-move response, and whether it interrupts their plan.
Ask them to describe the relationship between an offer and its later outcome.

## Instructed response session

Ask another participant to fulfill one initiative request, protect or relieve a
piece, let a neutral request expire, and compare those outcomes. Later, ask them
to mediate a disagreement or respond to a petition. Record whether they can
identify participants, the deadline, competing choices and a useful response.
For a warned court conflict, ask what counterplay they believe remains available.

Record actual moves and observations, including misunderstandings. Ask whether
later encounters felt more complex than early requests, without suggesting an
expected answer. Report discovered problems separately from automated assertions.

## Automated visible checks

The browser suite operates real board controls for normal-start discovery,
fulfillment, neutral expiry, undo, mobile layout, worker cancellation and recovery.
Separate isolated online fixtures cover effective protection, contextual refusal,
Repeat order, mediation, duplicate submission and reconnect. Fixtures are not
shipped as public scenario URLs and are not natural-frequency evidence.

## Reproducible paths

`npx tsx scripts/replay-encounter-arc.ts 5 <new-output-file>` replays an explicitly
cooperative normal-start path with real gameplay RNG. Seeds 5, 25 and 77 have
demonstrated warned withdrawal and deeper disputes/complaints during development.
These selected replays demonstrate reachability, not occurrence frequency.

Unforced cohort traces are stored as gzip-compressed JSON. They contain intended
moves, actual public events, outcomes and court-stage diagnostics. They can be
replayed from the recorded seed/config through `submitMove`; no hidden state is
injected. The independent holdout summaries, once complete, are the frequency
evidence for the frozen candidate.
