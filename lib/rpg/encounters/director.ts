import { hasEncounters } from "@/lib/rpg/capabilities";
import { compareIds } from "../order";
import { isInCheck } from "@/lib/chess";
import type { GameState, Side } from "@/lib/game/types";
import { encounterRulesFor } from "../config";
import { count, event } from "../events";
import { encounters, encounterPhase } from "./state";
import { candidates } from "./candidates";
import { encounterCopy } from "./publicView";
import type { Encounter } from "./types";
export function scheduleEncounter(s: GameState, movedSide: Side) {
  if (
    !hasEncounters(s.simulation) ||
    s.terminal ||
    s.ply < encounterRulesFor(s).firstPly
  )
    return;
  const state = encounters(s);
  if (
    s.ply < state.duePly ||
    s.ply - state.lastStartPly < encounterRulesFor(s).minimumGap
  )
    return;
  if (isInCheck(s.board, true) || isInCheck(s.board, false)) {
    count(s, "encounterBlocker:check");
    return;
  }
  // The pending refusal belongs to the just-completed action and is cleared
  // by the atomic commit; a refusal-only reducer path never reaches here.
  const sides: Side[] = [movedSide === "white" ? "black" : "white", movedSide];
  sides.sort((a, b) => state.sides[a].lastStart - state.sides[b].lastStart);
  const available = sides.flatMap((side) => {
    const generated = candidates(s, side);
    for (const blocker of generated.blockers)
      count(s, `encounterBlocker:${blocker}`);
    return generated.candidates;
  });
  available.sort(
    (a, b) =>
      a.priority - b.priority ||
      b.relevance - a.relevance ||
      (state.sides[a.side].family[a.family] ?? -100) -
        (state.sides[b.side].family[b.family] ?? -100) ||
      state.sides[a.side].lastStart - state.sides[b.side].lastStart ||
      Math.max(...a.participants.map((id) => state.subjects[id].lastStart)) -
        Math.max(...b.participants.map((id) => state.subjects[id].lastStart)) ||
      compareIds(a.participants.join(), b.participants.join()),
  );
  const candidate = available[0];
  if (candidate) {
    const side = candidate.side;
    const own = s.simulation.kingdoms[side].ownTurnsCompleted;
    const e: Encounter = {
      family: candidate.family,
      side: candidate.side,
      participants: candidate.participants,
      objective: candidate.objective,
      causes: candidate.causes,
      parent: candidate.parent,
      id: `encounter-${++state.serial}`,
      phase: encounterPhase(s.ply),
      createdPly: s.ply,
      createdOwn: own,
      deadline:
        own +
        (candidate.family === "complaint"
          ? encounterRulesFor(s).complaintDeadline
          : ["petition", "solidarity"].includes(candidate.family)
            ? encounterRulesFor(s).petitionWindow
            : encounterRulesFor(s).personalWindow),
      stage: 1,
      stageOwn: own,
      outcome: "active",
      consumed: [],
      interacted: false,
      effective: false,
    };
    state.active.push(e);
    state.lastStartPly = s.ply;
    state.duePly = s.ply + encounterRulesFor(s).cadence;
    state.sides[side].lastStart = own;
    state.sides[side].family[e.family] = own;
    for (const id of e.participants) state.subjects[id].lastStart = own;
    if (e.family === "strain")
      state.subjects[e.participants[0]].warningOwn = own;
    count(s, "encounterOffers");
    count(s, `encounterFamily:${e.family}`);
    event(s, "encounterOffer", encounterCopy(s, e).message);
    return;
  }
}
