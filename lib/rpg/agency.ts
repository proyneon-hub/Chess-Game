import { applicableModifiers } from "./encounters/effects";
import {
  applyMove,
  findKing,
  getLegalMoves,
  isInCheck,
  KIND_NAMES,
  squareName,
  sameSquare,
  validSquare,
  type Square,
} from "@/lib/chess";
import { captureSquare, legalFinalBoard } from "@/lib/chessRules";
import type { GameState, MoveAttempt } from "@/lib/game/types";
import { rulesFor, clamp, configFor } from "@/lib/rpg/config";
import {
  distance,
  exchangeLoss,
  moveContext,
  locations,
} from "@/lib/rpg/context";
import type { Draw } from "@/lib/rpg/rng";
import { count } from "@/lib/rpg/events";
import { forecastV3 } from "./forecast";
import { progression } from "./pressure";
export const agencyForecast = (s: GameState, m: MoveAttempt) => {
  if (rulesFor(s).generation >= 3) return forecastV3(s, m);
  const guaranteed =
    s.ply < rulesFor(s).grace ||
    s.board[m.from[0]][m.from[1]]?.toLowerCase() === "k" ||
    !!s.pendingRefusal ||
    isInCheck(s.board, m.side === "white");
  const refusal = guaranteed ? 0 : refusalProbability(s, m).probability;
  return {
    refusal,
    retreat: 0,
    heroism: 0,
    execution: 1 - refusal,
    guaranteed,
    contributions: {},
    retreatTo: null,
    heroicTo: null,
  };
};
export function refusalProbability(s: GameState, m: MoveAttempt) {
  if (rulesFor(s).generation >= 3)
    return {
      probability: forecastV3(s, m).refusal,
      context: moveContext(s, m),
    };
  const c = moveContext(s, m),
    sub = c.sub,
    k = s.simulation!.kingdoms[m.side];
  const pressure = clamp(
    0.4 * Number(c.afterLoss >= 100) +
      0.25 * Number(c.currentlyAttacked) +
      0.2 * Number(c.isolatedFromKing) +
      0.15 * Number(c.disputeRelevant),
    0,
    1,
  );
  const personality =
    sub.personality === "timid"
      ? 0.02
      : sub.personality === "steadfast"
        ? -0.02
        : sub.personality === "proud" && c.disputeRelevant
          ? 0.015
          : sub.personality === "pragmatic"
            ? c.afterLoss >= 100
              ? 0.02
              : -0.01
            : 0;
  const memory = clamp(
    sub.memories.reduce(
      (n, m) =>
        n +
        (["coerced", "dispute", "promotion_envy"].includes(m.type)
          ? 0.005
          : ["rescued", "protected_by"].includes(m.type)
            ? -0.005
            : 0),
      0,
    ),
    -0.03,
    0.03,
  );
  const aura = c.isolatedFromKing
    ? 0
    : k.kingStrength === 20
      ? -0.03
      : k.kingStrength >= 15
        ? -0.02
        : k.kingStrength >= 10
          ? -0.01
          : k.kingStrength < 5
            ? 0.01
            : 0;
  const p = clamp(
    configFor(s.configVersion)!.agencyBase +
      ((0.1 * sub.fear) / 100) * pressure +
      (0.1 * sub.resentment) / 100 +
      (0.04 * sub.fatigue) / 100 +
      0.04 * Number(c.disputeRelevant) -
      (0.06 * sub.loyalty) / 100 -
      (0.03 * sub.courage) / 100 -
      (0.03 * k.legitimacy) / 100 -
      (((0.04 * k.tyranny) / 100) * sub.fear) / 100 +
      personality +
      memory +
      aura,
    0,
    rulesFor(s).refusalMax,
  );
  return { probability: p, context: c };
}
const phaseName = (s: GameState) =>
  s.ply < rulesFor(s).established
    ? "discovery"
    : s.ply < rulesFor(s).crisis
      ? "established"
      : "crisis";
export function agency(s: GameState, m: MoveAttempt, rng: Draw) {
  const sim = s.simulation!,
    sub = sim.subjects[s.pieceIds[m.from[0]][m.from[1]]!],
    name = KIND_NAMES[sub.currentKind];
  const normal = {
    outcome: "obeyed" as "obeyed" | "retreat" | "heroic",
    kind: "executed" as "executed" | "refused" | "autonomous",
    destination: m.to,
    special: false,
    message: "",
  };
  if (rulesFor(s).generation >= 3) {
    const f = forecastV3(s, m);
    if (f.guaranteed) return normal;
    count(s, "eligibleCommands");
    count(s, `eligible:${m.side}:${sub.personality}:${phaseName(s)}`);
    const roll = rng();
    sim.privateEvents.push({
      seq: ++s.eventSeq,
      code: "agency",
      subjectId: sub.id,
      details: {
        roll,
        refusalProbability: f.refusal,
        retreatProbability: f.retreat,
        heroicProbability: f.heroism,
      },
    });
    sim.privateEvents = sim.privateEvents.slice(-rulesFor(s).privateEventLimit);
    if (roll < f.refusal) {
      sub.fear = clamp(sub.fear + 2);
      sub.resentment = clamp(sub.resentment + 2);
      count(s, `refused:${m.side}:${sub.personality}`);
      const c = s.schemaVersion >= 4 ? moveContext(s, m) : null;
      const rivalId =
        s.schemaVersion !== 5 && c?.disputeRelevant
          ? c.defenders[0]
          : s.schemaVersion === 5
            ? applicableModifiers(s, m).find((x) => x.kind === "dispute")
                ?.helper
            : null;
      const rival = rivalId ? sim.subjects[rivalId] : null;
      return {
        ...normal,
        kind: "refused" as const,
        message: rival
          ? `The ${name} at ${squareName(m.from)} hesitates under the ${KIND_NAMES[rival.currentKind]} at ${squareName(locations(s)[rival.id])}'s watch.`
          : `The ${name} hesitates before moving to ${String.fromCharCode(97 + m.to[1])}${8 - m.to[0]}.`,
      };
    }
    if (roll < f.refusal + f.retreat && f.retreatTo) {
      const p = progression(s);
      p.subjects[sub.id].lastRetreat = sim.kingdoms[m.side].ownTurnsCompleted;
      p.sides[m.side].retreats++;
      if (sim.schemaVersion === 5)
        sim.encounters.sides[m.side].lastWithdrawal =
          sim.kingdoms[m.side].ownTurnsCompleted;
      return {
        ...normal,
        kind: "autonomous" as const,
        outcome: "retreat" as const,
        destination: f.retreatTo,
        special: true,
        message:
          s.schemaVersion === 5
            ? `The ${name} withdraws ${exchangeLoss(applyMove(s.board, m.from, f.retreatTo, m.promotion, s.rights), f.retreatTo, m.side) < 100 ? "to safety" : "to reduce the danger"} after its earlier warning.`
            : `The ${name} withdraws from the attack.`,
      };
    }
    if (roll < f.refusal + f.retreat + f.heroism && f.heroicTo) {
      sim.kingdoms[m.side].extensionsUsed++;
      count(s, "extensions");
      return {
        ...normal,
        destination: f.heroicTo,
        outcome: "heroic" as const,
        special: true,
        message: `The ${name} carries the charge farther than ordered.`,
      };
    }
    return normal;
  }
  if (
    s.ply < rulesFor(s).grace ||
    sub.currentKind === "k" ||
    s.pendingRefusal ||
    isInCheck(s.board, m.side === "white")
  )
    return normal;
  count(s, "eligibleCommands");
  count(s, `eligible:${m.side}:${sub.personality}:${phaseName(s)}`);
  const { probability: p, context } = refusalProbability(s, m),
    roll = rng();
  sim.privateEvents.push({
    seq: ++s.eventSeq,
    code: "agency",
    subjectId: sub.id,
    details: { roll, refusalProbability: p, pressureLoss: context.afterLoss },
  });
  sim.privateEvents = sim.privateEvents.slice(-rulesFor(s).privateEventLimit);
  if (roll < p) {
    sub.fear = clamp(sub.fear + 2);
    sub.resentment = clamp(sub.resentment + 2);
    count(s, `refused:${m.side}:${sub.personality}`);
    const rival = context.disputeRelevant
      ? sim.subjects[context.defenders[0]]
      : null;
    return {
      ...normal,
      kind: "refused" as const,
      message: rival
        ? `The ${name} hesitates under the ${KIND_NAMES[rival.currentKind]}'s watch.`
        : `The ${name} hesitates before moving to ${String.fromCharCode(97 + m.to[1])}${8 - m.to[0]}.`,
    };
  }
  const retreatProbability =
    s.ply >= rulesFor(s).established && sub.fear >= 75 && sub.loyalty <= 55
      ? Math.min(
          rulesFor(s).retreatMax,
          ((0.05 * sub.fear) / 100) * (1 - sub.loyalty / 100),
        )
      : 0;
  if (roll < p + retreatProbability) {
    const king = findKing(s.board, m.side === "white")!;
    const candidates = getLegalMoves(
      s.board,
      ...m.from,
      m.side === "white",
      s.rights,
    )
      .filter(
        (to) => !sameSquare(to, m.to) && !captureSquare(s.board, { ...m, to }),
      )
      .map((to) => ({
        to,
        loss: exchangeLoss(
          applyMove(s.board, m.from, to, m.promotion, s.rights),
          to,
          m.side,
        ),
      }))
      .filter((x) => x.loss < context.afterLoss)
      .sort(
        (a, b) =>
          distance(a.to, king) - distance(b.to, king) ||
          a.loss - b.loss ||
          a.to[0] - b.to[0] ||
          a.to[1] - b.to[1],
      );
    if (candidates.length) {
      const destination = candidates[0].to;
      return {
        kind: "autonomous" as const,
        outcome: "retreat" as const,
        destination,
        special: true,
        message:
          distance(destination, king) < distance(m.from, king)
            ? `The ${name} withdraws toward its king.`
            : `The ${name} withdraws from the attack.`,
      };
    }
  }
  if (
    s.ply >= rulesFor(s).established &&
    sub.morale >= 75 &&
    sub.loyalty >= 65 &&
    sim.kingdoms[m.side].extensionsUsed < rulesFor(s).extensionLimit &&
    "rbqn".includes(sub.currentKind) &&
    !s.board[m.to[0]][m.to[1]] &&
    Math.floor(rng() * 20) === 19 &&
    rng() <= rulesFor(s).heroicChance
  ) {
    const destination: Square = [
      m.to[0] + Math.sign(m.to[0] - m.from[0]),
      m.to[1] + Math.sign(m.to[1] - m.from[1]),
    ];
    if (
      validSquare(destination) &&
      !s.board[destination[0]][destination[1]] &&
      legalFinalBoard(applyMove(s.board, m.from, destination), m.side)
    ) {
      sim.kingdoms[m.side].extensionsUsed++;
      count(s, "extensions");
      return {
        kind: "executed" as const,
        outcome: "heroic" as const,
        destination,
        special: true,
        message: `The ${name} carries the charge farther than ordered.`,
      };
    }
  }
  return normal;
}
