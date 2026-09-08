import type { GameState, SubjectState, SubjectMemory } from "@/lib/game/types";
import { rulesFor, clamp } from "@/lib/rpg/config";
export const numericSubjectFields = [
  "loyalty",
  "morale",
  "fear",
  "resentment",
  "ambition",
  "courage",
  "fatigue",
] as const;
export function remember(
  s: GameState,
  sub: SubjectState,
  type: string,
  source: string,
  intensity = 1,
  duration: number = rulesFor(s).memoryTurns,
) {
  const own = s.simulation!.kingdoms[sub.side].ownTurnsCompleted;
  const memory: SubjectMemory = {
    type,
    source,
    target: sub.id,
    intensity,
    createdOwnTurn: own,
    expiryOwnTurn: own + duration,
    action: s.revision,
  };
  if (
    !sub.memories.some(
      (m) => m.type === type && m.source === source && m.action === s.revision,
    )
  )
    sub.memories.push(memory);
  sub.memories = sub.memories.slice(-rulesFor(s).memoryLimit);
}
export function capDeltas(before: GameState, s: GameState) {
  const sim = s.simulation!;
  for (const sub of Object.values(sim.subjects))
    for (const key of numericSubjectFields)
      sub[key] = clamp(
        Math.round(
          clamp(
            sub[key],
            before.simulation!.subjects[sub.id][key] -
              rulesFor(s).subjectDeltaCap,
            before.simulation!.subjects[sub.id][key] +
              rulesFor(s).subjectDeltaCap,
          ),
        ),
      );
  for (const side of ["white", "black"] as const)
    for (const key of [
      "tyranny",
      "legitimacy",
      "cohesion",
      "prestige",
    ] as const)
      sim.kingdoms[side][key] = clamp(
        Math.round(
          clamp(
            sim.kingdoms[side][key],
            before.simulation!.kingdoms[side][key] -
              rulesFor(s).kingdomDeltaCap,
            before.simulation!.kingdoms[side][key] +
              rulesFor(s).kingdomDeltaCap,
          ),
        ),
      );
}
