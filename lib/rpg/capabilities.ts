import type { HiddenSimulation, ProgressionState } from "@/lib/game/types";
import type { EncounterState } from "@/lib/rpg/encounters/types";

/**
 * What each rules generation does, by name. A saved game keeps its
 * generation forever, so an existing row must never change; new behavior
 * gets a new generation (and config) instead. Saved-state validators and
 * initializers still branch on schemaVersion because they describe data
 * shape, not behavior.
 */
export type Capabilities = {
  /** Forecast-based agency, leadership facts, and pressure progression. */
  progression: boolean;
  /**
   * Responsibility: resolved order facts, tracked hazards, collected
   * observations, and move messages that keep the action beside check.
   */
  responsibility: boolean;
  /** Piece encounters: requests, modifiers, warned withdrawals, and courts
   * that need a standing complaint. */
  encounters: boolean;
  /** The opening grace period includes its final ply. */
  graceInclusive: boolean;
  /** Rival disputes raise refusal odds, add friction, and name the rival. */
  disputeRefusals: boolean;
  /** Obeying a risky order frightens the mover without an exposure fact. */
  riskyMoveFear: boolean;
  /** A new plot needs a plotChance roll rather than a standing complaint. */
  plotRoll: boolean;
  /** Field deltas are capped once per turn, after encounters resolve,
   * instead of inside leadership. */
  turnLevelDeltaCap: boolean;
  /** Leadership emits its own observations at the end of the turn. */
  observationsAtLeadership: boolean;
  /** An ignored personal request leaves its piece briefly restless. */
  requestStakes: boolean;
  /** Initiative requests skip rook pawns, whose pushes rarely develop. */
  soundRequests: boolean;
  /** Complaints come from a harsh court's accumulated harm to its side, and
   * a renewed complaint can become a plot among its two pieces, instead of
   * requiring one pair harmed together twice and per-piece court gates. */
  courtComplaints: boolean;
  /** Any piece whose fear reaches the withdrawal threshold is warned in
   * public, not only one that raised a strain request, so ordering it back
   * into danger may make it withdraw. */
  frightenedWithdrawal: boolean;
};

const legacy: Capabilities = {
  progression: false,
  responsibility: false,
  encounters: false,
  graceInclusive: false,
  disputeRefusals: true,
  riskyMoveFear: true,
  plotRoll: true,
  turnLevelDeltaCap: false,
  observationsAtLeadership: false,
  requestStakes: false,
  soundRequests: false,
  courtComplaints: false,
  frightenedWithdrawal: false,
};
const v5: Capabilities = {
  ...legacy,
  progression: true,
  responsibility: true,
  encounters: true,
  graceInclusive: true,
  disputeRefusals: false,
  riskyMoveFear: false,
  plotRoll: false,
  turnLevelDeltaCap: true,
};
const BY_SCHEMA: Record<number, Capabilities> = {
  1: legacy,
  2: legacy,
  3: { ...legacy, progression: true },
  4: {
    ...legacy,
    progression: true,
    responsibility: true,
    observationsAtLeadership: true,
  },
  5: v5,
  6: {
    ...v5,
    requestStakes: true,
    soundRequests: true,
    courtComplaints: true,
    frightenedWithdrawal: true,
  },
};

export function capabilities(s: { schemaVersion: number }): Capabilities {
  const caps = BY_SCHEMA[s.schemaVersion];
  if (!caps) throw new Error("Unsupported rules configuration.");
  return caps;
}

// Type guards for code that also needs the generation's extra state. They
// accept any simulation-shaped value (including the AI's projected view).
type Versioned = Pick<HiddenSimulation, "schemaVersion">;
export const hasProgression = <T extends Versioned>(
  sim: T | null | undefined,
): sim is T & { progression: ProgressionState } =>
  !!sim && sim.schemaVersion >= 3;
export const hasEncounters = <T extends Versioned>(
  sim: T | null | undefined,
): sim is T & {
  schemaVersion: 5 | 6;
  progression: ProgressionState;
  encounters: EncounterState;
} => !!sim && sim.schemaVersion >= 5;
