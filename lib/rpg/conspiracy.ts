import { findKing, isInCheck, KIND_NAMES, type Side } from "@/lib/chess";
import type { CourtPlot, GameState, SubjectState } from "@/lib/game/types";
import { finish } from "@/lib/game";
import { CONFIG, clamp } from "@/lib/rpg/config";
import { distance, locations, opposite } from "@/lib/rpg/context";
import { count, event } from "@/lib/rpg/events";
import { remember } from "@/lib/rpg/subjects";
import type { Draw } from "@/lib/rpg/rng";
export const activePlot = (s: GameState) =>
  s.simulation?.plots.find(
    (p) => p.stage !== "resolved" && p.stage !== "thwarted",
  );
export function guardCount(
  s: GameState,
  p: Pick<CourtPlot, "side" | "ringleader" | "accomplice">,
) {
  const king = findKing(s.board, p.side === "white")!,
    pos = locations(s);
  return Math.min(
    3,
    Object.values(s.simulation!.subjects).filter(
      (x) =>
        x.side === p.side &&
        x.status === "active" &&
        x.currentKind !== "k" &&
        ![p.ringleader, p.accomplice].includes(x.id) &&
        x.loyalty >= 65 &&
        x.fear < 70 &&
        distance(pos[x.id], king) <= 1,
    ).length,
  );
}
function thwart(s: GameState, p: CourtPlot) {
  p.stage = "thwarted";
  s.warning = null;
  for (const id of [p.ringleader, p.accomplice]) {
    const sub = s.simulation!.subjects[id];
    if (sub.status === "active") sub.resentment = clamp(sub.resentment - 5);
  }
  event(s, "plotThwarted", "The gathering around the king breaks apart.");
}
function warning(s: GameState, p: CourtPlot) {
  const sim = s.simulation!,
    a = sim.subjects[p.ringleader],
    b = sim.subjects[p.accomplice],
    pos = locations(s);
  const message =
    p.stage === "gathering"
      ? `The ${KIND_NAMES[a.currentKind]} at ${String.fromCharCode(97 + pos[a.id][1])}${8 - pos[a.id][0]} turns away from its king.`
      : p.stage === "preparing"
        ? `The ${KIND_NAMES[a.currentKind]} and ${KIND_NAMES[b.currentKind]} at ${String.fromCharCode(97 + pos[b.id][1])}${8 - pos[b.id][0]} confer around the court.`
        : "The king's own court is turning against him.";
  p.warningEventIds.push(
    event(s, "plotWarning", message, { square: pos[a.id] }),
  );
  p.warningOwnTurns.push(sim.kingdoms[p.side].ownTurnsCompleted);
  s.warning = { message, square: pos[a.id] };
}
export function scheduleCourt(
  s: GameState,
  side: Side,
  rng: Draw,
  startedInCheck: boolean,
) {
  if (s.terminal || !s.simulation) return;
  const sim = s.simulation,
    k = sim.kingdoms[side],
    own = k.ownTurnsCompleted,
    pos = locations(s),
    check =
      startedInCheck || isInCheck(s.board, true) || isInCheck(s.board, false);
  const active = activePlot(s);
  if (active) {
    if (active.side !== side) return;
    const a = sim.subjects[active.ringleader],
      b = sim.subjects[active.accomplice];
    if (
      a.status !== "active" ||
      b.status !== "active" ||
      a.loyalty > 45 ||
      a.resentment < 55 ||
      k.legitimacy > 50 ||
      k.tyranny < 45
    ) {
      thwart(s, active);
      return;
    }
    active.separatedTurns =
      distance(pos[a.id], pos[b.id]) > 3 ? active.separatedTurns + 1 : 0;
    if (active.separatedTurns >= 2) {
      thwart(s, active);
      return;
    }
    if (own <= active.stageEnteredOwnTurn) return;
    if (active.stage === "gathering" || active.stage === "preparing") {
      active.stage = active.stage === "gathering" ? "preparing" : "armed";
      active.stageEnteredOwnTurn = own;
      warning(s, active);
      return;
    }
    if (active.stage !== "armed") return;
    const king = findKing(s.board, side === "white")!;
    if (check || distance(pos[a.id], king) > 2) {
      active.deferredTurns++;
      if (active.deferredTurns >= 2) thwart(s, active);
      return;
    }
    const guards = guardCount(s, active);
    if (guards >= 2) {
      thwart(s, active);
      return;
    }
    // These must be previously committed distinct stages, each followed by a
    // response turn. Rehydration cannot fabricate an unwarned terminal result.
    if (
      active.warningEventIds.length !== 3 ||
      active.warningOwnTurns.length !== 3 ||
      !active.warningEventIds.every((id) =>
        s.events.some((e) => e.seq === id),
      ) ||
      !(
        active.warningOwnTurns[0] < active.warningOwnTurns[1] &&
        active.warningOwnTurns[1] < active.warningOwnTurns[2] &&
        active.warningOwnTurns[2] < own
      )
    ) {
      thwart(s, active);
      return;
    }
    const p = clamp(
      0.04 +
        (0.05 * a.ambition) / 100 +
        (0.04 * k.tyranny) / 100 -
        (0.03 * k.legitimacy) / 100 -
        0.03 * guards,
      CONFIG.plotMinChance,
      CONFIG.plotMaxChance,
    );
    count(s, "armedAttempts");
    active.stage = "resolved";
    s.warning = null;
    if (rng() < p) {
      finish(s, "regicide", opposite(side));
      s.specialSquare = king;
      event(s, "regicides", s.result!, { square: king, special: true });
    } else {
      for (const sub of [a, b]) {
        sub.fear = clamp(sub.fear + 15);
        sub.morale = clamp(sub.morale - 10);
        sub.resentment = clamp(sub.resentment - 10);
        remember(s, sub, "conspiracy_aftermath", a.id, 1, 6);
      }
      k.cohesion = clamp(k.cohesion - 5);
      event(s, "plotFailed", "The king's guard breaks the conspiracy.");
    }
    return;
  }
  const gate =
    s.ply >= CONFIG.crisis &&
    !check &&
    !k.plotAttemptUsed &&
    k.tyranny >= 60 &&
    k.legitimacy <= 40;
  const subjects = Object.values(sim.subjects).filter(
    (x) => x.side === side && x.status === "active" && x.currentKind !== "k",
  );
  const leader = (x: SubjectState) =>
    x.resentment >= 75 &&
    x.loyalty <= 30 &&
    x.ambition >= 65 &&
    x.memories.some(
      (m) => m.type === "coerced" && m.target === x.id && m.expiryOwnTurn > own,
    );
  const accomplice = (x: SubjectState) => x.resentment >= 65 && x.loyalty <= 40;
  const pairs = subjects
    .filter(leader)
    .flatMap((a) =>
      subjects
        .filter(
          (b) =>
            b.id !== a.id &&
            accomplice(b) &&
            distance(pos[a.id], pos[b.id]) <= 3,
        )
        .map((b) => ({ a, b })),
    );
  const participants = new Set(
    gate ? pairs.flatMap((p) => [p.a.id, p.b.id]) : [],
  );
  for (const sub of subjects)
    sub.plotEligibilityStreak = participants.has(sub.id)
      ? sub.plotEligibilityStreak + 1
      : 0;
  if (!gate) return;
  const candidates = pairs
    .filter(
      (p) => p.a.plotEligibilityStreak >= 2 && p.b.plotEligibilityStreak >= 2,
    )
    .sort(
      (x, y) =>
        y.a.resentment - x.a.resentment ||
        y.a.ambition - x.a.ambition ||
        x.a.id.localeCompare(y.a.id) ||
        y.b.resentment - x.b.resentment ||
        y.b.ambition - x.b.ambition ||
        x.b.id.localeCompare(y.b.id),
    );
  if (!candidates.length) return;
  count(s, "eligibleKingdomTurns");
  if (rng() >= CONFIG.plotChance) return;
  const { a, b } = candidates[0];
  k.plotAttemptUsed = true;
  const plot: CourtPlot = {
    side,
    ringleader: a.id,
    accomplice: b.id,
    stage: "gathering",
    stageEnteredOwnTurn: own,
    warningEventIds: [],
    warningOwnTurns: [],
    separatedTurns: 0,
    deferredTurns: 0,
  };
  sim.plots.push(plot);
  count(s, "plots");
  warning(s, plot);
}
