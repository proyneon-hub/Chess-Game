import type { Side } from "@/lib/chess";
export type Family =
  | "initiative"
  | "confidence"
  | "protection"
  | "relief"
  | "strain"
  | "dispute"
  | "petition"
  | "solidarity"
  | "complaint";
export type Objective =
  | { kind: "develop"; subject: string }
  | { kind: "confidence"; subject: string }
  | {
      kind: "protect";
      subject: string;
      initialLoss: number;
      defenders: string[];
    }
  | {
      kind: "relieve";
      subject: string;
      initialLoss: number;
      defenders: string[];
      wards: string[];
    }
  | { kind: "mediate"; pair: [string, string]; separated: number }
  | {
      kind: "support";
      pair: [string, string];
      concern: "initiative" | "safety";
      initialLoss: number;
    }
  | {
      kind: "recover";
      pair: [string, string];
      initialLoss: number;
      separated: number;
    };
export type Encounter = {
  id: string;
  family: Family;
  phase: number;
  side: Side;
  participants: string[];
  causes: number[];
  createdPly: number;
  createdOwn: number;
  deadline: number;
  objective: Objective;
  stage: number;
  stageOwn: number;
  outcome: "active" | "fulfilled" | "expired" | "interrupted" | "escalated";
  consumed: string[];
  parent: string | null;
  interacted: boolean;
  effective: boolean;
};
export type Modifier = {
  encounterId: string;
  subject: string;
  helper: string | null;
  /** restless: generation 6 only, an ignored request's cost. */
  kind: "steady" | "support" | "dispute" | "restless";
  expires: number;
  consumed: boolean;
};
export type SubjectEncounterClock = {
  lastStart: number;
  developed: boolean;
  dangerTurns: number[];
  warningOwn: number | null;
  lastDanger: number;
  safeSince: number;
};
export type HarmReference = {
  revision: number;
  own: number;
  subject: string;
  involved: string[];
  grave: boolean;
};
export type EncounterState = {
  serial: number;
  lastStartPly: number;
  duePly: number;
  processedRevision: number;
  sides: Record<
    Side,
    {
      lastStart: number;
      lastWithdrawal: number;
      family: Partial<Record<Family, number>>;
      harms: HarmReference[];
    }
  >;
  subjects: Record<string, SubjectEncounterClock>;
  active: Encounter[];
  recent: Encounter[];
  modifiers: Modifier[];
  ledger: string[];
  pairRewards: Record<string, number>;
};
