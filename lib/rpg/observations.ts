import { compareIds } from "./order";
import { KIND_NAMES, squareName, type Side, type Square } from "@/lib/chess";
import type { GameState } from "@/lib/game/types";
import { locations } from "./context";
import { progression } from "./pressure";
import { rulesFor } from "./config";
import { event } from "./events";
import { hasEncounters } from "./capabilities";
import { RPG_LINE_CODES } from "./presence";
export type Observation = {
  kind: "neglect" | "dispute" | "reconciliation" | "trust";
  subjectId: string;
  square: Square;
  message: string;
};
export type RelationshipTransition = {
  kind: "dispute" | "reconciliation";
  a: string;
  b: string;
};
export function relationshipTransitions(
  before: GameState,
  after: GameState,
  side: Side,
): RelationshipTransition[] {
  const transitions: RelationshipTransition[] = [],
    subs = after.simulation!.subjects;
  const close = rulesFor(after).progression!.disputeClose;
  for (const a of Object.values(subs).filter(
    (s) => s.side === side && s.status === "active",
  )) {
    for (const [id, r] of Object.entries(a.relationships)) {
      if (a.id >= id || subs[id]?.status !== "active") continue;
      const old = before.simulation!.subjects[a.id]?.relationships[id];
      if (r.disputed && !old?.disputed)
        transitions.push({ kind: "dispute", a: a.id, b: id });
      // Missing links, eviction, capture and administrative cap removal do not
      // establish improved relations. A surviving pair must actually recover.
      if (
        old?.disputed &&
        !r.disputed &&
        r.score > old.score &&
        r.score > close
      )
        transitions.push({ kind: "reconciliation", a: a.id, b: id });
    }
  }
  return transitions.sort(
    (a, b) => compareIds(a.a, b.a) || compareIds(a.b, b.b),
  );
}
export function relationshipObservations(
  before: GameState,
  s: GameState,
  side: Side,
): Observation[] {
  const pos = locations(s),
    subs = s.simulation!.subjects;
  const label = (id: string) =>
    `${KIND_NAMES[subs[id].currentKind]} at ${squareName(pos[id])}`;
  return relationshipTransitions(before, s, side).map((t) => ({
    kind: t.kind,
    subjectId: t.a,
    square: pos[t.a],
    message:
      t.kind === "dispute"
        ? `The ${label(t.a)} and ${label(t.b)} are at odds after their recent orders.`
        : `The tension between the ${label(t.a)} and ${label(t.b)} eases.`,
  }));
}
/** One selector, stable priority and no random draws. At most one observation. */
export function emitObservation(
  s: GameState,
  side: Side,
  candidates: Observation[],
) {
  const cfg = rulesFor(s).progression!,
    p = progression(s),
    own = s.simulation!.kingdoms[side].ownTurnsCompleted;
  if (
    s.ply <= rulesFor(s).grace ||
    own - p.sides[side].lastAmbient < cfg.ambientSideCooldown
  )
    return;
  const priority = ["dispute", "reconciliation", "neglect", "trust"];
  const choice = [...candidates]
    .sort(
      (a, b) =>
        priority.indexOf(a.kind) - priority.indexOf(b.kind) ||
        compareIds(a.subjectId, b.subjectId),
    )
    .find(
      (c) =>
        own - (p.subjects[c.subjectId].ambient[c.kind] ?? -100) >=
        cfg.ambientSubjectCooldown,
    );
  if (!choice) return;
  p.sides[side].lastAmbient = own;
  p.subjects[choice.subjectId].ambient[choice.kind] = own;
  event(s, "ambient", choice.message, {
    square: choice.square,
    subjectId: choice.subjectId,
  });
}

/**
 * v6 (ambientFlavor): surfaces the trust/neglect facts leadership already
 * collected every turn (previously discarded past v4) plus this turn's
 * relationship transitions, but only to fill an otherwise-silent ply. Never
 * piles onto a real event, and never speaks for a piece whose own card
 * already does. emitObservation still applies its side/subject cooldowns and
 * priority order, so this can only ever add one line.
 */
export function ambientFlavor(
  before: GameState,
  s: GameState,
  side: Side,
  observed: Observation[],
  sinceSeq: number,
) {
  if (!s.simulation) return;
  const spoke = s.simulation.privateEvents.some(
    (e) =>
      e.seq > sinceSeq &&
      (RPG_LINE_CODES as readonly string[]).includes(e.code),
  );
  if (spoke) return;
  const busy = new Set(
    hasEncounters(s.simulation)
      ? s.simulation.encounters.active.flatMap((e) => e.participants)
      : [],
  );
  const candidates = [
    ...observed,
    ...relationshipObservations(before, s, side),
  ].filter((o) => !busy.has(o.subjectId));
  emitObservation(s, side, candidates);
}
