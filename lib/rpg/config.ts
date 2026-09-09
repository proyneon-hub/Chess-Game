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
  readonly generation: 2 | 3 | 4;
  readonly responsibility?: {
    readonly rivalryWindow: number;
    readonly preferNearbyLeader: boolean;
    readonly armedDeferrals: number;
  };
  readonly progression?: ProgressionConfig;
};
export const CANDIDATE_1: RuleConfig = Object.freeze({
  ...V2_CONFIG,
  version: "2026-09-08.1",
  generation: 3,
  agencyBase: 0.008,
  refusalMax: 0.18,
  retreatMax: 0.01,
  recoveryFear: 2,
  subjectDeltaCap: 12,
  kingdomDeltaCap: 6,
  progression: PROGRESSION,
});
export const CANDIDATE_2: RuleConfig = Object.freeze({
  ...CANDIDATE_1,
  version: "2026-09-08.2",
  agencyBase: 0.005,
  progression: Object.freeze({
    ...PROGRESSION,
    calmCap: 0.006,
    resentmentWeight: 0.07,
    exposureResentment: 8,
    exposureLoyalty: -4,
    repeatedResentment: 4,
    repeatedLoyalty: -2,
    neglectResentment: 10,
    neglectLoyalty: -5,
    neglectTyranny: 5,
    neglectLegitimacy: -3,
    plotTyranny: 30,
    leaderResentment: 45,
    accompliceResentment: 35,
    recoveryResentment: 30,
    recoveryTyranny: 20,
  }),
});
export const CANDIDATE_3: RuleConfig = Object.freeze({
  ...CANDIDATE_2,
  version: "2026-09-08.3",
  progression: Object.freeze({
    ...CANDIDATE_2.progression!,
    graveWindow: 20,
    leaderResentment: 35,
    leaderLoyalty: 55,
    accompliceResentment: 25,
    accompliceLoyalty: 60,
    recoveryLoyalty: 65,
    recoveryResentment: 25,
    recoveryLegitimacy: 65,
  }),
});
export const CANDIDATE_4: RuleConfig = Object.freeze({
  ...CANDIDATE_3,
  version: "2026-09-08.4",
  progression: Object.freeze({
    ...CANDIDATE_3.progression!,
    friction: -20,
    leaderResentment: 30,
  }),
});
export const CANDIDATE_5: RuleConfig = Object.freeze({
  ...CANDIDATE_4,
  version: "2026-09-08.5",
  progression: Object.freeze({
    ...CANDIDATE_4.progression!,
    graveWindow: 32,
    leaderLoyalty: 60,
    leaderResentment: 25,
    leaderAmbition: 55,
    accompliceLoyalty: 65,
    accompliceResentment: 20,
    recoveryLoyalty: 70,
    recoveryResentment: 15,
  }),
});
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
export const CONFIG: RuleConfig = Object.freeze({
  ...V3_CONFIG,
  version: "2026-09-09.1",
  generation: 4,
  responsibility: Object.freeze({
    rivalryWindow: 8,
    preferNearbyLeader: false,
    armedDeferrals: 2,
  }),
});
// Screened individually first on fixed development subsets; never mutate a
// tested entry. The default remains the corrected baseline until selection.
export const READABLE_CANDIDATES: readonly RuleConfig[] = Object.freeze([
  Object.freeze({
    ...CONFIG,
    version: "2026-09-09.2",
    progression: Object.freeze({ ...CONFIG.progression!, retreatFear: 60 }),
  }),
  Object.freeze({
    ...CONFIG,
    version: "2026-09-09.3",
    responsibility: Object.freeze({
      ...CONFIG.responsibility!,
      rivalryWindow: 12,
    }),
  }),
  Object.freeze({
    ...CONFIG,
    version: "2026-09-09.4",
    responsibility: Object.freeze({
      ...CONFIG.responsibility!,
      preferNearbyLeader: true,
    }),
  }),
  Object.freeze({
    ...CONFIG,
    version: "2026-09-09.5",
    responsibility: Object.freeze({
      ...CONFIG.responsibility!,
      armedDeferrals: 4,
    }),
  }),
  Object.freeze({
    ...CONFIG,
    version: "2026-09-09.6",
    progression: Object.freeze({ ...CONFIG.progression!, retreatFear: 60 }),
    responsibility: Object.freeze({
      ...CONFIG.responsibility!,
      preferNearbyLeader: true,
      armedDeferrals: 4,
    }),
  }),
  Object.freeze({
    ...CONFIG,
    version: "2026-09-09.7",
    progression: Object.freeze({ ...CONFIG.progression!, retreatFear: 60 }),
    responsibility: Object.freeze({
      ...CONFIG.responsibility!,
      rivalryWindow: 12,
      preferNearbyLeader: true,
      armedDeferrals: 4,
    }),
  }),
]);
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
  [CONFIG.version]: CONFIG,
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
