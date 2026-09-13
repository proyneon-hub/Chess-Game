# V5 encounter implementation

Work is local on `feat/meaningful-v5-encounters`; no publication is authorized.
New games use schema 5, `hidden-kingdom-v5`, config `2026-09-10.1`.
All v2/v3/v4 configurations retain their recorded rules. Twenty-one pre-change
v4 replay goldens supplement the existing historical goldens.

## Pipeline and effects

The existing reducer remains authoritative in local, computer and online play.
Intended responsibility still comes from `factsV4.ts`; actual board consequences
are separate. Encounter objectives are typed data evaluated against legal board
projections. Forecasts cannot award effects, advance deadlines or draw real RNG.

Leadership and encounter effects share a revision ledger and one final delta cap
for v5 (12 per subject field, 6 per kingdom field). Personal requests have three
response turns; petitions have four. Check escapes extend the affected response
window. Refusal and invalid submissions never enter encounter resolution.

The deterministic director first becomes due at ply 10, uses six-ply cadence,
four-ply minimum spacing, three-own-turn side spacing, and six-own-turn subject
spacing. It requires a legal practical response. Two-step separation is accepted
as a response path, with the second eligible turn required for success.

The public request area shows current piece labels, ordinary-move responses,
remaining response turns and outcomes. Public DTOs allowlist these fields; private
objectives, harm references, modifiers and RNG remain private. No new transport
actions, debug URLs, mode selectors or political action buttons were introduced.

## Families

- Initiative/confidence: safe action earns morale +4, loyalty +2 and two eligible
  turns of steady cooperation (-0.03 refusal probability).
- Protection/relief: factual reduction of danger or a different piece assuming
  a real defensive duty. Base leadership rewards are not duplicated. Support is
  one-use, pair-limited and expires after six own turns.
- Strain: current danger plus fear 40 and two recent danger observations. Warned
  withdrawal requires fear 50, an unsafe order, a strictly safer legal noncapture
  move and a completed eligible response turn. Chance 3–6%, side spacing eight
  own turns, maximum two per side. Second commands and check escapes are exempt.
- Dispute: old recorded friction, recorded favoritism or distinct harmful actions
  involving an actual related subject. Mediation improves the relationship by 12
  and reduces each participant's resentment by 3. Unresolved dependent orders may
  receive a temporary +0.04 refusal modifier; ordinary legality is unchanged.
- Petition/solidarity: positive bonds support a visible shared objective. Success
  improves legitimacy and participant loyalty by 2 and grants shared support.
  Renewed loyal-court offers require a sufficiently loyal, non-tyrannical court.
- Complaint: surviving causal participants and two distinct harmful revisions,
  separated by at least three own turns, tyranny 25 and legitimacy at most 55.
  Recovery changes tyranny by -4 and legitimacy by +3. Continued harm can produce
  a second complaint after two response turns.
- Conspiracy: only after ply 64, a second unresolved complaint and continued harm,
  with v4 participant/government requirements. V5 counts distinct grave harmful
  action revisions, including separate qualifying neglect of a long-lived hazard.
  Existing three persistent warnings, response turns, guards, separation, recovery,
  king safety and ordinary terminal precedence remain required.

## Measurement status

Reports are immutable snapshots of the implementation under test, not release
claims. Source snapshots and hashes accompany the later development cohorts.
The initial smoke/probe reports predate source-snapshot instrumentation and are
diagnostic only. Freeze 7 completed 3,600 normal-start games: 1,500 calibration,
1,500 independent holdout, and 600 across the three board-only policies.
All seven cohorts have zero recorded invariant failures. Full product acceptance
is false; see `results.md`, `acceptance.json`, and `reviewer-notes.md`.

The first 1,000-game aware cohort met early-discovery, early-resolution, offer-count,
family-variety and ordinary-disruption targets. Early pressure probes failed
conflict, withdrawal and assassination-attempt targets. These failures prompted
causal-route, multi-turn feasibility and scheduling fixes; they are not discarded.

The frozen ordinary holdout has 100% discovery by ply 16 and 95.79% mechanical
resolution by ply 24 among games reaching those checkpoints. The pressure holdout
has only 1.04% conflict by ply 64 and no retreats or assassination attempts.
Shared-concern-only petitions remain incomplete. Raw pacing gaps are reported;
eligible-only gap analysis is not claimed complete.

Human playtesting has not occurred. Browser automation is reported separately:
216 unit/integration tests and all 17 browser tests passed, along with type,
lint, formatting and production-build checks. No deployment or live verification
was performed for this branch.
