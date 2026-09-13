import { KIND_NAMES, squareName } from "@/lib/chess";
import type { GameState } from "@/lib/game/types";
import { locations } from "../context";
import type { Encounter } from "./types";
export function participantLabels(s: GameState, e: Encounter) {
  const pos = locations(s);
  return e.participants
    .filter((id) => pos[id])
    .map((id) => ({
      label: `${KIND_NAMES[s.simulation!.subjects[id].currentKind]} at ${squareName(pos[id])}`,
      square: [...pos[id]] as [number, number],
    }));
}
export function encounterCopy(s: GameState, e: Encounter) {
  const labels = participantLabels(s, e).map((p) => p.label),
    who = labels.join(" and ");
  const request =
    e.family === "initiative"
      ? `The ${who} looks for room to act.`
      : e.family === "confidence"
        ? `The ${who} asks for a chance to act.`
        : e.family === "strain"
          ? `The ${who} is strained by sustained danger and asks for relief.`
          : e.family === "protection"
            ? `The ${who} asks for protection from the current threat.`
            : e.family === "relief"
              ? `The ${who} asks another piece to share its defensive burden.`
              : e.family === "dispute"
                ? `The ${who} dispute the allocation of support after recorded strain.`
                : e.family === "complaint"
                  ? `The ${who} ${e.stage > 1 ? "renew their complaint as harmful orders continue" : "bring their unresolved treatment before the king"}.`
                  : e.family === "solidarity"
                    ? `The ${who} offer renewed resolve after earlier cooperation.`
                    : `The ${who} support a shared request.`;
  const objective = e.objective;
  const response =
    objective.kind === "develop"
      ? "Give this piece a safe developing move to build confidence. You may continue another plan."
      : objective.kind === "confidence"
        ? "Give this piece a safe move to build confidence. You may continue another plan."
        : objective.kind === "protect"
          ? "Move this piece out of danger or provide effective protection."
          : objective.kind === "relieve"
            ? "Move a different piece to share this piece's defensive work without worsening the defended piece's danger."
            : objective.kind === "mediate"
              ? "Protect either piece, let one act safely without relying on the other, or separate them for two turns."
              : objective.kind === "recover"
                ? "Protect or relieve either participant, or separate them for two turns to ease the complaint."
                : objective.concern === "safety"
                  ? "Restore either participant's safety to strengthen their cooperation."
                  : "Give either participant a safe move to recognize their initiative. You may continue another plan.";
  const outcome =
    e.outcome === "fulfilled"
      ? e.family === "dispute"
        ? `The ${who} ease their dispute after the change in support.`
        : e.family === "complaint"
          ? "The court accepts the response; the complaint eases."
          : ["petition", "solidarity"].includes(e.family)
            ? "The pieces take confidence in their king's response and offer support."
            : ["initiative", "confidence"].includes(e.family)
              ? `The ${who} acts with renewed confidence; its next orders meet less hesitation.`
              : "The burden eases; effective help strengthens cooperation."
      : e.outcome === "expired"
        ? e.family === "dispute"
          ? "The disagreement remains; orders relying on the other piece may meet hesitation."
          : "The request passes without a response."
        : e.outcome === "interrupted"
          ? "The changed position closes the request."
          : e.outcome === "escalated"
            ? "The complaint has become a warned threat to the king."
            : null;
  return { message: request, response, outcome };
}
export function publicEncounters(s: GameState) {
  if (s.simulation?.schemaVersion !== 5) return [];
  const state = s.simulation.encounters;
  return [
    ...state.active,
    ...state.recent.filter(
      (e) => e.stageOwn === s.simulation!.kingdoms[e.side].ownTurnsCompleted,
    ),
  ].map((e) => ({
    id: e.id,
    side: e.side,
    participants: participantLabels(s, e),
    ...encounterCopy(s, e),
    remainingTurns:
      e.outcome === "active"
        ? Math.max(
            0,
            e.deadline - s.simulation!.kingdoms[e.side].ownTurnsCompleted,
          )
        : 0,
  }));
}
