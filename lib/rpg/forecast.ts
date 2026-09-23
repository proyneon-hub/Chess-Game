import { capabilities, hasEncounters } from "@/lib/rpg/capabilities";
import { refusalModifier } from "./encounters/effects";
import {
  applyMove,
  findKing,
  getLegalMoves,
  isInCheck,
  sameSquare,
  validSquare,
  type Square,
} from "@/lib/chess";
import { captureSquare, legalFinalBoard } from "@/lib/chessRules";
import type { GameState, MoveAttempt } from "@/lib/game/types";
import { rulesFor, clamp } from "./config";
import { distance, exchangeLoss, moveContext } from "./context";
import { assessOrder } from "./facts";
import { harmfulEpisodes, progression } from "./pressure";
export type AgencyForecast = {
  refusal: number;
  retreat: number;
  heroism: number;
  execution: number;
  guaranteed: boolean;
  contributions: Record<string, number>;
  retreatTo: Square | null;
  heroicTo: Square | null;
};
export function forecastV3(s: GameState, m: MoveAttempt): AgencyForecast {
  const rules = rulesFor(s),
    cfg = rules.progression!,
    c = moveContext(s, m),
    sub = c.sub,
    k = s.simulation!.kingdoms[m.side];
  const result: AgencyForecast = {
    refusal: 0,
    retreat: 0,
    heroism: 0,
    execution: 1,
    guaranteed: false,
    contributions: {},
    retreatTo: null,
    heroicTo: null,
  };
  if (
    (capabilities(s).graceInclusive
      ? s.ply <= rules.grace
      : s.ply < rules.grace) ||
    sub.currentKind === "k" ||
    s.pendingRefusal ||
    s.simulation!.turnContext.refusalUsed ||
    isInCheck(s.board, m.side === "white")
  ) {
    result.guaranteed = true;
    return result;
  }
  const assessment = assessOrder(s, m),
    risk = Number(assessment.residual >= 100),
    harm = harmfulEpisodes(s, sub.id, cfg.harmWindow),
    grievance = !!sub.grievance || harm.length > 0;
  const pressure = clamp(
    0.4 * risk +
      0.25 * Number(c.currentlyAttacked) +
      0.2 * Number(c.isolatedFromKing) +
      0.15 * Number(capabilities(s).disputeRefusals && c.disputeRelevant),
    0,
    1,
  );
  const aura = c.isolatedFromKing
    ? 0
    : k.kingStrength === 20
      ? -0.006
      : k.kingStrength >= 15
        ? -0.004
        : k.kingStrength >= 10
          ? -0.002
          : k.kingStrength < 5
            ? 0.002
            : 0;
  const confidence = ((assessment.captured ? sub.power : sub.skill) - 1) / 4;
  result.contributions = {
    base: rules.agencyBase,
    fear: ((cfg.fearWeight * sub.fear) / 100) * pressure,
    resentment: (cfg.resentmentWeight * sub.resentment) / 100,
    fatigue: (cfg.fatigueWeight * sub.fatigue) / 100,
    dispute:
      cfg.disputeWeight *
      Number(capabilities(s).disputeRefusals && c.disputeRelevant),
    harm: cfg.harmWeight * Math.min(1, harm.length / 3),
    loyalty: -cfg.loyaltyWeight * (sub.loyalty / 100 - 0.65),
    courage: -cfg.courageWeight * (sub.courage / 100 - 0.5),
    legitimacy: -cfg.legitimacyWeight * (k.legitimacy / 100 - 0.65),
    morale: clamp(-cfg.moraleWeight * (sub.morale / 100 - 0.65), -0.02, 0.02),
    cohesion: clamp(
      -cfg.cohesionWeight * (k.cohesion / 100 - 0.65),
      -0.01,
      0.01,
    ),
    prestige: clamp(
      -cfg.prestigeWeight * (k.prestige / 100 - 0.5),
      -0.005,
      0.005,
    ),
    tyranny: (((-cfg.tyrannyFearWeight * k.tyranny) / 100) * sub.fear) / 100,
    confidence: -cfg.confidenceWeight * confidence,
    personality:
      sub.personality === "timid"
        ? 0.007
        : sub.personality === "steadfast"
          ? -0.007
          : sub.personality === "proud" && grievance
            ? 0.005
            : sub.personality === "pragmatic"
              ? risk
                ? 0.005
                : -0.003
              : 0,
    aura,
  };
  result.refusal = clamp(
    Object.values(result.contributions).reduce((n, x) => n + x, 0),
    0,
    rules.refusalMax,
  );
  if (
    sub.fear <= 25 &&
    sub.resentment <= 20 &&
    !grievance &&
    assessment.residual < 100
  )
    result.refusal = Math.min(result.refusal, cfg.calmCap);
  if (hasEncounters(s.simulation)) {
    const modifier = refusalModifier(s, m);
    result.contributions.encounter = modifier;
    const without = result.refusal;
    result.refusal = clamp(result.refusal + modifier, 0, rules.refusalMax);
    result.contributions.encounterApplied = result.refusal - without;
  }
  const p = progression(s),
    q = p.subjects[sub.id],
    own = k.ownTurnsCompleted;
  const encounterState = hasEncounters(s.simulation)
    ? s.simulation.encounters
    : null;
  const warned = encounterState?.subjects[sub.id].warningOwn;
  if (
    s.ply >= rules.established &&
    (encounterState
      ? sub.fear >= rules.encounters!.withdrawalFear &&
        warned !== null &&
        warned !== undefined &&
        own > warned &&
        own - encounterState.sides[m.side].lastWithdrawal >=
          rules.encounters!.withdrawalGap
      : sub.fear >= cfg.retreatFear && sub.loyalty <= cfg.retreatLoyalty) &&
    assessment.residual >= 100 &&
    own - q.lastRetreat >= rules.cooldown &&
    p.sides[m.side].retreats <
      (encounterState ? rules.encounters!.withdrawalLimit : cfg.retreatLimit)
  ) {
    const king = findKing(s.board, m.side === "white")!;
    const options = getLegalMoves(
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
      .filter(
        (x) => x.loss < (encounterState ? assessment.residual : c.afterLoss),
      )
      .sort(
        (a, b) =>
          (encounterState
            ? a.loss - b.loss
            : distance(a.to, king) - distance(b.to, king)) ||
          distance(a.to, king) - distance(b.to, king) ||
          a.loss - b.loss ||
          a.to[0] - b.to[0] ||
          a.to[1] - b.to[1],
      );
    if (options.length) {
      result.retreat = encounterState
        ? Math.min(
            rules.encounters!.withdrawalMax,
            rules.encounters!.withdrawalBase +
              Number(sub.fear >= 70) * rules.encounters!.withdrawalHighFear +
              Number(sub.loyalty < 50) * rules.encounters!.withdrawalLowLoyalty,
          )
        : rules.retreatMax;
      result.retreatTo = options[0].to;
    }
  }
  if (
    s.ply >= rules.established &&
    sub.morale >= 75 &&
    sub.loyalty >= 65 &&
    k.extensionsUsed < rules.extensionLimit &&
    "rbqn".includes(sub.currentKind) &&
    !s.board[m.to[0]][m.to[1]]
  ) {
    const to: Square = [
      m.to[0] + Math.sign(m.to[0] - m.from[0]),
      m.to[1] + Math.sign(m.to[1] - m.from[1]),
    ];
    if (
      validSquare(to) &&
      !s.board[to[0]][to[1]] &&
      legalFinalBoard(applyMove(s.board, m.from, to), m.side)
    ) {
      result.heroicTo = to;
      result.heroism =
        (1 - result.refusal - result.retreat) * 0.05 * rules.heroicChance;
    }
  }
  result.execution = 1 - result.refusal - result.retreat - result.heroism;
  return result;
}
