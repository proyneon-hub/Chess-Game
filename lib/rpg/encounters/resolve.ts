import { capabilities, hasEncounters } from "@/lib/rpg/capabilities";
import { forecastV3 } from "../forecast";
import {
  isInCheck,
  KIND_NAMES,
  squareName,
  type Side,
  type Square,
} from "@/lib/chess";
import type {
  GameState,
  ProgressionState,
  ResolvedOrder,
} from "@/lib/game/types";
import { encounterRulesFor } from "../config";
import { count, event } from "../events";
import { relate } from "../relationships";
import { deriveResolvedFacts } from "../factsV4";
import { locations, attackMap, attackers, distance } from "../context";
import { compareIds } from "../order";
import { remember } from "../subjects";
import { encounters, PERSONAL } from "./state";
import { effect, grantModifier, applicableModifiers } from "./effects";
import {
  evaluateObjective,
  lossOf,
  projectBoard,
  responseMoves,
  effectiveDefenders,
} from "./objectives";
import { encounterCopy } from "./publicView";
import type { Encounter, EncounterState } from "./types";

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

type EncounterSimulation = NonNullable<GameState["simulation"]> & {
  progression: ProgressionState;
  encounters: EncounterState;
};
/** Everything one action's encounter resolution reads, computed once. */
type Resolution = {
  before: GameState;
  s: GameState;
  sim: EncounterSimulation;
  order: ResolvedOrder;
  state: EncounterState;
  side: Side;
  own: number;
  check: boolean;
  pos: Record<string, Square>;
};

/**
 * Resolves the mover's encounters once per action: tallies modifiers,
 * records harms and danger, stalls timers while in check, then fulfils,
 * interrupts, escalates, or expires each active encounter.
 */
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
  const t: Resolution = {
    before,
    s,
    sim: s.simulation,
    order,
    state,
    side,
    own,
    check: isInCheck(before.board, side === "white"),
    pos: locations(s),
  };
  tallyModifiers(t);
  recordHarms(t);
  trackDanger(t);
  if (t.check) stallForCheck(t);
  for (const e of [...state.active]) progress(t, e);
  // Opponent changes can invalidate a response. Never label these a refusal
  // to help; captured participants are handled above on either side's move.
  for (const e of [...state.active])
    if (
      e.side !== side &&
      !isInCheck(s.board, e.side === "white") &&
      // A v6 complaint stands until its deadline even when unanswerable.
      !(capabilities(s).courtComplaints && e.family === "complaint") &&
      !responseMoves(s, e.side, e.objective).length
    )
      closeEncounter(s, e, "interrupted");
  pruneModifiers(t);
}

/** Counts modifiers that applied to this order; support is single-use. */
function tallyModifiers({ before, s, order, state }: Resolution) {
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
}

// Harm is recorded once per actual revision and subject, including later
// neglect of one episode. Physical danger cannot populate this ledger.
function recordHarms({ before, s, sim, order, state, side, own }: Resolution) {
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
            sim.subjects[id]?.side === side &&
            sim.subjects[id]?.currentKind !== "k",
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
        if (sim.subjects[id]?.status === "active")
          relate(s, sim.subjects[f.subjectId], sim.subjects[id], 0);
    } else if (f.kind !== "exposure") {
      harms.find(
        (h) => h.revision === s.revision && h.subject === f.subjectId,
      )!.grave = true;
    }
  }
  state.sides[side].harms = state.sides[side].harms
    .filter((h) => own - h.own <= 32)
    .slice(-32);
}

/** Unsafe subjects gain fear, a hazard, and a danger turn; safe ones heal. */
function trackDanger({ before, s, sim, state, side, own, pos }: Resolution) {
  for (const sub of Object.values(sim.subjects).filter(
    (x) => x.side === side && x.currentKind !== "k" && x.status === "active",
  )) {
    const q = state.subjects[sub.id],
      unsafe = lossOf(s, sub.id) >= 100;
    if (unsafe) {
      if (lossOf(before, sub.id) >= 100)
        sub.fear += encounterRulesFor(s).physicalFear;
      q.lastDanger = own;
      const pressure = sim.progression.subjects[sub.id];
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
    if (
      capabilities(s).frightenedWithdrawal &&
      sub.fear >= encounterRulesFor(s).withdrawalFear &&
      (q.warningOwn === null ||
        own - q.warningOwn >= encounterRulesFor(s).withdrawalGap)
    ) {
      // A visible warning always comes before a withdrawal can happen.
      q.warningOwn = own;
      count(s, "shakenWarnings");
      event(
        s,
        "shaken",
        `The ${KIND_NAMES[sub.currentKind]} at ${squareName(pos[sub.id])} is shaken; ordering it back into danger may make it withdraw.`,
        { square: pos[sub.id] },
      );
    }
  }
}

/** A turn spent answering check does not count against any request. */
function stallForCheck({ sim, state, side, own }: Resolution) {
  state.duePly += 2;
  for (const sub of Object.values(sim.subjects).filter(
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
      sim.subjects[m.subject]?.side === side &&
      !m.consumed &&
      m.kind === "steady",
  ))
    mod.expires++;
}

/** Fulfils, interrupts, escalates, or expires one active encounter. */
function progress(t: Resolution, e: Encounter) {
  const { before, s, order, state, side, own } = t;
  if (e.participants.some((id) => !t.pos[id]) && !carryComplaint(t, e)) {
    closeEncounter(s, e, "interrupted");
    return;
  }
  if (e.side !== side || t.check) return;
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
    fulfil(t, e, response.helper);
    closeEncounter(s, e, "fulfilled");
  } else if (
    response.success &&
    !intention.success &&
    order.outcome !== "obeyed"
  ) {
    closeEncounter(s, e, "interrupted");
  } else if (e.family === "complaint") {
    // v6 courts renew a complaint on any harm to the side, not only to the
    // two pieces that raised it.
    const newHarm = state.sides[side].harms.filter(
      (h) =>
        h.own > e.stageOwn &&
        (capabilities(s).courtComplaints || e.participants.includes(h.subject)),
    );
    if (
      e.stage === 1 &&
      own - e.stageOwn >= encounterRulesFor(s).complaintStageTurns &&
      newHarm.length
    ) {
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
    if (capabilities(s).requestStakes && PERSONAL.includes(e.family))
      grantModifier(s, e, e.participants[0], "restless");
    if (e.family === "dispute") {
      grantModifier(s, e, e.participants[0], "dispute", e.participants[1]);
      grantModifier(s, e, e.participants[1], "dispute", e.participants[0]);
    }
    closeEncounter(s, e, "expired");
  }
}

/**
 * v6: a complaint outlives a captured speaker. The survivor's nearest free
 * ally takes its place (so a nearby one when there is one); false if nobody
 * can.
 */
function carryComplaint(t: Resolution, e: Encounter) {
  const { s, sim, state, pos } = t;
  if (!capabilities(s).courtComplaints || e.family !== "complaint")
    return false;
  const survivors = e.participants.filter((id) => pos[id]);
  if (survivors.length !== 1 || e.objective.kind !== "recover") return false;
  const [survivor] = survivors,
    busy = new Set(state.active.flatMap((x) => x.participants));
  const replacement = Object.values(sim.subjects)
    .filter(
      (x) =>
        x.side === e.side &&
        x.status === "active" &&
        x.currentKind !== "k" &&
        !busy.has(x.id) &&
        !!pos[x.id],
    )
    .sort(
      (a, b) =>
        distance(pos[survivor], pos[a.id]) -
          distance(pos[survivor], pos[b.id]) || compareIds(a.id, b.id),
    )[0];
  if (!replacement) return false;
  const pair: [string, string] = [survivor, replacement.id];
  e.participants = pair;
  e.objective = { ...e.objective, pair, separated: 0 };
  count(s, "complaintCarried");
  return true;
}

/** The family-specific reward for an order that answered the request. */
function fulfil(t: Resolution, e: Encounter, helper: string | null) {
  const { before, s, sim, order, state, side, own } = t;
  if (["initiative", "confidence"].includes(e.family)) {
    const id = e.participants[0],
      sub = sim.subjects[id];
    effect(s, e, id, "confidence", () => {
      sub.morale += 4;
      sub.loyalty += 2;
    });
    if (e.family === "initiative") state.subjects[id].developed = true;
    grantModifier(s, e, id, "steady");
  } else if (e.family === "dispute") {
    const [a, b] = e.participants.map((id) => sim.subjects[id]);
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
      sim.kingdoms[side].tyranny -= 4;
      sim.kingdoms[side].legitimacy += 3;
    });
  } else if (["petition", "solidarity"].includes(e.family)) {
    if (e.family === "petition")
      effect(s, e, e.participants[0], "petition", () => {
        sim.kingdoms[side].legitimacy += 2;
        for (const id of e.participants) sim.subjects[id].loyalty += 2;
      });
    const actor = before.pieceIds[order.actual.from[0]][order.actual.from[1]]!,
      beneficiary = e.participants.includes(actor) ? actor : e.participants[0];
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
      sub = sim.subjects[id];
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
      if (helper) grantModifier(s, e, id, "support", helper);
      else grantModifier(s, e, id, "steady");
      if (e.effective) remember(s, sub, "encounter_relief", source, 1, 32);
    }
  }
}

/** Drops consumed, expired, and orphaned modifiers; keeps the latest 64. */
function pruneModifiers({ sim, state, pos }: Resolution) {
  state.modifiers = state.modifiers
    .filter(
      (m) =>
        !m.consumed &&
        m.expires >
          sim.kingdoms[sim.subjects[m.subject].side].ownTurnsCompleted &&
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
