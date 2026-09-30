# Retiring v1 (the original D20 prototype)

## Why

`lib/rpgChess.ts` carries ~480 dedicated lines for schema 1, the original
D20 prototype ruleset. No new game can create a schema-1 match - `rulesFor`
only maps `legacy-v1`/`legacy-safety-1` to `V2_CONFIG` for matches that
already exist - so this is dead weight for every game created since v2
shipped. It's kept only because some already-saved matches still reference
it, and retiring the code without first guaranteeing every one of those
matches is gone would turn an in-progress legacy game into a 500 instead of
a clean "match not found."

## The TTL problem

The `expiresAt` TTL index (`models/GameMatch.ts`, added 2026-09-21) only
covers matches written since then - `expiresAt` refreshes on every write, so
a match saved before the field existed has no expiry and never ages out on
its own, no matter how idle it is. Retiring v1 safely means every match
existing before that date needs an expiry dated first, then a real 30-day
wait (plus a buffer) for the TTL monitor to actually delete the stale ones.

## Running the backfill (O1)

```sh
# Dry run - prints counts, writes nothing
npm run backfill:match-expiry

# Apply - --confirm must exactly match the connected database's name
npm run backfill:match-expiry -- --apply --confirm <dbName>
```

The script aborts without writing if the `expiresAt` TTL index isn't present
on the target database (deploy `main` first - it declares the index). It
prints a before/after `reportMatches` breakdown and, after applying, the O2
gate date (`expiresAt` + 1 day, to cover TTL-monitor delay and timezones).

This applies the retention policy to *all* undated matches, including
v2-v4 games nobody has touched since before the TTL index existed - not just
legacy ones. That's consistent with the policy already documented in
`lib/serverMatches.ts`, but it does mean those older, otherwise-untouched
games become deletable on the same clock once backfilled.

### Run log

| Date | Operator | Database | Total | Missing expiry (before) | Legacy | Gate date |
| ---- | -------- | -------- | ----- | ------------------------ | ------ | --------- |
|      |          |          |       |                           |        |           |

## O2 gate

Both of the following must hold, and both are checked and recorded here
before O2 (deleting the v1-specific code) starts:

1. **Today is on or after the gate date** the backfill run printed.
2. **A fresh dry run of `backfill:match-expiry` reports `legacy: 0`.**
   Nobody is still mid-game on a legacy match - the TTL delete already ran,
   or there were never any legacy matches to begin with.

If (2) fails on the gate date, wait and re-check; don't force it. O2 is a
correctness gate, not a schedule.

## O2 checklist (once gated)

- Extract `initializePieceIds`/`PieceIdBoard` into `lib/game/pieceIds.ts`;
  delete `lib/rpgChess.ts` (~480 of its 497 lines are legacy-only); update
  its ~5 importers.
- `lib/game/migrate.ts` shrinks to: not-a-record or `schemaVersion`
  missing/1 -> throw `RetiredStateError` (a subclass of
  `IncompatibleStateError`, so `serverHttp.ts`'s 409 mapping needs no
  change); otherwise `validateState` + clone.
- `lib/game/validation.ts`: schema range becomes `(2, 6)`; delete
  `checkLegacy` and its call site.
- `lib/rpg/config.ts`: delete the `legacy-v1`/`legacy-safety-1` ->
  `V2_CONFIG` mapping in `rulesFor`.
- `lib/rpg/capabilities.ts`: delete `BY_SCHEMA[1]`.
- `lib/game/types.ts`: delete `rpgState`/`legacyRng` fields and the schema-1
  union arm.
- `lib/game.ts`: delete the legacy-only branches (~20 lines across a few
  spots).
- `scripts/capture-v2-goldens.ts`: remove the legacy capture block so it
  can't reintroduce legacy records.
- Tests: `historical.test.ts` filters out its 2 `legacy-safety-1` records
  (don't touch the golden JSON itself); `baseline.test.ts` drops its 2
  D20-specific tests; `online.test.ts`'s legacy-replay test becomes "an
  unversioned/schema-1 match returns 409 with the retired message,
  unchanged in storage."
- Local saves need no code change - `loadLocalGame()` already self-clears on
  any validation failure.
- Verification: v2-v5 and later-config replay-fingerprint pins unchanged;
  `pre-v3.json`'s v2 records, `pre-v4.json`, `pre-v5.json` pass unedited;
  full suite + e2e; ~600 lines removed.
