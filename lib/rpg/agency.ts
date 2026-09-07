import {
  applyMove,
  findKing,
  getLegalMoves,
  isInCheck,
  KIND_NAMES,
  sameSquare,
  validSquare,
  type Square,
} from "@/lib/chess";
import { captureSquare, legalFinalBoard } from "@/lib/chessRules";
import type { GameState, MoveAttempt } from "@/lib/game/types";
import { CONFIG, clamp, configFor } from "@/lib/rpg/config";
import { distance, exchangeLoss, moveContext } from "@/lib/rpg/context";
import type { Draw } from "@/lib/rpg/rng";
import { count } from "@/lib/rpg/events";
export function refusalProbability(s: GameState, m: MoveAttempt) {
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
    CONFIG.refusalMax,
  );
  return { probability: p, context: c };
}
export function agency(s: GameState, m: MoveAttempt, rng: Draw) {
  const sim = s.simulation!,
    sub = sim.subjects[s.pieceIds[m.from[0]][m.from[1]]!],
    name = KIND_NAMES[sub.currentKind];
  const normal = {
    kind: "executed" as "executed" | "refused" | "autonomous",
    destination: m.to,
    special: false,
    message: "",
  };
  if (
    s.ply < CONFIG.grace ||
    sub.currentKind === "k" ||
    s.pendingRefusal ||
    isInCheck(s.board, m.side === "white")
  )
    return normal;
  count(s, "eligibleCommands");
  count(
    s,
    `eligible:${m.side}:${sub.personality}:${s.ply < 16 ? "discovery" : s.ply < 40 ? "established" : "crisis"}`,
  );
  const { probability: p, context } = refusalProbability(s, m),
    roll = rng();
  sim.privateEvents.push({
    seq: ++s.eventSeq,
    code: "agency",
    subjectId: sub.id,
    details: { roll, refusalProbability: p, pressureLoss: context.afterLoss },
  });
  sim.privateEvents = sim.privateEvents.slice(-CONFIG.privateEventLimit);
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
    s.ply >= CONFIG.established && sub.fear >= 75 && sub.loyalty <= 55
      ? Math.min(
          CONFIG.retreatMax,
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
    s.ply >= CONFIG.established &&
    sub.morale >= 75 &&
    sub.loyalty >= 65 &&
    sim.kingdoms[m.side].extensionsUsed < CONFIG.extensionLimit &&
    "rbqn".includes(sub.currentKind) &&
    !s.board[m.to[0]][m.to[1]] &&
    Math.floor(rng() * 20) === 19 &&
    rng() <= CONFIG.heroicChance
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
        destination,
        special: true,
        message: `The ${name} carries the charge farther than ordered.`,
      };
    }
  }
  return normal;
}
