// Tuning-process configs that were never a default (no player save can ever
// contain them; server and local games always create with DEFAULT_CONFIG).
// Registered only so the goldens `pre-v4.json`/`pre-v5.json` keep replaying.
// Factory functions, not module-level constants, so this file can take only
// *types* from config.ts (erased at compile time) without a runtime import
// cycle: config.ts builds V2_CONFIG/V4_CONFIG first, then calls these.
import type { RuleConfig, ProgressionConfig } from "./config";

// V2_CONFIG (like ORIGINAL/AGENCY_TUNED before it) has no `generation` of its
// own; each candidate below adds it. Match that shape rather than RuleConfig.
export function tuningCandidates(
  v2: Omit<RuleConfig, "generation">,
  progression: ProgressionConfig,
) {
  const CANDIDATE_1: RuleConfig = Object.freeze({
    ...v2,
    version: "2026-09-08.1",
    generation: 3,
    agencyBase: 0.008,
    refusalMax: 0.18,
    retreatMax: 0.01,
    recoveryFear: 2,
    subjectDeltaCap: 12,
    kingdomDeltaCap: 6,
    progression,
  });
  const CANDIDATE_2: RuleConfig = Object.freeze({
    ...CANDIDATE_1,
    version: "2026-09-08.2",
    agencyBase: 0.005,
    progression: Object.freeze({
      ...progression,
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
  const CANDIDATE_3: RuleConfig = Object.freeze({
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
  const CANDIDATE_4: RuleConfig = Object.freeze({
    ...CANDIDATE_3,
    version: "2026-09-08.4",
    progression: Object.freeze({
      ...CANDIDATE_3.progression!,
      friction: -20,
      leaderResentment: 30,
    }),
  });
  const CANDIDATE_5: RuleConfig = Object.freeze({
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
  return { CANDIDATE_1, CANDIDATE_2, CANDIDATE_3, CANDIDATE_4, CANDIDATE_5 };
}

// Screened individually first on fixed development subsets; never mutate a
// tested entry. The default remains the corrected baseline until selection.
export function readableCandidates(v4: RuleConfig): readonly RuleConfig[] {
  return Object.freeze([
    Object.freeze({
      ...v4,
      version: "2026-09-09.2",
      progression: Object.freeze({ ...v4.progression!, retreatFear: 60 }),
    }),
    Object.freeze({
      ...v4,
      version: "2026-09-09.3",
      responsibility: Object.freeze({
        ...v4.responsibility!,
        rivalryWindow: 12,
      }),
    }),
    Object.freeze({
      ...v4,
      version: "2026-09-09.4",
      responsibility: Object.freeze({
        ...v4.responsibility!,
        preferNearbyLeader: true,
      }),
    }),
    Object.freeze({
      ...v4,
      version: "2026-09-09.5",
      responsibility: Object.freeze({
        ...v4.responsibility!,
        armedDeferrals: 4,
      }),
    }),
    Object.freeze({
      ...v4,
      version: "2026-09-09.6",
      progression: Object.freeze({ ...v4.progression!, retreatFear: 60 }),
      responsibility: Object.freeze({
        ...v4.responsibility!,
        preferNearbyLeader: true,
        armedDeferrals: 4,
      }),
    }),
    Object.freeze({
      ...v4,
      version: "2026-09-09.7",
      progression: Object.freeze({ ...v4.progression!, retreatFear: 60 }),
      responsibility: Object.freeze({
        ...v4.responsibility!,
        rivalryWindow: 12,
        preferNearbyLeader: true,
        armedDeferrals: 4,
      }),
    }),
  ]);
}
