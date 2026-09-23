import { tuningCandidates, readableCandidates } from "./historicalConfigs";
// Immutable registry: never alter this entry for an active saved match. Add a
// new configVersion when balance changes. Values are original design defaults.
const ORIGINAL = Object.freeze({
  version: "2026-09-07.1",
  agencyBase: 0.005,
  coercedRivalGrievance: 0,
  grace: 8,
  established: 16,
  crisis: 40,
  memoryLimit: 12,
  privateEventLimit: 256,
  relationshipLimit: 4,
  disputeLimit: 2,
  subjectDeltaCap: 15,
  kingdomDeltaCap: 8,
  auraRadius: 2,
  refusalMax: 0.22,
  retreatMax: 0.025,
  heroicChance: 0.15,
  extensionLimit: 1,
  plotChance: 0.02,
  plotMinChance: 0.02,
  plotMaxChance: 0.15,
  memoryTurns: 8,
  grievanceTurns: 12,
  recoveryFear: 3,
  recoveryFatigue: 4,
  cooldown: 4,
  receiptLimit: 64,
  undoLimit: 20,
});
// The first measured 1000-game run produced 0 refusals / 95,932 eligible
// commands. Raise only the baseline agency term; retain every causal weight,
// grace/check guarantee and plot threshold. Saved .1 games keep their formula.
const AGENCY_TUNED = Object.freeze({
  ...ORIGINAL,
  version: "2026-09-07.2",
  agencyBase: 0.04,
});
// Promotion envy alone changes a pair only once (-10), so it cannot reach
// the specified -30 dispute threshold. A coerced losing order under that
// envied defender can deepen the existing grievance, once per completed turn.
export const V2_CONFIG = Object.freeze({
  ...AGENCY_TUNED,
  version: "2026-09-07.3",
  coercedRivalGrievance: 10,
});
export const PROGRESSION = Object.freeze({
  episodeLimit: 6,
  episodeCooldown: 3,
  harmWindow: 8,
  graveWindow: 12,
  repeatCooldown: 4,
  neglectCooldown: 3,
  neglectLimit: 2,
  exposureFear: 5,
  exposureResentment: 5,
  exposureLoyalty: -2,
  repeatedResentment: 3,
  repeatedLoyalty: -1,
  repeatedTyranny: 2,
  repeatedLegitimacy: -1,
  neglectFear: 3,
  neglectResentment: 6,
  neglectLoyalty: -3,
  neglectTyranny: 3,
  neglectLegitimacy: -2,
  coercionFear: 6,
  coercionResentment: 8,
  coercionLoyalty: -3,
  coercionTyranny: 5,
  coercionLegitimacy: -2,
  rescueFear: -6,
  rescueResentment: -3,
  rescueLoyalty: 3,
  protectionFear: -3,
  protectionResentment: -2,
  protectionLoyalty: 2,
  calmTurns: 4,
  ambientSideCooldown: 4,
  ambientSubjectCooldown: 6,
  disputeOpen: -20,
  disputeClose: -10,
  friction: -8,
  frictionResentment: 35,
  retreatFear: 65,
  retreatLoyalty: 60,
  retreatLimit: 2,
  plotTyranny: 40,
  plotLegitimacy: 50,
  leaderResentment: 60,
  leaderLoyalty: 45,
  leaderAmbition: 60,
  accompliceResentment: 50,
  accompliceLoyalty: 50,
  pairLimit: 8,
  recoveryLoyalty: 55,
  recoveryResentment: 45,
  recoveryLegitimacy: 60,
  recoveryTyranny: 30,
  calmCap: 0.008,
  fearWeight: 0.1,
  resentmentWeight: 0.09,
  fatigueWeight: 0.04,
  disputeWeight: 0.035,
  harmWeight: 0.025,
  loyaltyWeight: 0.035,
  courageWeight: 0.025,
  legitimacyWeight: 0.03,
  moraleWeight: 0.02,
  cohesionWeight: 0.02,
  prestigeWeight: 0.01,
  tyrannyFearWeight: 0.02,
  confidenceWeight: 0.005,
  restraintCp: 75,
});
export type ProgressionConfig = {
  readonly [K in keyof typeof PROGRESSION]: number;
};
export type RuleConfig = {
  readonly [K in keyof typeof ORIGINAL]: K extends "version" ? string : number;
} & {
  readonly generation: 2 | 3 | 4 | 5 | 6;
  readonly responsibility?: {
    readonly rivalryWindow: number;
    readonly preferNearbyLeader: boolean;
    readonly armedDeferrals: number;
  };
  readonly progression?: ProgressionConfig;
  readonly encounters?: {
    readonly [K in keyof typeof ENCOUNTER_RULES]: number;
  };
};
export const {
  CANDIDATE_1,
  CANDIDATE_2,
  CANDIDATE_3,
  CANDIDATE_4,
  CANDIDATE_5,
} = tuningCandidates(V2_CONFIG, PROGRESSION);
export const V3_CONFIG: RuleConfig = Object.freeze({
  ...CANDIDATE_5,
  version: "2026-09-08.6",
  progression: Object.freeze({
    ...CANDIDATE_5.progression!,
    leaderLoyalty: 65,
    leaderResentment: 20,
    leaderAmbition: 50,
    accompliceLoyalty: 70,
    accompliceResentment: 10,
    recoveryLoyalty: 75,
    recoveryResentment: 8,
  }),
});
export const V4_CONFIG: RuleConfig = Object.freeze({
  ...V3_CONFIG,
  version: "2026-09-09.1",
  generation: 4,
  responsibility: Object.freeze({
    rivalryWindow: 8,
    preferNearbyLeader: false,
    armedDeferrals: 2,
  }),
});
export const READABLE_CANDIDATES: readonly RuleConfig[] =
  readableCandidates(V4_CONFIG);
export const ENCOUNTER_RULES = Object.freeze({
  firstPly: 10,
  cadence: 6,
  hardDue: 8,
  minimumGap: 4,
  sideGap: 3,
  subjectGap: 6,
  personalWindow: 3,
  petitionWindow: 4,
  steadyTurns: 2,
  supportTurns: 6,
  modifierCap: 0.06,
  // Generation 6: an ignored personal request adds this refusal chance to its
  // piece for restlessTurns own turns.
  restless: 0.04,
  restlessTurns: 4,
  steady: -0.03,
  support: -0.03,
  dispute: 0.04,
  physicalFear: 4,
  strainFear: 40,
  // Recent danger turns (within 6 own turns) before strain can be requested.
  strainDangerTurns: 2,
  withdrawalFear: 50,
  withdrawalBase: 0.03,
  withdrawalHighFear: 0.02,
  withdrawalLowLoyalty: 0.01,
  withdrawalGap: 8,
  withdrawalLimit: 2,
  withdrawalMax: 0.06,
  aiAccommodation: 75,
  // A complaint needs this encounter phase, a court at least this harsh and
  // this illegitimate, and shared harms at least this many own turns apart.
  complaintPhase: 4,
  complaintTyranny: 25,
  complaintLegitimacy: 55,
  complaintHarmGap: 3,
  // Generation 6: harms to the side (distinct turns) within complaintWindow
  // own turns that let a harsh court hear a complaint.
  complaintHarms: 3,
  complaintWindow: 10,
  // Own turns a complaint stays open (v5 used the petition window).
  complaintDeadline: 4,
  // Own turns before continued harm can renew a complaint as a warning.
  complaintStageTurns: 2,
  // A plot may start only after this ply, from a standing stage-2 complaint.
  plotPly: 64,
});
export const CONFIG: RuleConfig = Object.freeze({
  ...V4_CONFIG,
  version: "2026-09-10.1",
  generation: 5,
  encounters: ENCOUNTER_RULES,
});
// Playtest tuning (docs/v6-playtest): the v5 politics were nearly invisible
// in real games. Hesitation, warned withdrawals and the complaint-to-plot arc
// become reachable; the computer stops weakening itself for its own requests.
export const PLAYTEST_CONFIG: RuleConfig = Object.freeze({
  ...CONFIG,
  version: "2026-09-22.1",
  agencyBase: 0.035,
  progression: Object.freeze({
    ...CONFIG.progression!,
    calmCap: 0.03,
    fearWeight: 0.35,
    resentmentWeight: 0.3,
    harmWeight: 0.1,
  }),
  encounters: Object.freeze({ ...ENCOUNTER_RULES, aiAccommodation: 25 }),
});
// Generation 6 (docs/v6-playtest): requests carry stakes, strain can be
// raised after one dangerous turn, and complaints form around the pairs a
// court needs, so warned withdrawals and conspiracies are reachable.
export const V6_CONFIG: RuleConfig = Object.freeze({
  ...PLAYTEST_CONFIG,
  version: "2026-09-23.1",
  generation: 6,
  progression: Object.freeze({
    ...PLAYTEST_CONFIG.progression!,
    plotTyranny: 15,
    plotLegitimacy: 62,
    // A v6 plot breaks up once the court recovers past these.
    recoveryTyranny: 8,
    recoveryLegitimacy: 66,
    recoveryLoyalty: 85,
    recoveryResentment: 3,
  }),
  encounters: Object.freeze({
    ...PLAYTEST_CONFIG.encounters!,
    strainFear: 18,
    strainDangerTurns: 1,
    withdrawalFear: 18,
    withdrawalBase: 0.4,
    withdrawalMax: 0.5,
    complaintPhase: 3,
    complaintDeadline: 7,
    complaintStageTurns: 1,
    complaintTyranny: 12,
    complaintLegitimacy: 62,
    plotPly: 40,
  }),
});
/** What new games use. CONFIG stays the v5 baseline that reports refer to. */
export const DEFAULT_CONFIG = V6_CONFIG;
export const CONFIGS: Readonly<Record<string, RuleConfig>> = Object.freeze({
  [ORIGINAL.version]: Object.freeze({ ...ORIGINAL, generation: 2 }),
  [AGENCY_TUNED.version]: Object.freeze({ ...AGENCY_TUNED, generation: 2 }),
  [V2_CONFIG.version]: Object.freeze({ ...V2_CONFIG, generation: 2 }),
  [CANDIDATE_1.version]: CANDIDATE_1,
  [CANDIDATE_2.version]: CANDIDATE_2,
  [CANDIDATE_3.version]: CANDIDATE_3,
  [CANDIDATE_4.version]: CANDIDATE_4,
  [CANDIDATE_5.version]: CANDIDATE_5,
  [V3_CONFIG.version]: V3_CONFIG,
  [V4_CONFIG.version]: V4_CONFIG,
  [CONFIG.version]: CONFIG,
  [PLAYTEST_CONFIG.version]: PLAYTEST_CONFIG,
  [V6_CONFIG.version]: V6_CONFIG,
  ...Object.fromEntries(READABLE_CANDIDATES.map((c) => [c.version, c])),
});
export const configFor = (version: string) =>
  Object.hasOwn(CONFIGS, version) ? CONFIGS[version] : undefined;
export function rulesFor(s: {
  schemaVersion: number;
  rulesetVersion: string;
  configVersion: string;
}): RuleConfig {
  if (
    s.schemaVersion === 1 &&
    s.rulesetVersion === "legacy-v1" &&
    s.configVersion === "legacy-safety-1"
  )
    return CONFIGS[V2_CONFIG.version];
  const rules = configFor(s.configVersion);
  if (
    !rules ||
    s.schemaVersion !== rules.generation ||
    s.rulesetVersion !== `hidden-kingdom-v${rules.generation}`
  )
    throw new Error("Unsupported rules configuration.");
  return rules;
}
export const clamp = (n: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, n));

export function encounterRulesFor(s: Parameters<typeof rulesFor>[0]) {
  const config = rulesFor(s).encounters;
  if (!config) throw new Error("Encounter configuration required.");
  return config;
}
