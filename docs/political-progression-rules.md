# Political progression rules

This local implementation follows `CHESS_RPG_IMPROVEMENTS_CODEX.md`. The older [Hidden Kingdom rules](hidden-kingdom-rules.md) still describe saved v2 matches. No deployment or database rewrite is part of this change.

## Match versions

New games use schema 3 / `hidden-kingdom-v3`. `lib/rpg/config.ts` contains immutable, explicit configurations `2026-09-08.1` onward. Every behavioral consumer resolves the saved match's configuration. The three `2026-09-07.*` configurations retain their formulas, initialization and RNG behavior. Unversioned saves retain the legacy adapter. Unsupported schema/rules/config combinations fail validation without modifying the save.

The initial v3 candidate implements the supplied starting coefficients. Later candidates change only the values listed in the [implementation ledger](political-progression-implementation.md) and [configuration snapshots](progression/configurations.json). They do not increase plot, assassination or heroic-extension odds.

## Causal pressure

`facts.ts` derives facts without mutation or randomness. Avoidable exposure requires at least 100 centipawns of residual shallow exchange loss, and a legal alternative for that same subject reducing loss by at least 100. Check escapes, check-giving commands, promotion and favorable exchanges are exempt from blame. The shallow exchange estimate is deliberately bounded; it is not a proof of a deep tactical sacrifice.

Each subject retains at most six episodes, with one open avoidable-exposure episode. An episode records stable identity, opening square, attacker/defender identities, source revision, own-turn timestamps and distinct causes. Moving defenders or changing attackers does not manufacture a new open episode. Continued neglect needs a persistent threat, a safer legal alternative and a nonforcing command to another subject. At most two subjects are penalized, in stable ID order, once per three own turns. Repeated risk has a four-own-turn cooldown. Coercion is the accepted repeat of a refused command, not a transport retry.

Rescue requires a genuinely established episode and a full safe own-turn boundary; immediate danger/rescue oscillation earns nothing. Protection must add an effective defender and lower exchange loss. Episode reward flags and attacker-source memories prevent repeated rewards for the same protection. Witness blame requires recorded avoidable danger and an existing positive bond; at most two nearby witnesses receive blame. Capture fear is applied once. All combined changes are capped at 12 per subject field and 6 per kingdom field per completed action.

The first eight completed plies accumulate no adverse subject changes, episodes or ambient clues. Own-turn clocks advance, so no deferred batch of mistreatment appears after grace. Captures during the opposing turn timestamp witnesses and close the victim's episode using the victim side's clock. Closed episodes expire after the saved configuration's grave-history window; memories have explicit expiry. The live episode remains bounded to one until danger ends or its subject is captured.

## Attributes, agency and disputes

Cohesion adjusts fear recovery and social reactions by at most one, and refusal by at most one percentage point. Prestige adjusts morale events by at most two and refusal by at most half a percentage point. Morale has a bounded two-point probability effect. Skill lowers noncapture refusal and power lowers capture refusal, including en passant, by at most half a percentage point each. Ambition affects rivalry sensitivity and court eligibility. These attributes do not change ordinary move legality.

`forecast.ts` computes the same pure probability distribution used by the resolver and AI. A single gameplay draw selects execution, refusal, retreat or heroism. Calm commands are capped; trusted commands can have zero refusal probability. Kings, check escapes, grace and every valid second command after refusal are guaranteed. Retreat requires meaningful danger and a safer legal destination, with a four-turn cooldown and at most two per side. Heroic extensions retain the existing one-per-side budget.

Risk friction requires a proud/ambitious subject, sufficient resentment, two distinct recent danger episodes depending on the same sole defender, and a pair cooldown. Disputes require recorded friction or promotion envy, open at -20 and close above -10. There are at most two active disputes per side. Meaningful protection/rescue and sustained separation can reconcile a pair. A relationship score change alone is never narrated as a refusal or betrayal.

## Conspiracy and counterplay

Court entry still requires the late phase, an adverse government, a qualifying nonking leader and accomplice within three squares, two distinct recent grave episodes for the leader and one for the accomplice, and the same pair qualifying on two consecutive own turns. Only coercion, repeated risk and neglect supply grave causes; one repeatedly updated episode is still one history. Calm ordinary subjects cannot qualify solely because a statistical threshold was lowered.

An eligible turn has the unchanged .02 plot lottery. Three separate warning stages and response turns precede any attempt. Existing king movement, guards, separation, capture, leadership recovery, check deferral and terminal precedence remain in force. Recovery thresholds use hysteresis relative to the saved candidate's entry values. Kings remain on the board even when an explicit regicide result ends a match. Zero natural attempts cannot estimate assassination success probability; forced branch fixtures cover those paths separately.

## AI, feedback and privacy

After refusal, v3 AI compares legal alternatives with repetition using tactical scores and a deterministic leadership projection. A near-equivalent alternative within 75 centipawns can preserve trust; a forced win can justify repeating. The projection receives own-side politics and public board information, constructs neutral enemy subjects from visible pieces, and receives no gameplay RNG or enemy hidden attributes. Its temporary dummy RNG never advances the match. v2 retains its automatic-repeat behavior. Worker failure selects another legal command when available; revision/restart/leave cancellation remains active.

The production UI keeps ordinary chess controls. Ambient clues are factual and limited to one per side per four own turns and one per subject/kind per six. Refusals and warnings remain essential events independent of move history. Choose opponent clears old game messages and cancels the old computer turn.

Online episodes, attributes, forecasts, participant identities and RNG stay behind the nested public allowlist. A MongoDB compare-and-swap commits politics, board, RNG and the action receipt together. Duplicate IDs replay an acknowledgement; stale or concurrent losing intents do not apply another effect. Local undo restores the entire start-of-turn state, including pressure, cooldowns and random streams. Local concealment is experiential; browser memory is inspectable.

## CLI walkthrough

Run `npx tsx scripts/replay-progression.ts`. It starts from normal-board seed 20000 with candidate `.1`, replays the checked-in legal commands and prints the first exposure, neglect, protection, dispute and eligible-court milestones. It forces ordinary execution and suppresses the plot lottery. This is **scripted cooperative causal reachability**, not natural event-frequency evidence.

Run `npx vitest run tests/unit/natural-progression.test.ts` to verify both `.1` and the selected default, plus the protective/neglectful fork. `court-v3.test.ts` uses explicitly constructed hostile states and forced rolls to cover rare terminal branches. The pressure suite uses unmodified seeded gameplay against a shallow tactical opponent; its observations and raw causal traces are a separate evidence category. No public scenario endpoint or debug query switch exists.
