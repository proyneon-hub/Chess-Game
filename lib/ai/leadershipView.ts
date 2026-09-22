import { capabilities, hasEncounters } from "@/lib/rpg/capabilities";
import { initialEncounters } from "@/lib/rpg/encounters/state";
import type {
  GameState,
  Side,
  SubjectState,
  HiddenSimulation,
} from "@/lib/game/types";
import { roleStats } from "@/lib/rpg/initialize";
import { publicState } from "@/lib/game/publicState";
import { progression } from "@/lib/rpg/pressure";
// Enemy subjects are constructed solely from visible pieces. Never copy enemy
// hidden attributes, participant identities, pressure episodes or RNG streams.
export type LeadershipView = Omit<GameState, "simulation"> & {
  simulation: Omit<
    Extract<HiddenSimulation, { schemaVersion: 3 | 4 | 5 }>,
    "rngState"
  >;
};
export function materializeView(view: LeadershipView): GameState {
  return {
    ...view,
    simulation: {
      ...view.simulation,
      rngState: {
        algorithm: "mulberry32-v1",
        initialization: 0,
        gameplay: 0,
        narrative: 0,
      },
    },
  } as GameState;
}
export function leadershipView(s: GameState, side: Side): LeadershipView {
  const sim = s.simulation!;
  const subjects: Record<string, SubjectState> = {},
    pieceIds = s.board.map((row) => row.map(() => null as string | null));
  const emptyPressure = () => ({
    episodes: [],
    ...(capabilities(s).responsibility ? { hazard: null } : {}),
    lastHarm: -100,
    lastExposure: -100,
    lastRepeated: -100,
    lastNeglect: -100,
    lastProtection: -100,
    lastRetreat: -100,
    ambient: {},
  });
  const ownPressure = progression(s),
    pressure: ReturnType<typeof progression>["subjects"] = {};
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = s.board[r][c];
      if (!p) continue;
      const own = (p === p.toUpperCase()) === (side === "white");
      const id = own ? s.pieceIds[r][c]! : `visible_${r}_${c}`;
      pieceIds[r][c] = id;
      if (own) {
        subjects[id] = structuredClone(sim.subjects[id]);
        pressure[id] = structuredClone(ownPressure.subjects[id]);
      } else {
        const kind = p.toLowerCase() as SubjectState["currentKind"];
        subjects[id] = {
          id,
          side: side === "white" ? "black" : "white",
          originalKind: kind,
          currentKind: kind,
          personality: "pragmatic",
          ...roleStats[kind],
          loyalty: 65,
          morale: 65,
          fear: 10,
          resentment: 5,
          fatigue: 0,
          status: "active",
          memories: [],
          relationships: {},
          grievance: null,
          lastMovedOwnTurn: -2,
          lastRescuedOwnTurn: -4,
          lastProtectedPosition: null,
          plotEligibilityStreak: 0,
        };
        pressure[id] = emptyPressure();
      }
    }
  const enemy = side === "white" ? "black" : "white";
  const neutral = {
    legitimacy: 65,
    tyranny: 10,
    cohesion: 65,
    prestige: 50,
    kingStrength: 10,
    ownTurnsCompleted: 0,
    lastCoercionOwnTurn: null,
    lastMercyRewardOwnTurn: null,
    plotAttemptUsed: false,
    extensionsUsed: 0,
  };
  const visible = publicState(s);
  const projectedEncounters = initialEncounters(subjects);
  if (hasEncounters(sim)) {
    const source = sim.encounters;
    projectedEncounters.serial = source.serial;
    projectedEncounters.lastStartPly = source.lastStartPly;
    projectedEncounters.duePly = source.duePly;
    projectedEncounters.processedRevision = source.processedRevision;
    projectedEncounters.sides[side] = structuredClone(source.sides[side]);
    for (const id of Object.keys(subjects))
      if (subjects[id].side === side)
        projectedEncounters.subjects[id] = structuredClone(source.subjects[id]);
    projectedEncounters.active = structuredClone(
      source.active.filter((e) => e.side === side),
    );
    projectedEncounters.recent = structuredClone(
      source.recent.filter((e) => e.side === side),
    );
    projectedEncounters.modifiers = structuredClone(
      source.modifiers.filter((m) => subjects[m.subject]?.side === side),
    );
    projectedEncounters.pairRewards = Object.fromEntries(
      Object.entries(source.pairRewards).filter(([key]) =>
        key.split("|").every((id) => subjects[id]?.side === side),
      ),
    );
  }
  return {
    ...visible,
    configVersion: s.configVersion,
    schemaVersion: s.schemaVersion,
    rulesetVersion: s.rulesetVersion,
    pieceIds,
    rights: structuredClone(s.rights),
    positions: { ...s.positions },
    revision: s.revision,
    ply: s.ply,
    eventSeq: s.eventSeq,
    simulation: {
      schemaVersion: s.schemaVersion,
      rulesetVersion: s.rulesetVersion,
      configVersion: s.configVersion,
      subjects,
      kingdoms: {
        [side]: structuredClone(sim.kingdoms[side]),
        [enemy]: neutral,
      } as typeof sim.kingdoms,
      plots: structuredClone(sim.plots.filter((p) => p.side === side)),
      turnContext: structuredClone(sim.turnContext),
      privateEvents: [],
      counters: {},
      ...(hasEncounters(sim) ? { encounters: projectedEncounters } : {}),
      progression: {
        subjects: pressure,
        sides: {
          [side]: structuredClone(ownPressure.sides[side]),
          [enemy]: { retreats: 0, lastAmbient: -100, pairs: {} },
        } as typeof ownPressure.sides,
      },
    },
  } as LeadershipView;
}
