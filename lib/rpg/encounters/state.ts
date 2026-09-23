import { hasEncounters } from "@/lib/rpg/capabilities";
import type { GameState, SubjectState } from "@/lib/game/types";
import type { EncounterState, Family } from "./types";
// Single-piece requests whose neglect leaves the piece restless (v6).
export const PERSONAL: Family[] = [
  "initiative",
  "confidence",
  "protection",
  "relief",
  "strain",
];
import { ENCOUNTER_RULES } from "../config";
export function initialEncounters(
  subjects: Record<string, SubjectState>,
  // Was hardcoded to the base ENCOUNTER_RULES.firstPly, ignoring whatever a
  // config actually set (every config happened to keep the base value, so
  // this had no observable effect until a config changed it).
  firstPly: number = ENCOUNTER_RULES.firstPly,
): EncounterState {
  return {
    serial: 0,
    lastStartPly: -100,
    duePly: firstPly,
    processedRevision: -1,
    sides: {
      white: { lastStart: -100, lastWithdrawal: -100, family: {}, harms: [] },
      black: { lastStart: -100, lastWithdrawal: -100, family: {}, harms: [] },
    },
    subjects: Object.fromEntries(
      Object.keys(subjects).map((id) => [
        id,
        {
          lastStart: -100,
          developed: false,
          dangerTurns: [],
          warningOwn: null,
          lastDanger: -100,
          safeSince: -100,
        },
      ]),
    ),
    active: [],
    recent: [],
    modifiers: [],
    ledger: [],
    pairRewards: {},
  };
}
export function encounters(s: GameState): EncounterState {
  if (!hasEncounters(s.simulation)) throw new Error("V5 encounters required.");
  return s.simulation.encounters;
}
export const encounterPhase = (ply: number) =>
  ply <= 8
    ? 0
    : ply <= 16
      ? 1
      : ply <= 32
        ? 2
        : ply <= 48
          ? 3
          : ply <= 64
            ? 4
            : 5;
