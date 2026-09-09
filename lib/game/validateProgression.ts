import type { GameState } from "./types";
import { validSquare } from "@/lib/chess";
// Independent structural validation: no importing game constructors/defaults.
export function validProgression(s: GameState): boolean {
  if (!s.simulation || s.simulation.schemaVersion === 2) return false;
  const p = s.simulation.progression,
    sim = s.simulation;
  const object = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object" && !Array.isArray(v);
  const int = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) =>
    Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max;
  const causes = [
    "avoidable_exposure",
    "neglected_under_threat",
    "repeated_risky_order",
    "coerced",
    "blamed_loss",
  ];
  if (
    !object(p) ||
    !object(p.subjects) ||
    !object(p.sides) ||
    Object.keys(p.subjects).length !== Object.keys(sim.subjects).length
  )
    return false;
  const ids = new Set<string>();
  for (const [id, sub] of Object.entries(sim.subjects)) {
    const q = p.subjects[id],
      own = sim.kingdoms[sub.side].ownTurnsCompleted;
    if (
      !object(q) ||
      !Array.isArray(q.episodes) ||
      q.episodes.length > 6 ||
      !object(q.ambient) ||
      Object.keys(q.ambient).length > 4
    )
      return false;
    if (sim.schemaVersion === 4) {
      const h = q.hazard;
      if (
        h !== null &&
        (!object(h) ||
          Object.keys(h).sort().join() !==
            "openedOwnTurn,sourceActionRevision,square" ||
          !validSquare(h.square) ||
          !int(h.openedOwnTurn, 0, own) ||
          !int(h.sourceActionRevision, 0, s.revision) ||
          sub.status !== "active" ||
          sub.currentKind === "k")
      )
        return false;
      if (
        Object.keys(q.ambient).some(
          (k) => !["neglect", "dispute", "reconciliation", "trust"].includes(k),
        )
      )
        return false;
    } else if ("hazard" in q) return false;
    if (
      ![
        q.lastHarm,
        q.lastExposure,
        q.lastRepeated,
        q.lastNeglect,
        q.lastProtection,
        q.lastRetreat,
        ...Object.values(q.ambient),
      ].every((n) => int(n, -100, own))
    )
      return false;
    if (
      q.episodes.filter(
        (e) => e.closedOwnTurn === null && e.cause === "avoidable_exposure",
      ).length > 1
    )
      return false;
    for (const e of q.episodes) {
      if (
        !object(e) ||
        typeof e.id !== "string" ||
        e.id.length > 160 ||
        ids.has(e.id) ||
        e.subjectId !== id ||
        !causes.includes(e.cause) ||
        !Array.isArray(e.causes) ||
        e.causes.length > 5 ||
        new Set(e.causes).size !== e.causes.length ||
        !e.causes.every((c) => causes.includes(c)) ||
        !validSquare(e.squareAtOpening) ||
        !int(e.openedOwnTurn, 0, own) ||
        !int(e.lastAppliedOwnTurn, e.openedOwnTurn, own) ||
        !int(e.sourceActionRevision, 0, s.revision) ||
        !(
          e.closedOwnTurn === null || int(e.closedOwnTurn, e.openedOwnTurn, own)
        ) ||
        typeof e.rewarded !== "boolean"
      )
        return false;
      for (const [field, side] of [
        [e.attackerIds, sub.side === "white" ? "black" : "white"],
        [e.defenderIds, sub.side],
      ] as const)
        if (
          !Array.isArray(field) ||
          field.length > 16 ||
          new Set(field).size !== field.length ||
          !field.every((i) => sim.subjects[i]?.side === side)
        )
          return false;
      ids.add(e.id);
    }
  }
  for (const side of ["white", "black"] as const) {
    const q = p.sides[side];
    if (
      !object(q) ||
      !int(q.retreats, 0, 2) ||
      !int(q.lastAmbient, -100, sim.kingdoms[side].ownTurnsCompleted) ||
      !object(q.pairs) ||
      Object.keys(q.pairs).length > 8
    )
      return false;
    for (const [pair, streak] of Object.entries(q.pairs)) {
      const parts = pair.split("|");
      if (
        parts.length !== 2 ||
        parts[0] === parts[1] ||
        !parts.every(
          (id) =>
            sim.subjects[id]?.side === side &&
            sim.subjects[id].currentKind !== "k",
        ) ||
        !int(streak, 1, sim.kingdoms[side].ownTurnsCompleted)
      )
        return false;
    }
  }
  return true;
}
