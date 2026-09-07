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
export const CONFIG = Object.freeze({
  ...AGENCY_TUNED,
  version: "2026-09-07.3",
  coercedRivalGrievance: 10,
});
type RuleConfig = Omit<
  typeof ORIGINAL,
  "version" | "agencyBase" | "coercedRivalGrievance"
> & {
  readonly version: string;
  readonly agencyBase: number;
  readonly coercedRivalGrievance: number;
};
export const CONFIGS: Readonly<Record<string, RuleConfig>> = Object.freeze({
  [ORIGINAL.version]: ORIGINAL,
  [AGENCY_TUNED.version]: AGENCY_TUNED,
  [CONFIG.version]: CONFIG,
});
export const configFor = (version: string) =>
  Object.hasOwn(CONFIGS, version) ? CONFIGS[version] : undefined;
export const clamp = (n: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, n));
