import { hasEncounters } from "@/lib/rpg/capabilities";
import { forecastV3 } from "../forecast";
import { isInCheck } from "@/lib/chess";
import type { GameState, ResolvedOrder } from "@/lib/game/types";
import { encounterRulesFor } from "../config";
import { count, event } from "../events";
import { relate } from "../relationships";
import { deriveResolvedFacts } from "../factsV4";
import { locations, attackMap, attackers } from "../context";
import { remember } from "../subjects";
import { encounters } from "./state";
import { effect, grantModifier, applicableModifiers } from "./effects";
import {
  evaluateObjective,
  lossOf,
  projectBoard,
  responseMoves,
  effectiveDefenders,
} from "./objectives";
import { encounterCopy } from "./publicView";
import type { Encounter } from "./types";

export function closeEncounter(
  s: GameState,
  e: Encounter,
  outcome: Encounter["outcome"],
) {
  if (e.outcome !== "active") return;
  e.outcome = outcome;
  e.stageOwn = s.simulation!.kingdoms[e.side].ownTurnsCompleted;
  const state = encounters(s);
  state.active = state.active.filter((x) => x.id !== e.id);
  state.recent.push(e);
  state.recent = state.recent.filter((x) =>
    state.recent
      .filter((y) => y.side === x.side)
      .slice(-24)
      .includes(x),
  );
  count(s, `encounter:${outcome}`);
  if (outcome === "fulfilled" && e.effective)
    count(s, "encounterMechanicalResolutions");
  event(
    s,
    "encounterOutcome",
    encounterCopy(s, e).outcome ?? "The request closes.",
  );
}
export function resolveEncounters(
  before: GameState,
  s: GameState,
  order: ResolvedOrder,
) {
  if (!hasEncounters(s.simulation)) return;
  const state = encounters(s),
    side = order.intended.side,
    own = s.simulation.kingdoms[side].ownTurnsCompleted;
  if (state.processedRevision === s.revision) return;
  state.processedRevision = s.revision;
  state.ledger = state.ledger.filter((key) => key.startsWith(`${s.revision}|`));
  if (before.ply < 8) return;
  const check = isInCheck(before.board, side === "white"),
    pos = locations(s);
  const forecast = forecastV3(before, order.intended);
  for (const modifier of forecast.guaranteed
    ? []
    : applicableModifiers(before, order.intended)) {
    const current = state.modifiers.find(
      (x) =>
        x.encounterId === modifier.encounterId &&
        x.subject === modifier.subject &&
        x.kind === modifier.kind,
    );
    if (current) {
      count(s, `modifierApplicable:${current.kind}`);
      if (forecast.contributions.encounterApplied)
        count(s, `modifierApplied:${current.kind}`);
      if (current.kind === "support") current.consumed = true;
    }
  }
  // Harm is recorded once per actual revision and subject, including later
  // neglect of one episode. Physical danger cannot populate this ledger.
  const facts = deriveResolvedFacts(before, s, order);
  for (const f of facts.filter((f) =>
    ["exposure", "repeat-risk", "neglect", "coerced"].includes(f.kind),
  )) {
    const harms = state.sides[side].harms;
    if (
      !harms.some((h) => h.revision === s.revision && h.subject === f.subjectId)
    ) {
      const oldEpisodes =
        before.simulation && "progression" in before.simulation
          ? before.simulation.progression.subjects[f.subjectId].episodes
          : [];
      const involved = [
        ...(f.defenders ?? []),
        ...effectiveDefenders(before, f.subjectId),
        ...oldEpisodes
          .filter((ep) => own - ep.lastAppliedOwnTurn <= 10)
          .flatMap((ep) => ep.defenderIds),
      ];
      const mover =
        before.pieceIds[order.intended.from[0]][order.intended.from[1]]!;
      if (mover !== f.subjectId && ["neglect", "coerced"].includes(f.kind))
        involved.push(mover);
      const participants = [...new Set(involved)]
        .filter(
          (id) =>
            id !== f.subjectId &&
            s.simulation!.subjects[id]?.side === side &&
            s.simulation!.subjects[id]?.currentKind !== "k",
        )
        .slice(0, 4);
      harms.push({
        revision: s.revision,
        own,
        subject: f.subjectId,
        involved: participants,
        grave: f.kind !== "exposure",
      });
      for (const id of participants)
        if (s.simulation.subjects[id]?.status === "active")
          relate(
            s,
            s.simulation.subjects[f.subjectId],
            s.simulation.subjects[id],
            0,
          );
    } else if (f.kind !== "exposure") {
      harms.find(
        (h) => h.revision === s.revision && h.subject === f.subjectId,
      )!.grave = true;
    }
  }
  state.sides[side].harms = state.sides[side].harms
    .filter((h) => own - h.own <= 32)
    .slice(-32);
  for (const sub of Object.values(s.simulation.subjects).filter(
    (x) => x.side === side && x.currentKind !== "k" && x.status === "active",
  )) {
    const q = state.subjects[sub.id],
      unsafe = lossOf(s, sub.id) >= 100;
    if (unsafe) {
      if (lossOf(before, sub.id) >= 100)
        sub.fear += encounterRulesFor(s).physicalFear;
      q.lastDanger = own;
      const pressure = s.simulation.progression.subjects[sub.id];
      if (
        !pressure.hazard &&
        !pressure.episodes.some((ep) => ep.closedOwnTurn === null)
      )
        pressure.hazard = {
          square: [...pos[sub.id]],
          openedOwnTurn: own,
          sourceActionRevision: s.revision,
        };
      q.safeSince = -100;
      q.dangerTurns = [...q.dangerTurns, own]
        .filter((t, i, a) => a.indexOf(t) === i && own - t <= 6)
        .slice(-6);
    } else if (q.safeSince < 0) q.safeSince = own;
  }
  if (check) {
    state.duePly += 2;
    for (const sub of Object.values(s.simulation.subjects).filter(
      (x) => x.side === side,
    )) {
      const q = state.subjects[sub.id];
      if (q.warningOwn === own - 1) q.warningOwn++;
    }
    for (const e of state.active.filter((e) => e.side === side)) {
      e.deadline++;
      if (e.family === "complaint") e.stageOwn++;
    }
    for (const mod of state.modifiers.filter(
      (m) =>
        s.simulation!.subjects[m.subject]?.side === side &&
        !m.consumed &&
        m.kind === "steady",
    ))
      mod.expires++;
  }
  for (const e of [...state.active]) {
    if (e.participants.some((id) => !pos[id])) {
      closeEncounter(s, e, "interrupted");
      continue;
    }
    if (e.side !== side || check) continue;
    const harmful = state.sides[side].harms.filter(
      (h) => h.revision === s.revision && e.participants.includes(h.subject),
    );
    e.causes = [
      ...new Set([...e.causes, ...harmful.map((h) => h.revision)]),
    ].slice(-16);
    const response = evaluateObjective(before, s, order.actual, e.objective);
    const intention = evaluateObjective(
      before,
      projectBoard(before, order.intended),
      order.intended,
      e.objective,
    );
    if (response.interaction) {
      if (!e.interacted) count(s, "encounterInteractions");
      e.interacted = true;
    }
    if ("separated" in e.objective) e.objective.separated = response.separated;
    if (response.success && intention.success) {
      if (["initiative", "confidence"].includes(e.family)) {
        const id = e.participants[0],
          sub = s.simulation.subjects[id];
        effect(s, e, id, "confidence", () => {
          sub.morale += 4;
          sub.loyalty += 2;
        });
        if (e.family === "initiative") state.subjects[id].developed = true;
        grantModifier(s, e, id, "steady");
      } else if (e.family === "dispute") {
        const [a, b] = e.participants.map((id) => s.simulation!.subjects[id]);
        effect(s, e, a.id, "mediation", () => {
          relate(s, a, b, 12, true);
          a.resentment -= 3;
          b.resentment -= 3;
        });
        state.modifiers = state.modifiers.filter(
          (mod) =>
            mod.kind !== "dispute" ||
            !e.participants.includes(mod.subject) ||
            !mod.helper ||
            !e.participants.includes(mod.helper),
        );
        count(s, "disputeMediations");
      } else if (e.family === "complaint") {
        effect(s, e, e.participants[0], "recovery", () => {
          s.simulation!.kingdoms[side].tyranny -= 4;
          s.simulation!.kingdoms[side].legitimacy += 3;
        });
      } else if (["petition", "solidarity"].includes(e.family)) {
        if (e.family === "petition")
          effect(s, e, e.participants[0], "petition", () => {
            s.simulation!.kingdoms[side].legitimacy += 2;
            for (const id of e.participants)
              s.simulation!.subjects[id].loyalty += 2;
          });
        const actor =
            before.pieceIds[order.actual.from[0]][order.actual.from[1]]!,
          beneficiary = e.participants.includes(actor)
            ? actor
            : e.participants[0];
        grantModifier(
          s,
          e,
          beneficiary,
          "support",
          e.participants.find((id) => id !== beneficiary)!,
        );
      } else {
        // Base rescue/protection rewards already belong to leadership facts.
        const id = e.participants[0],
          sub = s.simulation.subjects[id];
        const square = locations(before)[id];
        const threats = attackers(
          attackMap(before.board),
          square,
          side === "white" ? "black" : "white",
        )
          .map(([r, c]) => before.pieceIds[r][c]!)
          .filter(Boolean)
          .sort();
        const source =
          e.objective.kind === "relieve"
            ? `wards:${[...e.objective.wards].sort().join("|")}`
            : `threats:${threats.join("|")}`;
        if (
          !sub.memories.some(
            (m) =>
              m.type === "encounter_relief" &&
              m.source === source &&
              m.expiryOwnTurn > own,
          )
        ) {
          if (response.helper)
            grantModifier(s, e, id, "support", response.helper);
          else grantModifier(s, e, id, "steady");
          if (e.effective) remember(s, sub, "encounter_relief", source, 1, 32);
        }
      }
      closeEncounter(s, e, "fulfilled");
    } else if (
      response.success &&
      !intention.success &&
      order.outcome !== "obeyed"
    ) {
      closeEncounter(s, e, "interrupted");
    } else if (e.family === "complaint") {
      const newHarm = state.sides[side].harms.filter(
        (h) => h.own > e.stageOwn && e.participants.includes(h.subject),
      );
      if (e.stage === 1 && own - e.stageOwn >= 2 && newHarm.length) {
        e.stage = 2;
        e.stageOwn = own;
        e.deadline = own + 4;
        e.causes = [
          ...new Set([...e.causes, ...newHarm.map((h) => h.revision)]),
        ].slice(-16);
        event(s, "complaintWarning", encounterCopy(s, e).message);
        count(s, "complaintStage2");
      } else if (own >= e.deadline && !newHarm.length)
        closeEncounter(s, e, "expired");
    } else if (own >= e.deadline) {
      if (e.family === "dispute") {
        grantModifier(s, e, e.participants[0], "dispute", e.participants[1]);
        grantModifier(s, e, e.participants[1], "dispute", e.participants[0]);
      }
      closeEncounter(s, e, "expired");
    }
  }
  // Opponent changes can invalidate a response. Never label these a refusal
  // to help; captured participants are handled above on either side's move.
  for (const e of [...state.active])
    if (
      e.side !== side &&
      !isInCheck(s.board, e.side === "white") &&
      !responseMoves(s, e.side, e.objective).length
    )
      closeEncounter(s, e, "interrupted");
  state.modifiers = state.modifiers
    .filter(
      (m) =>
        !m.consumed &&
        m.expires >
          s.simulation!.kingdoms[s.simulation!.subjects[m.subject].side]
            .ownTurnsCompleted &&
        !!pos[m.subject] &&
        (!m.helper || !!pos[m.helper]),
    )
    .slice(-64);
}
export function closeTerminalEncounters(s: GameState) {
  if (!hasEncounters(s.simulation) || !s.terminal) return;
  for (const e of [...encounters(s).active])
    closeEncounter(s, e, "interrupted");
}
