# Rule decisions and bounded state

The supplied September 7 brief supersedes the three historical design proposals. The current app preserves ordinary chess presentation and all three opponent modes. There is no separate rules selector, political dashboard, or statistics reveal.

## State and execution

`submitMove` is the only move transition boundary. It validates the intended command before cloning state or drawing. The reducer distinguishes request acceptance, board changes, consumed turns and resolution. A refusal is an accepted mutation with no completed ply; its public event survives retries and reconnects. Political timers advance only on a completed own turn. A second legal command is guaranteed and does not reroll agency.

Seeds are generated once using Web Crypto locally and Node crypto online. `mulberry32-v1` stores three unsigned 32-bit streams (initialization, gameplay, narrative). Narrative currently uses fixed factual templates, so it consumes no randomness. Test draw injection is an internal function dependency, never an API field or environment flag. Search never receives authoritative RNG.

Each nonking piece has a paired seeded personality assignment, integer 0–100 values, immutable identity, current role, and at most 12 memories / 4 relationships. Captured subjects remain compact records and leave active iteration. Relationships use -100–100; at most two pairs per side can be disputed. Per-action aggregate deltas are capped at 15 per subject field and 8 per kingdom field. The private event ring has 256 entries. Public move and event histories intentionally persist for the whole match.

The exchange estimate is deliberately shallow: an undefended attacked piece risks its value; a defended piece risks its value minus the least valuable attacker. Attack maps include empty pawn diagonals and friendly defended squares. This estimate is a small behavioral signal, not a verdict on tactical sacrifices. Retreats choose safer noncapturing legal destinations; ties favor king proximity, exchange safety, and square order. Heroism uses the prototype's signed extra-square geometry, requires both destinations empty, and validates the final king safety. It is capped at one per side.

## Recorded tuning and narrow departures

| Configuration  | Change                                                                                                                                       | Evidence / scope                                                                                                                                                                                                                                                                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `2026-09-07.1` | Original supplied defaults                                                                                                                   | 1,000 games: zero refusals / 95,932 eligible commands; one extension; no invariant failures. Original raw results are retained.                                                                                                                                                                                                                                      |
| `2026-09-07.2` | Agency formula baseline `0.005 → 0.04`                                                                                                       | Same 1,000-game harness: 39 refusals / 96,063 eligible commands (0.041%), 23 repeated orders, 16 alternative orders, one extension. All opening/check guarantees and causal weights retained.                                                                                                                                                                        |
| `2026-09-07.3` | Existing promotion envy can deepen by relationship `-10` after a repeated order into a losing exchange defended solely by the envied subject | Promotion alone affects each pair once by -10 and therefore cannot reach the specified -30 dispute threshold. This additional causal rule makes disputes reachable without adjacency decay into hostility. It applies at most once per completed action; two such coerced orders can turn existing envy into a dispute. A behavioral fixture verifies that sequence. |

The registry retains all three configurations. An existing match stays on its saved version. No plot creation/success probabilities, prerequisites, warning duration, loyalty threshold or regicide target were increased to generate dramatic events.

Other implementation decisions:

- Kings have identity records for board consistency but never participate in obedience, disputes or conspiracies.
- Promotion updates current movement role and skill/power (prototype scale 1–5); it preserves personal courage, memory, relationships and identity.
- The visible position key ignores all politics for draw rights. Meaningless or pinned en-passant opportunities do not distinguish repetition positions. History keys before irreversible chess changes can be discarded safely.
- The legacy adapter disables newly introduced castling/en-passant rights because historical rights were not persisted. It keeps the old D20 behavior and existing king strengths. Historical random draws cannot be recovered; future legacy RNG derives deterministically from the stored state. Corrupted boards with a missing king are rejected, rather than inventing a replacement king.
- Undo restores the complete start-of-turn snapshot, including all RNG streams, events and rights. A pending refusal is cancelled before a previous turn is undone.
- All diagnostics UI was removed; this is stronger than gating an optional diagnostics panel. Private decision facts remain available in developer fixtures and server state.
- The existing nested app is retained but its online option is disabled because it has no API routes. Root app routes and invitation URLs remain supported.
- Browser tests seed rare scenarios directly into their isolated MongoDB database, never through a production fixture/debug endpoint.

## Limits of the evidence

Random and shallow tactical policies exercise invariants and causal stress; they do not measure human play quality. Ordinary self-play did not reach a plot-eligible kingdom. Constructed valid late-game fixtures demonstrate all prerequisites, each committed warning stage, three response turns, failed attempts, successful regicide, and guard/separation/check counterplay. There is no assassination quota.

Browser tests use Chromium at desktop and 320px widths, with keyboard and reduced-motion flows. They are not an exhaustive assistive-technology or device certification. Online verification is database-backed on isolated local MongoDB, not a deployed Atlas/Vercel test. Local browser state cannot be made secret from its owner; enforceable hidden-state privacy applies to server-resolved online games.
