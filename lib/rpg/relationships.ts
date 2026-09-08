import type { GameState, SubjectState } from "@/lib/game/types";
import { rulesFor, clamp } from "@/lib/rpg/config";
import { distance, locations } from "@/lib/rpg/context";
import { progression } from "./pressure";
import { remember } from "./subjects";
import { count } from "./events";
export function riskFriction(s: GameState, side: SubjectState["side"]) {
  const cfg = rulesFor(s).progression!;
  const own = s.simulation!.kingdoms[side].ownTurnsCompleted;
  for (const sub of Object.values(s.simulation!.subjects)
    .filter(
      (x) =>
        x.side === side &&
        x.status === "active" &&
        ["proud", "ambitious"].includes(x.personality),
    )
    .sort((a, b) => a.id.localeCompare(b.id))) {
    // Ambition changes sensitivity by at most two resentment points.
    if (
      sub.resentment <
      cfg.frictionResentment -
        Math.round(clamp((sub.ambition - 60) / 20, -2, 2))
    )
      continue;
    const episodes = progression(s).subjects[sub.id].episodes.filter(
      (e) =>
        e.cause === "avoidable_exposure" &&
        own - e.openedOwnTurn < cfg.harmWindow &&
        e.defenderIds.length === 1,
    );
    const defenders = Array.from(
      new Set(episodes.map((e) => e.defenderIds[0])),
    ).sort();
    for (const id of defenders) {
      const other = s.simulation!.subjects[id];
      if (
        !other ||
        other.status !== "active" ||
        other.currentKind === "k" ||
        episodes.filter((e) => e.defenderIds[0] === id).length < 2 ||
        sub.memories.some(
          (m) =>
            m.type === "rival_friction" &&
            m.source === id &&
            own - m.createdOwnTurn < cfg.repeatCooldown,
        )
      )
        continue;
      remember(s, sub, "rival_friction", id, 1, cfg.graveWindow);
      relate(s, sub, other, cfg.friction);
      count(s, "rivalFriction");
    }
  }
}
export function relate(
  s: GameState,
  a: SubjectState,
  b: SubjectState,
  delta: number,
  reconcile = false,
) {
  if (
    a.currentKind === "k" ||
    b.currentKind === "k" ||
    a.status !== "active" ||
    b.status !== "active" ||
    a.side !== b.side
  )
    return;
  const own = s.simulation!.kingdoms[a.side].ownTurnsCompleted;
  if (
    reconcile &&
    own - (a.relationships[b.id]?.lastReconciled ?? -4) < rulesFor(s).cooldown
  )
    return;
  for (const [x, y] of [
    [a, b],
    [b, a],
  ]) {
    if (!x.relationships[y.id]) {
      if (
        Object.keys(x.relationships).length >= rulesFor(s).relationshipLimit
      ) {
        const plot = s.simulation!.plots.find(
          (p) => !["resolved", "thwarted"].includes(p.stage),
        );
        const evict = Object.keys(x.relationships)
          .filter(
            (id) => !plot || ![plot.ringleader, plot.accomplice].includes(id),
          )
          .sort(
            (i, j) =>
              x.relationships[i].lastRelevant -
                x.relationships[j].lastRelevant || i.localeCompare(j),
          )[0];
        if (!evict) continue;
        delete x.relationships[evict];
        delete s.simulation!.subjects[evict]?.relationships[x.id];
      }
      x.relationships[y.id] = {
        score: 0,
        lastRelevant: own,
        lastReconciled: -4,
        separatedTurns: 0,
        disputed: false,
      };
    }
    const r = x.relationships[y.id];
    r.score = clamp(r.score + delta, -100, 100);
    r.lastRelevant = own;
    if (reconcile) r.lastReconciled = own;
  }
  refreshDisputes(s, a.side);
}
export function refreshDisputes(s: GameState, side: SubjectState["side"]) {
  const subs = s.simulation!.subjects;
  const pairs = Object.values(subs)
    .filter((a) => a.side === side && a.status === "active")
    .flatMap((a) =>
      Object.keys(a.relationships)
        .filter((id) => a.id < id && subs[id]?.status === "active")
        .map((id) => ({ a, b: subs[id], r: a.relationships[id] })),
    )
    .sort(
      (a, b) =>
        Number(b.r.disputed) - Number(a.r.disputed) ||
        a.r.score - b.r.score ||
        a.a.id.localeCompare(b.a.id),
    );
  let active = 0;
  for (const { a, b, r } of pairs) {
    const cfg = rulesFor(s).progression;
    const cause =
      !cfg ||
      [a, b].some((x) =>
        x.memories.some(
          (m) =>
            ["rival_friction", "promotion_envy"].includes(m.type) &&
            m.source === (x.id === a.id ? b.id : a.id),
        ),
      );
    const should =
      (r.disputed
        ? r.score <= (cfg?.disputeClose ?? -15)
        : cause && r.score <= (cfg?.disputeOpen ?? -30)) &&
      active < rulesFor(s).disputeLimit;
    if (cfg && should !== r.disputed)
      count(s, should ? "disputes" : "disputeResolutions");
    r.disputed = should;
    if (b.relationships[a.id]) b.relationships[a.id].disputed = should;
    if (should) active++;
  }
  for (const a of Object.values(subs).filter((x) => x.side === side))
    a.grievance =
      Object.keys(a.relationships).find((id) => a.relationships[id].disputed) ??
      null;
}
export function tickRelationships(s: GameState, side: SubjectState["side"]) {
  const pos = locations(s),
    subs = s.simulation!.subjects;
  for (const a of Object.values(subs).filter(
    (a) => a.side === side && a.status === "active",
  ))
    for (const [id, r] of Object.entries(a.relationships)) {
      if (!pos[id]) {
        delete a.relationships[id];
        continue;
      }
      r.separatedTurns =
        distance(pos[a.id], pos[id]) > 3 ? r.separatedTurns + 1 : 0;
      const close = rulesFor(s).progression?.disputeClose;
      if (
        r.separatedTurns >= 4 &&
        r.score < (close === undefined ? -15 : close + 1)
      )
        r.score = Math.min(close === undefined ? -15 : close + 1, r.score + 2);
    }
  refreshDisputes(s, side);
}
