import type {
  GameState,
  ProgressionState,
  PressureEpisode,
} from "@/lib/game/types";
export function progression(s: GameState): ProgressionState {
  if (!s.simulation || s.simulation.schemaVersion === 2)
    throw new Error("V3 pressure state required.");
  return s.simulation.progression;
}
export const harmfulEpisodes = (
  s: GameState,
  id: string,
  window = 8,
  grave = false,
): PressureEpisode[] => {
  const own =
    s.simulation!.kingdoms[s.simulation!.subjects[id].side].ownTurnsCompleted;
  return progression(s).subjects[id].episodes.filter(
    (e) =>
      own - e.lastAppliedOwnTurn < window &&
      (!grave ||
        e.causes.some((c) =>
          [
            "coerced",
            "repeated_risky_order",
            "neglected_under_threat",
          ].includes(c),
        )),
  );
};
