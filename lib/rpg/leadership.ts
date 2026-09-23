import { hasProgression } from "@/lib/rpg/capabilities";
import { compareIds } from "./order";
import { findKing, isInCheck, type Square } from "@/lib/chess";
import { material, captureSquare, positionKey } from "@/lib/chessRules";
import type { GameState, MoveAttempt, ResolvedOrder } from "@/lib/game/types";
import { sameIntention } from "@/lib/game/core";
import {
  attackMap,
  attackers,
  distance,
  exchangeLoss,
  locations,
  opposite,
} from "@/lib/rpg/context";
import { capDeltas, remember } from "@/lib/rpg/subjects";
import { relate, tickRelationships } from "@/lib/rpg/relationships";
import { rulesFor, configFor } from "@/lib/rpg/config";
import { count } from "@/lib/rpg/events";
import { leadershipV3 } from "./leadershipV3";

// Facts are derived once from before/after boards; this is called once for a
// completed action only. All aggregates are capped against the input state.
export function leadership(
  before: GameState,
  s: GameState,
  move: MoveAttempt,
  order?: ResolvedOrder,
) {
  if (hasProgression(s.simulation)) return leadershipV3(before, s, move, order);
  const sim = s.simulation!,
    kingdom = sim.kingdoms[move.side],
    oldMap = attackMap(before.board),
    map = attackMap(s.board),
    pos = locations(s);
  const id = before.pieceIds[move.from[0]][move.from[1]]!,
    mover = sim.subjects[id],
    own = ++kingdom.ownTurnsCompleted;
  const king = findKing(s.board, move.side === "white")!;
  const pending = before.pendingRefusal;
  if (pending) {
    const refusedId = before.pieceIds[pending.from[0]][pending.from[1]]!,
      refused = sim.subjects[refusedId];
    if (sameIntention(pending, move)) {
      kingdom.tyranny += 5;
      kingdom.legitimacy -= 2;
      kingdom.lastCoercionOwnTurn = own;
      refused.resentment += 8;
      refused.fear += 6;
      refused.loyalty -= 3;
      remember(s, refused, "coerced", id, 1, rulesFor(s).grievanceTurns);
      count(s, "repeats");
      if (exchangeLoss(s.board, move.to, move.side, map) >= 100) {
        kingdom.tyranny += 2;
        kingdom.legitimacy -= 2;
        refused.resentment += 4;
        const defenders = attackers(map, move.to, move.side)
          .map(([r, c]) => s.pieceIds[r][c])
          .filter(Boolean) as string[];
        const rival =
          defenders.length === 1 ? sim.subjects[defenders[0]] : null;
        const grievance = configFor(s.configVersion)!.coercedRivalGrievance;
        if (
          rival &&
          grievance &&
          refused.memories.some(
            (m) => m.type === "promotion_envy" && m.source === rival.id,
          )
        ) {
          relate(s, refused, rival, -grievance);
          remember(s, refused, "dispute", rival.id);
          count(s, "rivalGrievances");
        }
      }
    } else {
      kingdom.tyranny -= 2;
      kingdom.legitimacy += 2;
      kingdom.lastMercyRewardOwnTurn = own;
      refused.resentment -= 4;
      refused.loyalty += 3;
      count(s, "alternativeOrders");
    }
  }
  const oldLoss = exchangeLoss(before.board, move.from, move.side, oldMap),
    newLoss = exchangeLoss(s.board, move.to, move.side, map);
  if (mover.currentKind !== "k") {
    if (
      oldLoss >= 100 &&
      newLoss < oldLoss &&
      own - mover.lastRescuedOwnTurn >= rulesFor(s).cooldown
    ) {
      kingdom.legitimacy++;
      mover.loyalty += 3;
      mover.fear -= 6;
      mover.lastRescuedOwnTurn = own;
      remember(s, mover, "rescued", id);
      count(s, "rescues");
    }
    if (newLoss >= 100) mover.fear += 4;
    mover.fatigue +=
      mover.lastMovedOwnTurn === own - 1 &&
      !isInCheck(before.board, move.side === "white")
        ? 4
        : 1;
    mover.lastMovedOwnTurn = own;
  }
  const position = positionKey(s.board, move.side, s.rights);
  for (const ally of Object.values(sim.subjects).filter(
    (x) =>
      x.side === move.side &&
      x.status === "active" &&
      x.currentKind !== "k" &&
      x.id !== id,
  )) {
    const sq = pos[ally.id],
      oldSq = locations(before)[ally.id];
    const defendedNow = attackers(map, sq, move.side).some(
      (p) => p[0] === move.to[0] && p[1] === move.to[1],
    );
    const defendedBefore = attackers(oldMap, oldSq, move.side).some(
      (p) => p[0] === move.from[0] && p[1] === move.from[1],
    );
    const recently = ally.memories.some(
      (m) =>
        m.type === "protected_by" &&
        m.source === id &&
        own - m.createdOwnTurn < rulesFor(s).cooldown,
    );
    if (
      defendedNow &&
      !defendedBefore &&
      exchangeLoss(before.board, oldSq, move.side, oldMap) >= 100 &&
      ally.lastProtectedPosition !== position &&
      !recently
    ) {
      kingdom.cohesion++;
      ally.loyalty += 2;
      ally.lastProtectedPosition = position;
      const rival = !!ally.relationships[id]?.disputed;
      relate(s, mover, ally, rival ? 6 : 4, rival);
      remember(s, ally, "protected_by", id);
      count(s, "protections");
    }
  }
  const captured = captureSquare(before.board, move),
    capturedId = captured ? before.pieceIds[captured[0]][captured[1]] : null;
  if (capturedId && captured) {
    const victim = sim.subjects[capturedId],
      defeated = sim.kingdoms[victim.side];
    defeated.cohesion -= 2;
    defeated.prestige -= 2;
    for (const sub of Object.values(sim.subjects).filter(
      (x) =>
        x.status === "active" &&
        x.currentKind !== "k" &&
        distance(pos[x.id], captured as Square) <= 2,
    )) {
      if (sub.side === victim.side) {
        sub.fear += 4;
        sub.morale -= 4;
        if (
          before.simulation!.subjects[sub.id].relationships[capturedId]?.score >
          0
        )
          sub.morale -= 2;
        remember(s, sub, "ally_lost", capturedId);
      }
    }
    if (
      material[before.board[move.from[0]][move.from[1]]!.toLowerCase()] <
      material[before.board[captured[0]][captured[1]]!.toLowerCase()]
    ) {
      kingdom.prestige += 2;
      mover.morale += 5;
      for (const sub of Object.values(sim.subjects).filter(
        (x) =>
          x.status === "active" &&
          x.side === move.side &&
          x.currentKind !== "k" &&
          distance(pos[x.id], captured as Square) <= 2,
      ))
        sub.fear -= 2;
    }
  }
  if (before.simulation!.subjects[id].currentKind !== mover.currentKind) {
    kingdom.prestige += 3;
    mover.morale += 8;
    mover.loyalty += 5;
    mover.ambition += 8;
    remember(s, mover, "promoted", id);
    const envious = Object.values(sim.subjects)
      .filter(
        (x) =>
          x.id !== id &&
          x.side === move.side &&
          x.status === "active" &&
          x.currentKind !== "k" &&
          x.ambition >= 70 &&
          x.loyalty <= 55 &&
          distance(pos[x.id], move.to) <= 3,
      )
      .sort((a, b) => b.ambition - a.ambition || compareIds(a.id, b.id))[0];
    if (envious) {
      envious.resentment += 4;
      relate(s, envious, mover, -10);
      remember(s, envious, "promotion_envy", id, 1, rulesFor(s).grievanceTurns);
      count(s, "envy");
    }
  }
  if (
    mover.currentKind === "k" &&
    isInCheck(before.board, move.side === "white")
  ) {
    kingdom.legitimacy++;
    for (const sub of Object.values(sim.subjects).filter(
      (x) =>
        x.side === move.side &&
        x.status === "active" &&
        x.currentKind !== "k" &&
        distance(pos[x.id], king) <= 2,
    ))
      sub.fear -= 3;
  }
  const quietTurns = own - (kingdom.lastCoercionOwnTurn ?? 0);
  if (quietTurns > 0 && quietTurns % 6 === 0) kingdom.tyranny--;
  for (const sub of Object.values(sim.subjects).filter(
    (x) =>
      x.side === move.side && x.status === "active" && x.currentKind !== "k",
  )) {
    const sq = pos[sub.id],
      calm =
        !attackers(map, sq, opposite(move.side)).length &&
        attackers(map, sq, move.side).length > 0;
    if (calm) {
      sub.fear -= rulesFor(s).recoveryFear;
      sub.fatigue -= rulesFor(s).recoveryFatigue;
      if (
        distance(sq, king) <= rulesFor(s).auraRadius &&
        kingdom.legitimacy >= 60
      )
        sub.fear -= 2;
    } else sub.fatigue--;
    sub.memories = sub.memories.filter((m) => m.expiryOwnTurn > own);
  }
  tickRelationships(s, move.side);
  capDeltas(before, s);
}
