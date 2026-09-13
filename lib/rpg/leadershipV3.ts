import { findKing, KIND_NAMES, squareName } from "@/lib/chess";
import type {
  GameState,
  MoveAttempt,
  PressureCause,
  PressureEpisode,
  ResolvedOrder,
} from "@/lib/game/types";
import { rulesFor, clamp } from "./config";
import { assessOrder, derivePoliticalFacts, type PoliticalFact } from "./facts";
import {
  attackMap,
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
export function leadershipV3(
  before: GameState,
  s: GameState,
  m: MoveAttempt,
  order?: ResolvedOrder,
) {
  const rules = rulesFor(s),
    cfg = rules.progression!,
    sim = s.simulation!,
    p = progression(s),
    k = sim.kingdoms[m.side],
    own = ++k.ownTurnsCompleted;
  const moverId = before.pieceIds[m.from[0]][m.from[1]]!,
    mover = sim.subjects[moverId],
    pos = locations(s),
    king = findKing(s.board, m.side === "white")!;
  if (before.ply < rules.grace) {
    count(s, "graceObserved");
    return;
  }
  const context = assessOrder(before, m, s.board),
    facts =
      s.schemaVersion >= 4 && order
        ? deriveResolvedFacts(before, s, order)
        : derivePoliticalFacts(before, s, m, context);
  const observations: Observation[] = [];
  const trust = (f: PoliticalFact) => {
    if (s.schemaVersion >= 4)
      observations.push({
        kind: "trust",
        subjectId: f.subjectId,
        square: f.square,
        message: `The ${KIND_NAMES[sim.subjects[f.subjectId].currentKind]} at ${squareName(f.square)} settles after the change of orders.`,
      });
  };
  function harm(f: PoliticalFact, cause: PressureCause): PressureEpisode {
    const q = p.subjects[f.subjectId];
    let ep = f.episodeId
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
    remember(s, sim.subjects[f.subjectId], cause, ep.id, 1, cfg.graveWindow);
    return ep;
  }
  function ambient(f: PoliticalFact, text: string) {
    if (s.schemaVersion >= 4) {
      observations.push({
        kind: "neglect",
        subjectId: f.subjectId,
        square: f.square,
        message: text,
      });
      return;
    }
    const q = p.subjects[f.subjectId],
      side = p.sides[m.side];
    if (
      own - side.lastAmbient < cfg.ambientSideCooldown ||
      own - (q.ambient[f.kind] ?? -100) < cfg.ambientSubjectCooldown
    )
      return;
    side.lastAmbient = own;
    q.ambient[f.kind] = own;
    event(s, "ambient", text, { square: f.square, subjectId: f.subjectId });
  }
  for (const f of facts) {
    if (sim.schemaVersion === 5) {
      const ledger = sim.encounters.ledger;
      const key = `${s.revision}|leadership:${f.episodeId ?? f.key ?? "order"}|${f.subjectId}|${f.kind}`;
      if (ledger.includes(key)) continue;
      sim.encounters.ledger = ledger.filter((k) =>
        k.startsWith(`${s.revision}|`),
      );
      sim.encounters.ledger.push(key);
    }
    const sub = sim.subjects[f.subjectId],
      q = p.subjects[sub.id];
    switch (f.kind) {
      case "exposure":
        harm(f, "avoidable_exposure");
        q.lastExposure = own;
        if (f.physical !== false) sub.fear += cfg.exposureFear;
        sub.resentment += cfg.exposureResentment;
        sub.loyalty += cfg.exposureLoyalty;
        count(s, "exposures");
        break;
      case "repeat-risk":
        harm(f, "repeated_risky_order");
        q.lastRepeated = own;
        sub.resentment += cfg.repeatedResentment;
        sub.loyalty += cfg.repeatedLoyalty;
        k.tyranny += cfg.repeatedTyranny;
        k.legitimacy += cfg.repeatedLegitimacy;
        count(s, "repeatedRisk");
        break;
      case "neglect":
        harm(f, "neglected_under_threat");
        q.lastNeglect = own;
        sub.fear += cfg.neglectFear;
        sub.resentment += cfg.neglectResentment;
        sub.loyalty += cfg.neglectLoyalty;
        k.tyranny += cfg.neglectTyranny;
        k.legitimacy += cfg.neglectLegitimacy;
        count(s, "neglect");
        ambient(
          f,
          `The ${KIND_NAMES[sub.currentKind]} at ${squareName(f.square)} remains exposed after another order passes it by.`,
        );
        break;
      case "coerced":
        harm(f, "coerced");
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
        trust(f);
        break;
      case "safe": {
        const ep = q.episodes.find((e) => e.id === f.episodeId)!;
        ep.closedOwnTurn = own;
        if (
          f.playerCredit !== false &&
          !ep.rewarded &&
          own - ep.openedOwnTurn >= rules.cooldown &&
          own - sub.lastRescuedOwnTurn >= rules.cooldown
        ) {
          ep.rewarded = true;
          sub.fear += cfg.rescueFear;
          sub.resentment += cfg.rescueResentment;
          sub.loyalty += cfg.rescueLoyalty;
          k.legitimacy++;
          sub.lastRescuedOwnTurn = own;
          remember(s, sub, "rescued", ep.id);
          count(s, "rescues");
          trust(f);
          if (sub.id !== moverId && sub.relationships[moverId]?.disputed)
            relate(s, sub, mover, 6, true);
        }
        break;
      }
      case "protection":
        if (f.playerCredit === false) {
          sub.fear += cfg.protectionFear;
          q.lastProtection = own;
          if (f.episodeId)
            q.episodes.find((e) => e.id === f.episodeId)!.rewarded = true;
          remember(s, sub, "protection_episode", f.key!, 1, cfg.graveWindow);
          remember(s, sub, "protected_by", moverId);
          relate(
            s,
            mover,
            sub,
            sub.relationships[moverId]?.disputed ? 6 : 4,
            !!sub.relationships[moverId]?.disputed,
          );
          count(s, "autonomousProtections");
          break;
        }
        sub.fear += cfg.protectionFear;
        sub.resentment += cfg.protectionResentment;
        sub.loyalty += cfg.protectionLoyalty;
        k.cohesion++;
        q.lastProtection = own;
        if (f.episodeId)
          q.episodes.find((e) => e.id === f.episodeId)!.rewarded = true;
        remember(s, sub, "protection_episode", f.key!, 1, cfg.graveWindow);
        remember(s, sub, "protected_by", moverId);
        relate(
          s,
          mover,
          sub,
          sub.relationships[moverId]?.disputed ? 6 : 4,
          !!sub.relationships[moverId]?.disputed,
        );
        count(s, "protections");
        trust(f);
        break;
      case "capture": {
        const victim = before.simulation!.subjects[f.capturedId!],
          defeated = sim.kingdoms[victim.side],
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
        for (const witness of Object.values(sim.subjects)
          .filter(
            (x) =>
              x.side === victim.side &&
              x.status === "active" &&
              x.currentKind !== "k" &&
              distance(pos[x.id], f.square) <= 2,
          )
          .sort((a, b) => a.id.localeCompare(b.id))) {
          witness.fear +=
            4 -
            cohesionRecovery(before.simulation!.kingdoms[victim.side].cohesion);
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
            p.subjects[witness.id].lastHarm = victimOwn;
            count(s, "blamedLoss");
          }
        }
        if (s.schemaVersion >= 4) p.subjects[victim.id].hazard = null;
        for (const ep of p.subjects[victim.id].episodes)
          if (ep.closedOwnTurn === null) ep.closedOwnTurn = victimOwn;
        if (context.capturedValue > context.risk) {
          k.prestige += 2;
          mover.morale +=
            5 +
            prestigeConfidence(before.simulation!.kingdoms[m.side].prestige);
          count(s, "favorableCaptures");
        }
        break;
      }
      case "promotion":
        k.prestige += 3;
        mover.morale +=
          8 + prestigeConfidence(before.simulation!.kingdoms[m.side].prestige);
        mover.loyalty += 5;
        mover.ambition += 8;
        remember(s, mover, "promoted", moverId);
        const envious = Object.values(sim.subjects)
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
          .sort(
            (a, b) => b.ambition - a.ambition || a.id.localeCompare(b.id),
          )[0];
        if (envious) {
          envious.resentment += 4;
          remember(s, envious, "promotion_envy", moverId, 1, cfg.graveWindow);
          relate(s, envious, mover, -10);
          count(s, "envy");
        }
        break;
    }
  }
  if (mover.currentKind !== "k") {
    if (
      s.schemaVersion < 5 &&
      context.risk >= 100 &&
      !facts.some(
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
  const map = context.map;
  for (const sub of Object.values(sim.subjects).filter(
    (x) => x.side === m.side,
  )) {
    const q = p.subjects[sub.id];
    sub.memories = sub.memories.filter((e) => e.expiryOwnTurn > own);
    q.episodes = q.episodes.filter(
      (e) =>
        e.closedOwnTurn === null ||
        own - e.lastAppliedOwnTurn < cfg.graveWindow,
    );
    // Evict oldest closed history first, preserving the single live danger episode.
    while (q.episodes.length > cfg.episodeLimit) {
      const i = q.episodes.findIndex((e) => e.closedOwnTurn !== null);
      q.episodes.splice(i < 0 ? 0 : i, 1);
    }
    if (sub.status !== "active" || sub.currentKind === "k") {
      if (s.schemaVersion >= 4) q.hazard = null;
      continue;
    }
    const sq = pos[sub.id];
    if (s.schemaVersion >= 4) {
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
      s.simulation?.schemaVersion !== 5 ||
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
        Number(distance(sq, king) <= 2 && k.legitimacy >= 60);
      if (sub.id !== moverId) sub.fatigue -= rules.recoveryFatigue;
      if (own - q.lastHarm >= cfg.calmTurns) sub.resentment--;
    } else if (sub.id !== moverId) sub.fatigue--;
  }
  const lastHarm = Math.max(
    ...Object.values(sim.subjects)
      .filter((x) => x.side === m.side)
      .map((x) => p.subjects[x.id].lastHarm),
  );
  if (own - lastHarm >= 6 && (own - lastHarm) % 6 === 0) k.tyranny--;
  riskFriction(s, m.side);
  tickRelationships(s, m.side);
  if (s.schemaVersion < 5) capDeltas(before, s);
  if (s.schemaVersion === 4)
    emitObservation(s, m.side, [
      ...observations,
      ...relationshipObservations(before, s, m.side),
    ]);
}
