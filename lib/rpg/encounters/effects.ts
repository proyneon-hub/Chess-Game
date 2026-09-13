import type { GameState, MoveAttempt } from "@/lib/game/types";
import { clamp, encounterRulesFor } from "../config";
import { count } from "../events";
import { encounters } from "./state";
import { effectiveDefenders, projectBoard } from "./objectives";
import type { Encounter, Modifier } from "./types";
export function effect(
  s: GameState,
  e: Encounter,
  participant: string,
  kind: string,
  apply: () => void,
) {
  const state = encounters(s),
    key = `${s.revision}|${e.id}|${participant}|${kind}`;
  if (
    state.ledger.includes(key) ||
    e.consumed.includes(`${participant}|${kind}`)
  )
    return;
  apply();
  state.ledger.push(key);
  e.consumed.push(`${participant}|${kind}`);
  e.effective = true;
  count(s, "encounterEffects");
}
export function grantModifier(
  s: GameState,
  e: Encounter,
  subject: string,
  kind: Modifier["kind"],
  helper: string | null = null,
) {
  const state = encounters(s),
    own = s.simulation!.kingdoms[e.side].ownTurnsCompleted;
  const pair = helper ? [subject, helper].sort().join("|") : null;
  if (pair && kind === "support" && own - (state.pairRewards[pair] ?? -100) < 6)
    return;
  if (
    state.modifiers.some(
      (m) =>
        m.subject === subject &&
        m.helper === helper &&
        m.kind === kind &&
        !m.consumed &&
        m.expires > own,
    )
  )
    return;
  effect(s, e, subject, kind, () => {
    state.modifiers.push({
      encounterId: e.id,
      subject,
      helper,
      kind,
      expires: own + (kind === "steady" ? 2 : 6),
      consumed: false,
    });
    if (pair && kind === "support") state.pairRewards[pair] = own;
  });
}
export function applicableModifiers(s: GameState, m: MoveAttempt): Modifier[] {
  if (s.simulation?.schemaVersion !== 5) return [];
  const id = s.pieceIds[m.from[0]][m.from[1]]!,
    own = s.simulation.kingdoms[m.side].ownTurnsCompleted;
  const defenders = effectiveDefenders(projectBoard(s, m), id);
  return s.simulation.encounters.modifiers.filter(
    (x) =>
      x.subject === id &&
      !x.consumed &&
      x.expires > own &&
      (x.kind === "steady" ||
        (!!x.helper &&
          defenders.includes(x.helper) &&
          (x.kind !== "dispute" || defenders.length === 1))),
  );
}
export function refusalModifier(s: GameState, m: MoveAttempt) {
  return clamp(
    applicableModifiers(s, m).reduce(
      (n, x) =>
        n +
        (x.kind === "dispute"
          ? encounterRulesFor(s).dispute
          : x.kind === "steady"
            ? encounterRulesFor(s).steady
            : encounterRulesFor(s).support),
      0,
    ),
    -encounterRulesFor(s).modifierCap,
    encounterRulesFor(s).modifierCap,
  );
}
