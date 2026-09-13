# V5 reviewer notes

This branch implements playable requests with ordinary-move responses in local,
computer, and online games. It is not ready to claim full product acceptance:
deeper pressure progression remains below target, and human playtesting is pending.

## Changed code

- `lib/rpg/encounters/`: typed private records, legal objective evaluation,
  deterministic global scheduling, effects and cooldowns, response resolution,
  strict validation, and public copy/allowlists.
- `lib/game.ts`, game types/validation/public state, and RPG config/initialization:
  schema-5 routing and atomic persistence. Older matches retain their recorded
  rules. V4 intention-versus-actual attribution remains the responsibility source.
- RPG forecast, agency, leadership, relationships, court eligibility and conspiracy:
  bounded modifiers, warned withdrawals, causal complaints, and the three-warning
  assassination path. No increase to assassination-success odds.
- `lib/ai/`: own-side encounter projection, shared response evaluation, deadline
  and multi-turn obligations, legal-response shortlist, and refusal restraint.
- `components/chess/EncounterArea.tsx` and `components/ChessBoard.tsx`: compact
  public requests, response windows, outcomes, and deduplicated announcements.
- New unit, compatibility and browser fixtures; pre-change v4 goldens; normal-start
  measurement, diagnostic, replay, AI benchmark and gate-reporting scripts.

## Verification

The frozen implementation passed 216 unit/integration tests, 17 browser tests,
TypeScript, ESLint, formatting and a production build. Browser coverage includes
mobile expiry, normal-start fulfillment and undo, online protection, contextual
refusal/Repeat, mediation, duplicate submission, reconnect, and worker recovery.
An earlier browser worker crashed before one test executed; later complete runs
passed. No skipped test is counted as passed.

Eight synthetic AI benchmarks returned legal moves without mutating input state.
Normal took approximately 61–180 ms; advanced took 849–1,017 ms under concurrent
simulation load. Advanced sometimes completed depth two within its soft budget;
the court fixture completed depth four. These are local timings, not production
latency guarantees. See `ai-performance-freeze7.json`.

Frozen cohort measurements and gates are generated into `acceptance.json` and
`results.md`. Raw traces and source hashes remain in each cohort directory.
Earlier failures, superseded candidates, and explicitly interrupted freeze-6
runs are retained. Raw inter-start intervals include ineligible/check intervals;
an eligible-only interval analysis is not claimed complete.

## Remaining acceptance work

The sustained-pressure policy seldom retains a suitable causal pair long enough
to progress: dangerous subjects/supporters are captured, and surviving pairs
often lack a materially dependent legal order. Kingdom/grievance thresholds then
block late escalation. The separate board-only mistreatment policy reaches more
disputes, complaints and withdrawals, but does not establish the required frequency
or assassination-attempt minimum. Selected cooperative replays and forced branch
tests are not substitutes for those gates.

The specified factual prerequisites and safety/counterplay rules were preserved.
No incident was manufactured to satisfy a quota. Full product acceptance remains
unresolved even though early encounters and supportive/recoverable arcs work.
Petition selection currently requires a positive relationship; the separate
shared-concern route without a positive bond remains an implementation gap.
Human uninformed and instructed playtest protocols are in `playtesting.md`.

No v5 commit, push, merge, deployment or live production verification was performed.
