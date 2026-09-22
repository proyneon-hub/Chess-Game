import {
  capabilities,
  hasEncounters,
  type Capabilities,
} from "@/lib/rpg/capabilities";
import { compareIds } from "./order";
import { type Square, findKing, KIND_NAMES, squareName } from "@/lib/chess";
import type {
  GameState,
  KingdomState,
  MoveAttempt,
  PressureCause,
  PressureEpisode,
  ProgressionState,
  ResolvedOrder,
  SubjectState,
} from "@/lib/game/types";
import { rulesFor, clamp, type RuleConfig } from "./config";
import { assessOrder, derivePoliticalFacts, type PoliticalFact } from "./facts";
import {
  attackers,
  distance,
  exchangeLoss,
  locations,
  opposite,
} from "./context";
import { progression } from "./pressure";
import { capDeltas, remember } from "./subjects";
import { relate, tickRelationships, riskFriction } from "./relationships";
import { count, event } from "./events";
import { deriveResolvedFacts } from "./factsV4";
import {
  emitObservation,
  relationshipObservations,
  type Observation,
} from "./observations";
export const cohesionRecovery = (value: number) =>
  Math.round(clamp((value - 65) / 35, -1, 1));
export const prestigeConfidence = (value: number) =>
  Math.round(clamp((value - 50) / 25, -2, 2));

/** Everything one side's leadership turn reads, computed once. */
type Turn = {
  before: GameState;
  s: GameState;
  m: MoveAttempt;
  order?: ResolvedOrder;
  rules: RuleConfig;
  caps: Capabilities;
  cfg: NonNullable<RuleConfig["progression"]>;
  sim: NonNullable<GameState["simulation"]>;
  p: ProgressionState;
  k: KingdomState;
  own: number;
  moverId: string;
  mover: SubjectState;
  pos: Record<string, Square>;
  king: Square;
  context: ReturnType<typeof assessOrder>;
  facts: PoliticalFact[];
  observations: Observation[];
};

/**
 * Applies one side's leadership consequences after a completed move:
 * political facts, mover strain, per-subject upkeep and recovery, then
 * turn-end relationship and tyranny effects.
 */
export function leadershipV3(
  before: GameState,
  s: GameState,
  m: MoveAttempt,
  order?: ResolvedOrder,
) {
  const rules = rulesFor(s),
    caps = capabilities(s),
    sim = s.simulation!,
    k = sim.kingdoms[m.side],
    own = ++k.ownTurnsCompleted;
  const moverId = before.pieceIds[m.from[0]][m.from[1]]!;
  const pos = locations(s),
    king = findKing(s.board, m.side === "white")!;
  if (before.ply < rules.grace) {
    count(s, "graceObserved");
    return;
  }
  const context = assessOrder(before, m, s.board);
  const t: Turn = {
    before,
    s,
    m,
    order,
    rules,
    caps,
    cfg: rules.progression!,
    sim,
    p: progression(s),
    k,
    own,
    moverId,
    mover: sim.subjects[moverId],
    pos,
    king,
    context,
    facts:
      caps.responsibility && order
        ? deriveResolvedFacts(before, s, order)
        : derivePoliticalFacts(before, s, m, context),
    observations: [],
  };
  for (const f of t.facts) if (firstApplication(t, f)) applyFact(t, f);
  moverStrain(t);
  for (const sub of Object.values(sim.subjects).filter(
    (x) => x.side === m.side,
  ))
    upkeepSubject(t, sub);
  endOfTurn(t);
}

/** v5 applies each fact at most once per action (encounters share the ledger). */
function firstApplication({ s, sim }: Turn, f: PoliticalFact) {
  if (!hasEncounters(sim)) return true;
  const ledger = sim.encounters.ledger;
  const key = `${s.revision}|leadership:${f.episodeId ?? f.key ?? "order"}|${f.subjectId}|${f.kind}`;
  if (ledger.includes(key)) return false;
  sim.encounters.ledger = ledger.filter((k) => k.startsWith(`${s.revision}|`));
  sim.encounters.ledger.push(key);
  return true;
}

function trust(t: Turn, f: PoliticalFact) {
  if (t.caps.responsibility)
    t.observations.push({
      kind: "trust",
      subjectId: f.subjectId,
      square: f.square,
      message: `The ${KIND_NAMES[t.sim.subjects[f.subjectId].currentKind]} at ${squareName(f.square)} settles after the change of orders.`,
    });
}

/** Opens or extends the subject's pressure episode for this harm. */
function harm(t: Turn, f: PoliticalFact, cause: PressureCause) {
  const { s, own, cfg } = t,
    q = t.p.subjects[f.subjectId];
  let ep: PressureEpisode | undefined = f.episodeId
    ? q.episodes.find((e) => e.id === f.episodeId)
    : undefined;
  if (!ep && cause === "repeated_risky_order")
    ep = q.episodes.find(
      (e) => e.cause === "avoidable_exposure" && e.closedOwnTurn === null,
    );
  if (!ep) {
    ep = {
      id: `${f.subjectId}:${s.revision}:${cause}`,
      subjectId: f.subjectId,
      cause,
      openedOwnTurn: own,
      lastAppliedOwnTurn: own,
      squareAtOpening: [...f.square],
      attackerIds: f.attackers ?? [],
      defenderIds: f.defenders ?? [],
      sourceActionRevision: s.revision,
      closedOwnTurn:
        cause === "avoidable_exposure" && f.physical !== false ? null : own,
      rewarded: false,
      causes: [cause],
    };
    q.episodes.push(ep);
    count(s, "harmEpisodes");
  }
  if (!ep.causes.includes(cause)) ep.causes.push(cause);
  ep.lastAppliedOwnTurn = own;
  q.lastHarm = own;
  remember(s, t.sim.subjects[f.subjectId], cause, ep.id, 1, cfg.graveWindow);
}

/** Neglect is observed (v4+) or announced with side and subject cooldowns. */
function ambient(t: Turn, f: PoliticalFact, text: string) {
  if (t.caps.responsibility) {
    t.observations.push({
      kind: "neglect",
      subjectId: f.subjectId,
      square: f.square,
      message: text,
    });
    return;
  }
  const { own, cfg } = t,
    q = t.p.subjects[f.subjectId],
    side = t.p.sides[t.m.side];
  if (
    own - side.lastAmbient < cfg.ambientSideCooldown ||
    own - (q.ambient[f.kind] ?? -100) < cfg.ambientSubjectCooldown
  )
    return;
  side.lastAmbient = own;
  q.ambient[f.kind] = own;
  event(t.s, "ambient", text, { square: f.square, subjectId: f.subjectId });
}

function applyFact(t: Turn, f: PoliticalFact) {
  const { s, cfg, k, own } = t,
    sub = t.sim.subjects[f.subjectId],
    q = t.p.subjects[sub.id];
  switch (f.kind) {
    case "exposure":
      harm(t, f, "avoidable_exposure");
      q.lastExposure = own;
      if (f.physical !== false) sub.fear += cfg.exposureFear;
      sub.resentment += cfg.exposureResentment;
      sub.loyalty += cfg.exposureLoyalty;
      count(s, "exposures");
      break;
    case "repeat-risk":
      harm(t, f, "repeated_risky_order");
      q.lastRepeated = own;
      sub.resentment += cfg.repeatedResentment;
      sub.loyalty += cfg.repeatedLoyalty;
      k.tyranny += cfg.repeatedTyranny;
      k.legitimacy += cfg.repeatedLegitimacy;
      count(s, "repeatedRisk");
      break;
    case "neglect":
      harm(t, f, "neglected_under_threat");
      q.lastNeglect = own;
      sub.fear += cfg.neglectFear;
      sub.resentment += cfg.neglectResentment;
      sub.loyalty += cfg.neglectLoyalty;
      k.tyranny += cfg.neglectTyranny;
      k.legitimacy += cfg.neglectLegitimacy;
      count(s, "neglect");
      ambient(
        t,
        f,
        `The ${KIND_NAMES[sub.currentKind]} at ${squareName(f.square)} remains exposed after another order passes it by.`,
      );
      break;
    case "coerced":
      harm(t, f, "coerced");
      sub.fear += cfg.coercionFear;
      sub.resentment += cfg.coercionResentment;
      sub.loyalty += cfg.coercionLoyalty;
      k.tyranny += cfg.coercionTyranny;
      k.legitimacy += cfg.coercionLegitimacy;
      k.lastCoercionOwnTurn = own;
      count(s, "repeats");
      break;
    case "restraint":
      sub.resentment -= 4;
      sub.loyalty += 3;
      k.tyranny -= 2;
      k.legitimacy += 2;
      k.lastMercyRewardOwnTurn = own;
      count(s, "alternativeOrders");
      trust(t, f);
      break;
    case "safe":
      rescued(t, f, sub);
      break;
    case "protection":
      protectedBy(t, f, sub);
      break;
    case "capture":
      captured(t, f);
      break;
    case "promotion":
      promoted(t);
      break;
  }
}

/** A threatened subject is safe again; the first rescue earns credit. */
function rescued(t: Turn, f: PoliticalFact, sub: SubjectState) {
  const { s, cfg, k, own, rules, moverId } = t,
    ep = t.p.subjects[sub.id].episodes.find((e) => e.id === f.episodeId)!;
  ep.closedOwnTurn = own;
  if (
    f.playerCredit === false ||
    ep.rewarded ||
    own - ep.openedOwnTurn < rules.cooldown ||
    own - sub.lastRescuedOwnTurn < rules.cooldown
  )
    return;
  ep.rewarded = true;
  sub.fear += cfg.rescueFear;
  sub.resentment += cfg.rescueResentment;
  sub.loyalty += cfg.rescueLoyalty;
  k.legitimacy++;
  sub.lastRescuedOwnTurn = own;
  remember(s, sub, "rescued", ep.id);
  count(s, "rescues");
  trust(t, f);
  if (sub.id !== moverId && sub.relationships[moverId]?.disputed)
    relate(s, sub, t.mover, 6, true);
}

/**
 * The mover defends a subject. Only a protection the player ordered
 * (playerCredit) also earns loyalty, cohesion, and trust.
 */
function protectedBy(t: Turn, f: PoliticalFact, sub: SubjectState) {
  const { s, cfg, k, own, moverId } = t,
    q = t.p.subjects[sub.id],
    credited = f.playerCredit !== false,
    disputed = !!sub.relationships[moverId]?.disputed;
  sub.fear += cfg.protectionFear;
  if (credited) {
    sub.resentment += cfg.protectionResentment;
    sub.loyalty += cfg.protectionLoyalty;
    k.cohesion++;
  }
  q.lastProtection = own;
  if (f.episodeId)
    q.episodes.find((e) => e.id === f.episodeId)!.rewarded = true;
  remember(s, sub, "protection_episode", f.key!, 1, cfg.graveWindow);
  remember(s, sub, "protected_by", moverId);
  relate(s, t.mover, sub, disputed ? 6 : 4, disputed);
  count(s, credited ? "protections" : "autonomousProtections");
  if (credited) trust(t, f);
}

/** A capture shakes nearby allies; an avoidable loss draws blame. */
function captured(t: Turn, f: PoliticalFact) {
  const { before, s, cfg, k, pos, context, m } = t,
    victim = before.simulation!.subjects[f.capturedId!],
    defeated = t.sim.kingdoms[victim.side],
    victimOwn = defeated.ownTurnsCompleted;
  const avoidable = progression(before).subjects[victim.id].episodes.some(
    (e) =>
      e.cause === "avoidable_exposure" &&
      victimOwn - e.lastAppliedOwnTurn < cfg.graveWindow,
  );
  defeated.cohesion -= 2;
  defeated.prestige -= 2;
  if (avoidable) defeated.legitimacy--;
  let blamed = 0;
  for (const witness of Object.values(t.sim.subjects)
    .filter(
      (x) =>
        x.side === victim.side &&
        x.status === "active" &&
        x.currentKind !== "k" &&
        distance(pos[x.id], f.square) <= 2,
    )
    .sort((a, b) => compareIds(a.id, b.id))) {
    witness.fear +=
      4 - cohesionRecovery(before.simulation!.kingdoms[victim.side].cohesion);
    witness.morale -= 4;
    remember(s, witness, "ally_lost", victim.id);
    if (
      avoidable &&
      blamed < 2 &&
      (before.simulation!.subjects[witness.id].relationships[victim.id]
        ?.score ?? 0) > 0
    ) {
      witness.resentment += 2;
      witness.loyalty--;
      blamed++;
      remember(s, witness, "blamed_loss", victim.id, 1, cfg.graveWindow);
      t.p.subjects[witness.id].lastHarm = victimOwn;
      count(s, "blamedLoss");
    }
  }
  if (t.caps.responsibility) t.p.subjects[victim.id].hazard = null;
  for (const ep of t.p.subjects[victim.id].episodes)
    if (ep.closedOwnTurn === null) ep.closedOwnTurn = victimOwn;
  if (context.capturedValue > context.risk) {
    k.prestige += 2;
    t.mover.morale +=
      5 + prestigeConfidence(before.simulation!.kingdoms[m.side].prestige);
    count(s, "favorableCaptures");
  }
}

/** Promotion lifts the mover; the most ambitious nearby rival turns envious. */
function promoted(t: Turn) {
  const { before, s, cfg, k, pos, m, moverId, mover } = t;
  k.prestige += 3;
  mover.morale +=
    8 + prestigeConfidence(before.simulation!.kingdoms[m.side].prestige);
  mover.loyalty += 5;
  mover.ambition += 8;
  remember(s, mover, "promoted", moverId);
  const envious = Object.values(t.sim.subjects)
    .filter(
      (x) =>
        x.id !== moverId &&
        x.side === m.side &&
        x.status === "active" &&
        x.currentKind !== "k" &&
        x.ambition >= 70 &&
        x.loyalty <= 55 &&
        distance(pos[x.id], m.to) <= 3,
    )
    .sort((a, b) => b.ambition - a.ambition || compareIds(a.id, b.id))[0];
  if (envious) {
    envious.resentment += 4;
    remember(s, envious, "promotion_envy", moverId, 1, cfg.graveWindow);
    relate(s, envious, mover, -10);
    count(s, "envy");
  }
}

/** Moving tires a non-king mover, more so on consecutive turns. */
function moverStrain(t: Turn) {
  const { mover, moverId, own } = t;
  if (mover.currentKind === "k") return;
  if (
    t.caps.riskyMoveFear &&
    t.context.risk >= 100 &&
    !t.facts.some(
      (f) =>
        f.subjectId === moverId &&
        f.kind === "exposure" &&
        f.physical !== false,
    )
  )
    mover.fear += 2;
  mover.fatigue += mover.lastMovedOwnTurn === own - 1 ? 4 : 1;
  mover.lastMovedOwnTurn = own;
}

/** Expires memories and episodes, tracks hazards, and applies recovery. */
function upkeepSubject(t: Turn, sub: SubjectState) {
  const { s, own, cfg, rules, k, m, moverId, order, facts } = t,
    map = t.context.map,
    q = t.p.subjects[sub.id];
  sub.memories = sub.memories.filter((e) => e.expiryOwnTurn > own);
  q.episodes = q.episodes.filter(
    (e) =>
      e.closedOwnTurn === null || own - e.lastAppliedOwnTurn < cfg.graveWindow,
  );
  // Evict oldest closed history first, preserving the single live danger episode.
  while (q.episodes.length > cfg.episodeLimit) {
    const i = q.episodes.findIndex((e) => e.closedOwnTurn !== null);
    q.episodes.splice(i < 0 ? 0 : i, 1);
  }
  if (sub.status !== "active" || sub.currentKind === "k") {
    if (t.caps.responsibility) q.hazard = null;
    return;
  }
  const sq = t.pos[sub.id];
  if (t.caps.responsibility) {
    const danger = exchangeLoss(s.board, sq, m.side, map) >= 100;
    if (!danger) q.hazard = null;
    if (sub.id === moverId && order && order.outcome !== "obeyed") {
      if (
        danger &&
        !facts.some((f) => f.subjectId === moverId && f.kind === "exposure")
      )
        q.hazard = {
          square: [...sq],
          openedOwnTurn: own,
          sourceActionRevision: s.revision,
        };
      if (!danger)
        for (const ep of q.episodes)
          if (ep.closedOwnTurn === null) {
            ep.closedOwnTurn = own;
            ep.rewarded = true;
          }
    }
  }
  const calm =
    !attackers(map, sq, opposite(m.side)).length &&
    attackers(map, sq, m.side).length > 0;
  const fullSafeInterval =
    !hasEncounters(s.simulation) ||
    (s.simulation.encounters.subjects[sub.id].safeSince >= 0 &&
      s.simulation.encounters.subjects[sub.id].safeSince < own &&
      !facts.some(
        (f) =>
          f.subjectId === sub.id &&
          ["capture", "exposure", "neglect", "coerced"].includes(f.kind),
      ));
  if (calm && fullSafeInterval) {
    sub.fear -=
      rules.recoveryFear +
      cohesionRecovery(k.cohesion) +
      Number(distance(sq, t.king) <= rules.auraRadius && k.legitimacy >= 60);
    if (sub.id !== moverId) sub.fatigue -= rules.recoveryFatigue;
    if (own - q.lastHarm >= cfg.calmTurns) sub.resentment--;
  } else if (sub.id !== moverId) sub.fatigue--;
}

/** Tyranny eases after harm-free stretches; relationships tick; caps apply. */
function endOfTurn(t: Turn) {
  const { before, s, m, k, own } = t;
  const lastHarm = Math.max(
    ...Object.values(t.sim.subjects)
      .filter((x) => x.side === m.side)
      .map((x) => t.p.subjects[x.id].lastHarm),
  );
  if (own - lastHarm >= 6 && (own - lastHarm) % 6 === 0) k.tyranny--;
  riskFriction(s, m.side);
  tickRelationships(s, m.side);
  if (!t.caps.turnLevelDeltaCap) capDeltas(before, s);
  if (t.caps.observationsAtLeadership)
    emitObservation(s, m.side, [
      ...t.observations,
      ...relationshipObservations(before, s, m.side),
    ]);
}
