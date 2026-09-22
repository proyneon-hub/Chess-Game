import { capabilities, hasEncounters } from "@/lib/rpg/capabilities";
import {
  evaluateObjective,
  projectBoard,
} from "@/lib/rpg/encounters/objectives";
import { type Board, type Square, findKing } from "@/lib/chess";
import type {
  CourtPlot,
  GameState,
  KingdomState,
  Side,
  SubjectState,
} from "@/lib/game/types";
import {
  locations,
  distance,
  exchangeLoss,
  attackMap,
  attackers,
} from "@/lib/rpg/context";
import { clamp, encounterRulesFor } from "@/lib/rpg/config";
import type { ChessMove } from "@/lib/chessRules";
import {
  leadershipView,
  materializeView,
  type LeadershipView,
} from "./leadershipView";
import { agencyForecast } from "@/lib/rpg/agency";
export type OwnPolitics = {
  view?: LeadershipView;
  side: Side;
  kingdom: KingdomState;
  subjects: Record<string, SubjectState>;
  positions: Record<string, Square>;
  plot: CourtPlot | null;
};
export function ownPolitics(s: GameState, side: Side): OwnPolitics | null {
  if (!s.simulation) return null;
  const positions = locations(s),
    subjects: Record<string, SubjectState> = {},
    ownPositions: Record<string, Square> = {};
  for (const sub of Object.values(s.simulation.subjects).filter(
    (x) => x.side === side && x.status === "active",
  )) {
    subjects[sub.id] = structuredClone(sub);
    ownPositions[sub.id] = positions[sub.id];
  }
  return {
    ...(capabilities(s).progression ? { view: leadershipView(s, side) } : {}),
    side,
    kingdom: structuredClone(s.simulation.kingdoms[side]),
    subjects,
    positions: ownPositions,
    plot: structuredClone(
      s.simulation.plots.find(
        (p) => p.side === side && !["resolved", "thwarted"].includes(p.stage),
      ) ?? null,
    ),
  };
}
export function politicalScore(
  before: Board,
  after: Board,
  move: ChessMove,
  own: OwnPolitics | null,
): number {
  if (!own) return 0;
  const id = Object.keys(own.positions).find(
    (id) =>
      own.positions[id][0] === move.from[0] &&
      own.positions[id][1] === move.from[1],
  );
  if (!id) return 0;
  const sub = own.subjects[id],
    map = attackMap(after),
    king = findKing(after, own.side === "white")!;
  const loss = exchangeLoss(after, move.to, own.side, map),
    rescued = exchangeLoss(before, move.from, own.side) > loss;
  const expectedObedience = own.view
    ? 1 - agencyForecast(materializeView(own.view), move).refusal
    : clamp(
        1 -
          (((0.1 * sub.fear) / 100) * Number(loss >= 100) +
            (0.1 * sub.resentment) / 100 -
            (0.06 * sub.loyalty) / 100 -
            (0.03 * own.kingdom.legitimacy) / 100),
        0.78,
        1,
      );
  let score =
    (expectedObedience - 1) * 100 +
    (rescued ? 25 : 0) -
    sub.resentment * 0.1 -
    Number(loss >= 100) * sub.fear * 0.2;
  for (const [ally, sq] of Object.entries(own.positions)) {
    if (
      ally !== id &&
      exchangeLoss(before, sq, own.side) >= 100 &&
      attackers(map, sq, own.side).some(
        (p) => p[0] === move.to[0] && p[1] === move.to[1],
      )
    )
      score += 10;
  }
  if (hasEncounters(own.view?.simulation)) {
    const state = materializeView(own.view);
    if (hasEncounters(state.simulation)) {
      const projected = projectBoard(state, move);
      let accommodation = 0,
        courtObligation = 0;
      for (const encounter of state.simulation.encounters.active.filter(
        (e) => e.side === own.side,
      )) {
        const response = evaluateObjective(
          state,
          projected,
          move,
          encounter.objective,
        );
        const remaining = encounter.deadline - own.kingdom.ownTurnsCompleted;
        if (response.success)
          accommodation = Math.max(
            accommodation,
            remaining <= 1 ? encounterRulesFor(state).aiAccommodation : 50,
          );
        else if (response.progress && remaining >= 2)
          accommodation = Math.max(accommodation, 25);
        else if (encounter.family === "complaint" && encounter.stage === 2)
          courtObligation = -40;
      }
      score += accommodation + courtObligation;
    }
  }
  score = clamp(score, -100, 100);
  if (own.plot) {
    const p = own.plot,
      leader = id === p.ringleader ? move.to : own.positions[p.ringleader];
    const guards = Object.keys(own.subjects).filter((x) => {
      const sub = own.subjects[x],
        sq = x === id ? move.to : own.positions[x];
      return (
        sub.currentKind !== "k" &&
        ![p.ringleader, p.accomplice].includes(x) &&
        sub.loyalty >= 65 &&
        sub.fear < 70 &&
        distance(sq, king) <= 1
      );
    }).length;
    // Imminent own terminal risk is outside the centipawn mood cap.
    if (
      p.stage === "armed" &&
      leader &&
      distance(leader, king) <= 2 &&
      guards < 2
    )
      score -= 30000;
    else if (guards >= 2 || (leader && distance(leader, king) > 2))
      score += p.stage === "armed" ? 30000 : 80;
  }
  return own.plot?.stage === "armed" ? score : clamp(score, -100, 100);
}
