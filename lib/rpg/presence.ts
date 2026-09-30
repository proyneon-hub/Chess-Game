import type { GameState, Side } from "@/lib/game/types";
import { publicEncounters } from "@/lib/rpg/encounters/publicView";

/**
 * A ply "encounters" the RPG layer if any of these is true after it. The
 * first four need only public state, so a UI could reuse them directly; the
 * event-line codes below are private, so classifying `line`/`ambient` needs
 * full GameState access (a script, not a browser client).
 */
export type Channel =
  "card" | "warning" | "hesitation" | "unexpected" | "line" | "ambient";

/**
 * Every public event code an RPG mechanic can write, other than the plain
 * chess "move"/"draw" lines and "ambient" (its own channel). Kept next to
 * presence() so a new mechanic's event code is added in one place and stays
 * in sync with what counts as "the player saw something happen."
 */
export const RPG_LINE_CODES = [
  "refusal",
  "encounterOffer",
  "encounterOutcome",
  "shaken",
  "complaintWarning",
  "plotWarning",
  "plotThwarted",
  "plotFailed",
  "regicides",
] as const;

/**
 * Whether the RPG layer is visibly present after one submitted action
 * (accepted or refused), compared with the state right before it. Pure: it
 * reads both states and returns a fresh result, never mutating either.
 *
 * `hesitation` covers both a per-call use (before/after span exactly one
 * submitMove call) and a per-ply-batch use (before/after span a whole
 * completed turn, skipping over any mid-turn refusal): a pending or just-
 * resolved hesitation is flagged either way.
 */
export function presence(
  before: GameState,
  after: GameState,
): { channels: Set<Channel>; cardSides: Set<Side> } {
  const channels = new Set<Channel>();
  const cards = publicEncounters(after);
  const cardSides = new Set<Side>(cards.map((c) => c.side));
  if (cards.length) channels.add("card");
  if (after.warning) channels.add("warning");
  if (
    after.pendingRefusal ||
    after.lastAction?.resolution === "refused" ||
    (before.pendingRefusal && after.ply > before.ply)
  )
    channels.add("hesitation");
  if (
    after.lastAction?.resolution === "autonomous" ||
    after.lastAction?.special
  )
    channels.add("unexpected");
  if (after.simulation) {
    const lines = after.simulation.privateEvents.filter(
      (e) => e.seq > before.eventSeq,
    );
    if (lines.some((e) => e.code === "ambient")) channels.add("ambient");
    if (
      lines.some((e) => (RPG_LINE_CODES as readonly string[]).includes(e.code))
    )
      channels.add("line");
  }
  return { channels, cardSides };
}
