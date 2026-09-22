import type { GameState, Side } from "@/lib/game/types";
import { locations } from "../context";
import { encounterRulesFor } from "../config";
import { encounters, encounterPhase } from "./state";
import {
  dependentMove,
  effectiveDefenders,
  defensiveWards,
  lossOf,
  responseMoves,
  storedLoss,
} from "./objectives";
import type { Family, Objective } from "./types";
export type Candidate = {
  family: Family;
  side: Side;
  participants: string[];
  objective: Objective;
  priority: number;
  relevance: number;
  causes: number[];
  parent: string | null;
};
export function candidates(
  s: GameState,
  side: Side,
): { candidates: Candidate[]; blockers: string[] } {
  const e = encounters(s),
    sim = s.simulation!,
    own = sim.kingdoms[side].ownTurnsCompleted,
    phase = encounterPhase(s.ply),
    pos = locations(s);
  const out: Candidate[] = [],
    blockers: string[] = [];
  const active = e.active.filter((x) => x.side === side),
    occupied = new Set(active.flatMap((x) => x.participants));
  if (active.length >= (phase >= 3 ? 2 : 1))
    return { candidates: [], blockers: ["occupied-slots"] };
  if (own - e.sides[side].lastStart < encounterRulesFor(s).sideGap)
    return { candidates: [], blockers: ["side-cooldown"] };
  const subjects = Object.values(sim.subjects)
    .filter(
      (x) =>
        x.side === side &&
        x.status === "active" &&
        x.currentKind !== "k" &&
        !occupied.has(x.id),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  const add = (
    family: Family,
    participants: string[],
    objective: Objective,
    priority: number,
    relevance = 0,
    causes: number[] = [],
    parent: string | null = null,
  ) => {
    if (
      participants.some(
        (id) =>
          occupied.has(id) ||
          (!parent &&
            own - e.subjects[id].lastStart < encounterRulesFor(s).subjectGap),
      )
    ) {
      blockers.push("subject-cooldown");
      return;
    }
    if (!responseMoves(s, side, objective).length) {
      blockers.push("impossible-response");
      return;
    }
    // With overlapping windows, each request must retain a distinct feasible
    // response move; participants are disjoint and every window has >=3 turns.
    if (active.some((x) => x.deadline - own < 2)) {
      blockers.push("response-window-conflict");
      return;
    }
    out.push({
      family,
      side,
      participants,
      objective,
      priority,
      relevance,
      causes: causes.slice(-16),
      parent,
    });
  };
  for (const sub of subjects) {
    const q = e.subjects[sub.id],
      loss = lossOf(s, sub.id),
      defenders = effectiveDefenders(s, sub.id);
    if (phase >= 1 && loss >= 100) {
      const strain =
        sub.fear >= encounterRulesFor(s).strainFear &&
        q.dangerTurns.filter((t) => own - t <= 6).length >= 2;
      if (strain || phase >= 2)
        add(
          strain ? "strain" : "protection",
          [sub.id],
          {
            kind: "protect",
            subject: sub.id,
            initialLoss: storedLoss(loss),
            defenders,
          },
          3,
          strain ? 200 + loss : loss,
        );
    }
    if (sub.fatigue >= 8) {
      const wards = defensiveWards(s, sub.id);
      if (wards.length)
        add(
          "relief",
          [sub.id],
          {
            kind: "relieve",
            subject: sub.id,
            initialLoss: storedLoss(loss),
            defenders,
            wards,
          },
          3,
          sub.fatigue,
        );
    }
    const home = sub.side === "white" ? 7 : 0;
    if (
      !q.developed &&
      (pos[sub.id][0] === home ||
        (sub.currentKind === "p" &&
          pos[sub.id][0] === (side === "white" ? 6 : 1)))
    )
      add(
        "initiative",
        [sub.id],
        { kind: "develop", subject: sub.id },
        4,
        "nb".includes(sub.currentKind) ? 30 : 10,
      );
    // Opening moves are deliberately excluded from fatigue bookkeeping, but
    // they still count as recent activity for a present confidence request.
    const lastMoveEvent = [...sim.privateEvents]
      .reverse()
      .find((event) => event.code === "move" && event.subjectId === sub.id);
    const lastMovePly = lastMoveEvent
      ? (s.events.find((event) => event.seq === lastMoveEvent.seq)?.ply ?? -100)
      : -100;
    if (own - sub.lastMovedOwnTurn >= 3 && s.ply - lastMovePly >= 6)
      add(
        "confidence",
        [sub.id],
        { kind: "confidence", subject: sub.id },
        4,
        0,
      );
    if (phase < 2) continue;
    for (const other of subjects.filter(
      (x) => x.id !== sub.id && !!sub.relationships[x.id],
    )) {
      const pair: [string, string] = [sub.id, other.id],
        relationship = sub.relationships[other.id];
      const lastDispute = Math.max(
        -100,
        ...e.recent
          .filter(
            (x) =>
              x.family === "dispute" &&
              x.participants.includes(sub.id) &&
              x.participants.includes(other.id),
          )
          .map((x) => x.stageOwn),
      );
      const harms = e.sides[side].harms.filter(
        (h) => own - h.own <= 10 && h.own > lastDispute && h.subject === sub.id,
      );
      if (
        ((relationship.disputed && lastDispute < 0) ||
          sub.memories.some(
            (m) =>
              ["rival_friction", "promotion_envy"].includes(m.type) &&
              m.source === other.id &&
              m.createdOwnTurn > lastDispute,
          ) ||
          ((sub.personality === "proud" || sub.ambition >= 60) &&
            new Set(harms.map((h) => h.revision)).size >= 2 &&
            harms.some((h) => h.involved.includes(other.id)))) &&
        dependentMove(s, pair)
      )
        add(
          "dispute",
          pair,
          { kind: "mediate", pair, separated: 0 },
          2,
          150,
          harms.map((h) => h.revision),
        );
      if (phase < 3 || sub.id > other.id) continue;
      const previous = [...e.recent]
        .reverse()
        .find(
          (x) =>
            x.side === side &&
            x.stageOwn < own &&
            x.outcome === "fulfilled" &&
            x.participants.some((id) => pair.includes(id)),
        );
      if (relationship.score > 0) {
        const benevolent =
          sim.kingdoms[side].tyranny < 25 &&
          sim.kingdoms[side].legitimacy > 55 &&
          sub.loyalty >= 60 &&
          other.loyalty >= 60;
        const family =
          phase >= 4 &&
          benevolent &&
          previous &&
          ["petition", "solidarity"].includes(previous.family)
            ? "solidarity"
            : "petition";
        if (
          family !== "solidarity" ||
          own - (e.pairRewards[[...pair].sort().join("|")] ?? -100) >= 6
        )
          add(
            family,
            pair,
            {
              kind: "support",
              pair,
              concern:
                Math.max(loss, lossOf(s, other.id)) >= 100
                  ? "safety"
                  : "initiative",
              initialLoss: storedLoss(Math.max(loss, lossOf(s, other.id))),
            },
            previous && benevolent ? 2 : 4,
            20,
            previous?.causes ?? [],
            benevolent ? (previous?.id ?? null) : null,
          );
      }
      const shared = e.sides[side].harms.filter(
        (h) =>
          pair.includes(h.subject) &&
          h.involved.some((id) => pair.includes(id)),
      );
      const distinct = shared.filter(
        (h, i) => shared.findIndex((x) => x.revision === h.revision) === i,
      );
      const last = distinct.at(-1),
        earlier = last && distinct.find((h) => last.own - h.own >= 3);
      if (
        phase >= 4 &&
        last &&
        earlier &&
        sim.kingdoms[side].tyranny >= 25 &&
        sim.kingdoms[side].legitimacy <= 55 &&
        !e.active.some((x) => x.family === "complaint") &&
        !sim.plots.some((x) => !["resolved", "thwarted"].includes(x.stage))
      ) {
        const unresolved = pair.some((id) =>
          e.sides[side].harms.some(
            (h) =>
              h.subject === id &&
              h.own >
                (e.recent
                  .filter(
                    (x) =>
                      x.outcome === "fulfilled" && x.participants.includes(id),
                  )
                  .at(-1)?.createdOwn ?? -1),
          ),
        );
        const petition = [...e.recent]
          .reverse()
          .find(
            (x) =>
              x.family === "petition" &&
              x.outcome === "expired" &&
              x.stageOwn < own &&
              x.causes.length &&
              x.participants.some((id) => pair.includes(id)),
          );
        if (unresolved)
          add(
            "complaint",
            pair,
            {
              kind: "recover",
              pair,
              initialLoss: storedLoss(Math.max(loss, lossOf(s, other.id))),
              separated: 0,
            },
            2,
            100,
            distinct.map((h) => h.revision),
            petition?.id ?? null,
          );
      }
    }
  }
  if (!out.length)
    blockers.push(
      subjects.length ? "no-supported-candidate" : "no-mobile-candidate",
    );
  const rank = (c: Candidate) => e.sides[side].family[c.family] ?? -100;
  out.sort(
    (a, b) =>
      a.priority - b.priority ||
      b.relevance - a.relevance ||
      rank(a) - rank(b) ||
      Math.max(...a.participants.map((id) => e.subjects[id].lastStart)) -
        Math.max(...b.participants.map((id) => e.subjects[id].lastStart)) ||
      a.participants.join().localeCompare(b.participants.join()),
  );
  return { candidates: out, blockers: [...new Set(blockers)] };
}
