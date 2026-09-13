import type { GameState, SubjectState } from "@/lib/game/types";
import type { EncounterState } from "./types";
export function initialEncounters(
  subjects: Record<string, SubjectState>,
): EncounterState {
  return {
    serial: 0,
    lastStartPly: -100,
    duePly: 10,
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
  if (s.simulation?.schemaVersion !== 5)
    throw new Error("V5 encounters required.");
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
