import type { GameState } from "@/lib/game/types";
// No defaults or coercion: malformed saved encounters fail closed.
export function validEncounters(s: GameState): boolean {
  if (s.simulation?.schemaVersion !== 5) return false;
  const sim = s.simulation,
    e = sim.encounters;
  const obj = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object" && !Array.isArray(v);
  const int = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) =>
    Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max;
  const exact = (v: Record<string, unknown>, keys: string) =>
    Object.keys(v).sort().join() === keys.split(" ").sort().join();
  const str = (v: unknown) => typeof v === "string" && v.length <= 200;
  const family = (v: unknown) =>
    [
      "initiative",
      "confidence",
      "protection",
      "relief",
      "strain",
      "dispute",
      "petition",
      "solidarity",
      "complaint",
    ].includes(String(v));
  const ids = (v: unknown, side: string, max = 2): v is string[] =>
    Array.isArray(v) &&
    v.length >= 1 &&
    v.length <= max &&
    new Set(v).size === v.length &&
    v.every(
      (id) =>
        typeof id === "string" &&
        sim.subjects[id]?.side === side &&
        sim.subjects[id]?.currentKind !== "k",
    );
  if (
    !obj(e) ||
    !exact(
      e,
      "serial lastStartPly duePly processedRevision sides subjects active recent modifiers ledger pairRewards",
    ) ||
    !int(e.serial) ||
    !int(e.lastStartPly, -100, s.ply) ||
    !int(e.duePly) ||
    !int(e.processedRevision, -1, s.revision) ||
    !obj(e.sides) ||
    !obj(e.subjects) ||
    !Array.isArray(e.active) ||
    e.active.length > 4 ||
    !Array.isArray(e.recent) ||
    e.recent.length > 48 ||
    !Array.isArray(e.modifiers) ||
    e.modifiers.length > 64 ||
    !Array.isArray(e.ledger) ||
    e.ledger.length > 128 ||
    !e.ledger.every(str) ||
    new Set(e.ledger).size !== e.ledger.length ||
    !obj(e.pairRewards) ||
    Object.keys(e.pairRewards).length > 240
  )
    return false;
  for (const side of ["white", "black"] as const) {
    const q = e.sides[side],
      own = sim.kingdoms[side].ownTurnsCompleted;
    if (
      !obj(q) ||
      !exact(q, "lastStart lastWithdrawal family harms") ||
      !int(q.lastStart, -100, own) ||
      !int(q.lastWithdrawal, -100, own) ||
      !obj(q.family) ||
      Object.keys(q.family).some((k) => !family(k)) ||
      !Object.values(q.family).every((n) => int(n, 0, own)) ||
      !Array.isArray(q.harms) ||
      q.harms.length > 32
    )
      return false;
    for (const h of q.harms)
      if (
        !obj(h) ||
        !exact(h, "revision own subject involved grave") ||
        !int(h.revision, 1, s.revision) ||
        !int(h.own, 0, own) ||
        typeof h.grave !== "boolean" ||
        sim.subjects[h.subject]?.side !== side ||
        !Array.isArray(h.involved) ||
        h.involved.length > 4 ||
        !h.involved.every((id) => sim.subjects[id]?.side === side)
      )
        return false;
    if (
      e.active.filter((x) => x.side === side).length > (s.ply >= 33 ? 2 : 1) ||
      e.recent.filter((x) => x.side === side).length > 24
    )
      return false;
  }
  if (Object.keys(e.subjects).length !== Object.keys(sim.subjects).length)
    return false;
  for (const [id, sub] of Object.entries(sim.subjects)) {
    const q = e.subjects[id],
      own = sim.kingdoms[sub.side].ownTurnsCompleted;
    if (
      !obj(q) ||
      !exact(
        q,
        "lastStart developed dangerTurns warningOwn lastDanger safeSince",
      ) ||
      !int(q.lastStart, -100, own) ||
      typeof q.developed !== "boolean" ||
      !Array.isArray(q.dangerTurns) ||
      q.dangerTurns.length > 6 ||
      !q.dangerTurns.every(
        (n, i, a) => int(n, 0, own) && (i === 0 || n > a[i - 1]),
      ) ||
      !(q.warningOwn === null || int(q.warningOwn, 0, own)) ||
      !int(q.lastDanger, -100, own) ||
      !int(q.safeSince, -100, own)
    )
      return false;
  }
  const all = [...e.active, ...e.recent];
  if (
    new Set(all.map((x) => x.id)).size !== all.length ||
    e.active.filter((x) => x.family === "complaint").length > 1
  )
    return false;
  for (const x of all) {
    if (
      !obj(x) ||
      !exact(
        x,
        "id family phase side participants causes createdPly createdOwn deadline objective stage stageOwn outcome consumed parent interacted effective",
      ) ||
      !str(x.id) ||
      !/^encounter-[1-9]\d*$/.test(x.id) ||
      !int(Number(x.id.slice(10)), 1, e.serial) ||
      !family(x.family) ||
      !["white", "black"].includes(x.side) ||
      !ids(x.participants, x.side) ||
      !int(x.phase, 1, 5) ||
      !int(x.createdPly, 10, s.ply) ||
      !int(x.createdOwn, 0, sim.kingdoms[x.side].ownTurnsCompleted) ||
      !int(x.deadline, x.createdOwn + 1) ||
      !int(x.stage, 1, 2) ||
      !int(x.stageOwn, x.createdOwn, sim.kingdoms[x.side].ownTurnsCompleted) ||
      !["active", "fulfilled", "expired", "interrupted", "escalated"].includes(
        x.outcome,
      ) ||
      e.active.includes(x) !== (x.outcome === "active") ||
      !Array.isArray(x.causes) ||
      x.causes.length > 16 ||
      !x.causes.every((n) => int(n, 1, s.revision)) ||
      !Array.isArray(x.consumed) ||
      x.consumed.length > 16 ||
      !x.consumed.every(str) ||
      !(x.parent === null || str(x.parent)) ||
      typeof x.interacted !== "boolean" ||
      typeof x.effective !== "boolean" ||
      !obj(x.objective)
    )
      return false;
    const o = x.objective;
    const objectiveKeys = {
      develop: "kind subject",
      confidence: "kind subject",
      protect: "kind subject initialLoss defenders",
      relieve: "kind subject initialLoss defenders wards",
      mediate: "kind pair separated",
      recover: "kind pair initialLoss separated",
      support: "kind pair concern initialLoss",
    };
    if (!exact(o, objectiveKeys[o.kind] ?? "")) return false;
    if (
      o.kind === "develop" ||
      o.kind === "confidence" ||
      o.kind === "protect" ||
      o.kind === "relieve"
    ) {
      if (!x.participants.includes(o.subject) || x.participants.length !== 1)
        return false;
      if (o.kind === "protect" || o.kind === "relieve")
        if (
          !int(o.initialLoss, 0, 20000) ||
          !Array.isArray(o.defenders) ||
          o.defenders.length > 16 ||
          !o.defenders.every((id) => sim.subjects[id]?.side === x.side)
        )
          return false;
      if (
        o.kind === "relieve" &&
        (!Array.isArray(o.wards) ||
          o.wards.length > 16 ||
          !o.wards.length ||
          !o.wards.every((id) => sim.subjects[id]?.side === x.side))
      )
        return false;
    } else if (
      o.kind === "mediate" ||
      o.kind === "recover" ||
      o.kind === "support"
    ) {
      if (
        !ids(o.pair, x.side) ||
        o.pair.length !== 2 ||
        o.pair.join() !== x.participants.join()
      )
        return false;
      if (o.kind !== "support" && !int(o.separated)) return false;
      if (o.kind !== "mediate" && !int(o.initialLoss, 0, 20000)) return false;
      if (o.kind === "support" && !["safety", "initiative"].includes(o.concern))
        return false;
    } else return false;
  }
  for (const m of e.modifiers) {
    if (
      !obj(m) ||
      !exact(m, "encounterId subject helper kind expires consumed") ||
      !str(m.encounterId) ||
      !sim.subjects[m.subject] ||
      sim.subjects[m.subject].currentKind === "k" ||
      !(
        m.helper === null ||
        (sim.subjects[m.helper]?.side === sim.subjects[m.subject].side &&
          m.helper !== m.subject)
      ) ||
      !["steady", "support", "dispute"].includes(m.kind) ||
      !int(m.expires) ||
      typeof m.consumed !== "boolean"
    )
      return false;
  }
  for (const [key, n] of Object.entries(e.pairRewards)) {
    const parts = key.split("|");
    if (
      parts.length !== 2 ||
      !sim.subjects[parts[0]] ||
      sim.subjects[parts[0]].side !== sim.subjects[parts[1]]?.side ||
      !int(n)
    )
      return false;
  }
  return true;
}
