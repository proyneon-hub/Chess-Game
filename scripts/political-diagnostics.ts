// Read-only instrumentation. Never update game counters, state or random streams.
import { findKing, type Side } from "../lib/chess";
import type { GameState, MoveAttempt, MoveResult } from "../lib/game/types";
import { agencyForecast } from "../lib/rpg/agency";
import { assessOrder } from "../lib/rpg/facts";
import { moveContext, locations, distance } from "../lib/rpg/context";
import { guardCount } from "../lib/rpg/conspiracy";
import { progression } from "../lib/rpg/pressure";
import { rulesFor } from "../lib/rpg/config";
export function politicalDiagnostics(
  before: GameState,
  move: MoveAttempt,
  result: MoveResult,
) {
  const s = result.state,
    counts: Record<string, number> = {};
  if (s.schemaVersion < 3) return { counts, plots: [] };
  const add = (key: string, n = 1) => {
    if (n) counts[key] = (counts[key] ?? 0) + n;
  };
  const f = agencyForecast(before, move),
    a = assessOrder(before, move),
    c = moveContext(before, move);
  if (!f.guaranteed && a.residual >= 100) {
    add("dangerousCommands");
    add("dangerFearBelow60", Number(c.sub.fear < 60));
    add("dangerFear60to64", Number(c.sub.fear >= 60 && c.sub.fear < 65));
    add("dangerFearAtLeast65", Number(c.sub.fear >= 65));
    add(
      "retreatLoyaltyBlocked",
      Number(c.sub.loyalty > rulesFor(before).progression!.retreatLoyalty),
    );
  }
  add("retreatOpportunities", Number(f.retreat > 0));
  add("retreats", Number(result.resolution === "autonomous"));
  add("disputeRelevantCommands", Number(c.disputeRelevant));
  add("eligibleDisputeCommands", Number(c.disputeRelevant && !f.guaranteed));
  add(
    "contextualRefusals",
    Number(
      c.disputeRelevant &&
        result.resolution === "refused" &&
        s.schemaVersion === 4,
    ),
  );
  if (result.turnConsumed) {
    for (const key of [
      "rivalFriction",
      "disputes",
      "eligibleKingdomTurns",
      "plots",
      "plotWarning",
      "armedAttempts",
      "plotFailed",
      "regicides",
    ])
      add(
        key,
        (s.simulation!.counters[key] ?? 0) -
          (before.simulation!.counters[key] ?? 0),
      );
    const own = s.simulation!.kingdoms[move.side].ownTurnsCompleted;
    for (const sub of Object.values(s.simulation!.subjects).filter(
      (x) =>
        x.side === move.side &&
        x.status === "active" &&
        ["proud", "ambitious"].includes(x.personality),
    )) {
      const cfg = rulesFor(s).progression!;
      if (
        sub.resentment <
        cfg.frictionResentment -
          Math.round(Math.max(-2, Math.min(2, (sub.ambition - 60) / 20)))
      )
        continue;
      const episodes = progression(s).subjects[sub.id].episodes.filter(
        (e) =>
          e.cause === "avoidable_exposure" &&
          e.defenderIds.length === 1 &&
          own - e.openedOwnTurn < 12,
      );
      for (const id of new Set(episodes.map((e) => e.defenderIds[0]))) {
        const pair = episodes.filter((e) => e.defenderIds[0] === id);
        if (
          pair.length >= 2 &&
          pair.filter((e) => own - e.openedOwnTurn < 8).length < 2
        )
          add("frictionWindow8Blocked12Available");
      }
    }
  }
  const pos = locations(s);
  const plots = s.simulation!.plots.flatMap((p) => {
    const old = before.simulation!.plots.find((q) => q.side === p.side);
    if (old && ["resolved", "thwarted"].includes(old.stage)) return [];
    const leader = s.simulation!.subjects[p.ringleader],
      accomplice = s.simulation!.subjects[p.accomplice];
    const king = findKing(s.board, p.side === "white")!;
    const termination =
      p.stage === "thwarted"
        ? (Object.keys(s.simulation!.counters)
            .find(
              (k) =>
                k.startsWith("thwart:") &&
                (s.simulation!.counters[k] ?? 0) >
                  (before.simulation!.counters[k] ?? 0),
            )
            ?.slice(7) ?? "unknown")
        : p.stage === "resolved"
          ? s.terminal?.reason === "regicide"
            ? "regicide"
            : "attempt-failed"
          : (s.terminal?.reason ?? null);
    if (!old || old.stage !== p.stage) add(`stage:${p.stage}`);
    if (p.deferredTurns > (old?.deferredTurns ?? 0)) add("armedDeferrals");
    return [
      {
        ply: s.ply,
        revision: s.revision,
        actingSide: move.side,
        side: p.side as Side,
        stage: p.stage,
        warningCount: p.warningEventIds.length,
        warningOwnTurns: [...p.warningOwnTurns],
        leaderAlive: leader.status === "active",
        accompliceAlive: accomplice.status === "active",
        kingDistance: pos[leader.id] ? distance(pos[leader.id], king) : null,
        participantDistance:
          pos[leader.id] && pos[accomplice.id]
            ? distance(pos[leader.id], pos[accomplice.id])
            : null,
        guards: guardCount(s, p),
        deferredTurns: p.deferredTurns,
        termination,
      },
    ];
  });
  return { counts, plots };
}
