import { BATTLE_RULES, type BattleRules } from "./stats";

export type RuleConfig = {
  readonly version: string;
  /** Completed turns a local game can undo. */
  readonly undoLimit: number;
  /** Online move receipts kept for duplicate detection. */
  readonly receiptLimit: number;
  readonly battle: BattleRules;
};
/**
 * A saved game records the configuration it began with. Never alter a
 * released entry; add a new version when the rules or the stat table change.
 */
export const BATTLE_CONFIG: RuleConfig = Object.freeze({
  version: "2026-11-10.2",
  undoLimit: 20,
  receiptLimit: 64,
  battle: BATTLE_RULES,
});
export const DEFAULT_CONFIG = BATTLE_CONFIG;
const CONFIGS: Readonly<Record<string, RuleConfig>> = Object.freeze({
  [BATTLE_CONFIG.version]: BATTLE_CONFIG,
});
export const SCHEMA_VERSION = 7;
export const RULESET_VERSION = "battle-v1";
export const configFor = (version: string) =>
  Object.hasOwn(CONFIGS, version) ? CONFIGS[version] : undefined;
export function rulesFor(s: {
  schemaVersion: number;
  rulesetVersion: string;
  configVersion: string;
}): RuleConfig {
  const rules = configFor(s.configVersion);
  if (
    !rules ||
    s.schemaVersion !== SCHEMA_VERSION ||
    s.rulesetVersion !== RULESET_VERSION
  )
    throw new Error("Unsupported rules configuration.");
  return rules;
}
