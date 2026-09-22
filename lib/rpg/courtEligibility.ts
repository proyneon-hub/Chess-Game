import { compareIds } from "./order";
import type { GameState, Side } from "@/lib/game/types";
import { rulesFor } from "./config";
import { harmfulEpisodes, progression } from "./pressure";
import { locations, distance } from "./context";
import { isInCheck } from "@/lib/chess";
export function courtEligibility(
  s: GameState,
  side: Side,
  startedInCheck = false,
) {
  const cfg = rulesFor(s).progression!,
    k = s.simulation!.kingdoms[side],
    pos = locations(s);
  const graveActions = (id: string) =>
    s.simulation?.schemaVersion === 5
      ? new Set(
          s.simulation.encounters.sides[side].harms
            .filter(
              (h) =>
                h.subject === id &&
                h.grave &&
                k.ownTurnsCompleted - h.own < cfg.graveWindow,
            )
            .map((h) => h.revision),
        ).size
      : harmfulEpisodes(s, id, cfg.graveWindow, true).length;
  const blockers: string[] = [];
  if (s.ply < rulesFor(s).crisis) blockers.push("phase");
  if (startedInCheck || isInCheck(s.board, true) || isInCheck(s.board, false))
    blockers.push("check");
  if (k.tyranny < cfg.plotTyranny) blockers.push("tyranny");
  if (k.legitimacy > cfg.plotLegitimacy) blockers.push("legitimacy");
  if (k.plotAttemptUsed) blockers.push("attempt-used");
  if (
    s.simulation!.plots.some((p) => !["resolved", "thwarted"].includes(p.stage))
  )
    blockers.push("active-plot");
  const subjects = Object.values(s.simulation!.subjects).filter(
    (x) => x.side === side && x.status === "active" && x.currentKind !== "k",
  );
  if (!subjects.some((x) => x.loyalty <= cfg.leaderLoyalty))
    blockers.push("leader-loyalty");
  if (!subjects.some((x) => x.resentment >= cfg.leaderResentment))
    blockers.push("leader-resentment");
  if (!subjects.some((x) => x.ambition >= cfg.leaderAmbition))
    blockers.push("ambition");
  const leaders = subjects.filter(
    (x) =>
      x.loyalty <= cfg.leaderLoyalty &&
      x.resentment >= cfg.leaderResentment &&
      x.ambition >= cfg.leaderAmbition,
  );
  const accomplices = subjects.filter(
    (x) =>
      x.loyalty <= cfg.accompliceLoyalty &&
      x.resentment >= cfg.accompliceResentment,
  );
  if (!accomplices.length) blockers.push("accomplice");
  if (!leaders.some((a) => graveActions(a.id) >= 2))
    blockers.push("grievance-history");
  const social = leaders.flatMap((a) =>
    accomplices.filter((b) => a.id !== b.id).map((b) => ({ a, b })),
  );
  if (
    social.length &&
    !social.some(({ a, b }) => distance(pos[a.id], pos[b.id]) <= 3)
  )
    blockers.push("proximity");
  const pairs = social
    .filter(
      ({ a, b }) =>
        distance(pos[a.id], pos[b.id]) <= 3 &&
        graveActions(a.id) >= 2 &&
        graveActions(b.id) >= 1,
    )
    .sort(
      (x, y) =>
        y.a.resentment - x.a.resentment ||
        y.a.ambition - x.a.ambition ||
        compareIds(x.a.id, y.a.id) ||
        y.b.resentment - x.b.resentment ||
        compareIds(x.b.id, y.b.id),
    )
    .slice(0, cfg.pairLimit);
  if (!pairs.length && !blockers.length) blockers.push("pair");
  const previous = progression(s).sides[side].pairs;
  if (
    pairs.length &&
    !pairs.some(({ a, b }) => (previous[`${a.id}|${b.id}`] ?? 0) >= 1)
  )
    blockers.push("streak");
  return { blockers, pairs, gate: blockers.every((b) => b === "streak") };
}
