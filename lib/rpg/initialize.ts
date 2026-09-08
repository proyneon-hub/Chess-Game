import type { Board } from "@/lib/chess";
import type { PieceIdBoard } from "@/lib/rpgChess";
import type {
  HiddenSimulation,
  KingdomState,
  Personality,
  PieceKind,
  SubjectState,
} from "@/lib/game/types";
import { CONFIG, clamp, configFor } from "@/lib/rpg/config";
import { draw, seedRng } from "@/lib/rpg/rng";
export const roleStats: Record<
  PieceKind,
  { ambition: number; courage: number; skill: number; power: number }
> = {
  p: { ambition: 35, courage: 45, skill: 1, power: 1 },
  n: { ambition: 60, courage: 70, skill: 4, power: 3 },
  b: { ambition: 50, courage: 55, skill: 4, power: 3 },
  r: { ambition: 45, courage: 65, skill: 3, power: 4 },
  q: { ambition: 75, courage: 70, skill: 5, power: 5 },
  k: { ambition: 0, courage: 100, skill: 2, power: 3 },
};
export function initializeSimulation(
  board: Board,
  ids: PieceIdBoard,
  seed: number,
  configVersion: string = CONFIG.version,
): HiddenSimulation {
  const rules = configFor(configVersion);
  if (!rules) throw new Error("Unsupported rules configuration.");
  const rngState = seedRng(seed);
  const kingdom = (): KingdomState => ({
    legitimacy: 65,
    tyranny: 10,
    cohesion: 65,
    prestige: 50,
    kingStrength: 1 + Math.floor(draw(rngState, "initialization") * 20),
    ownTurnsCompleted: 0,
    lastCoercionOwnTurn: null,
    lastMercyRewardOwnTurn: null,
    plotAttemptUsed: false,
    extensionsUsed: 0,
  });
  const kingdoms = { white: kingdom(), black: kingdom() };
  const subjects: Record<string, SubjectState> = {};
  const personalities: Personality[] = [
    "steadfast",
    "timid",
    "proud",
    "ambitious",
    "protective",
    "pragmatic",
  ];
  const paired: Record<string, Personality> = {};
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c],
        id = ids[r][c];
      if (!p || !id) continue;
      const currentKind = p.toLowerCase() as PieceKind,
        side = p === p.toUpperCase() ? "white" : "black";
      const pair = id.replace(/^(white|black)_/, "");
      const personality =
        paired[pair] ??
        (paired[pair] =
          personalities[Math.floor(draw(rngState, "initialization") * 6)]);
      const role = roleStats[currentKind];
      subjects[id] = {
        id,
        side,
        originalKind: currentKind,
        currentKind,
        personality,
        ...role,
        loyalty: personality === "steadfast" ? 75 : 65,
        morale: 65,
        fear: 10,
        resentment: personality === "proud" ? 10 : 5,
        fatigue: 0,
        ambition: clamp(role.ambition + (personality === "ambitious" ? 15 : 0)),
        courage: clamp(
          role.courage +
            (personality === "timid"
              ? -20
              : personality === "protective"
                ? 10
                : 0),
        ),
        status: "active",
        memories: [],
        relationships: {},
        grievance: null,
        lastMovedOwnTurn: -2,
        lastRescuedOwnTurn: -4,
        lastProtectedPosition: null,
        plotEligibilityStreak: 0,
      };
    }
  // Paired neighbors, not a complete social graph. Kings have no dispute links.
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 7; c += 2) {
      const a = subjects[ids[r][c] ?? ""],
        b = subjects[ids[r][c + 1] ?? ""];
      if (
        !a ||
        !b ||
        a.side !== b.side ||
        a.currentKind === "k" ||
        b.currentKind === "k"
      )
        continue;
      for (const [x, y] of [
        [a, b],
        [b, a],
      ])
        x.relationships[y.id] = {
          score: 10,
          lastRelevant: 0,
          lastReconciled: -4,
          separatedTurns: 0,
          disputed: false,
        };
    }
  return {
    schemaVersion: rules.generation,
    rulesetVersion: `hidden-kingdom-v${rules.generation}`,
    configVersion,
    rngState,
    kingdoms,
    subjects,
    plots: [],
    turnContext: {
      ply: 0,
      sideToMove: "white",
      refusalUsed: false,
      pendingRefusal: null,
    },
    privateEvents: [],
    counters: {},
    ...(rules.generation === 3
      ? {
          progression: {
            subjects: Object.fromEntries(
              Object.keys(subjects).map((id) => [
                id,
                {
                  episodes: [],
                  lastHarm: -100,
                  lastExposure: -100,
                  lastRepeated: -100,
                  lastNeglect: -100,
                  lastProtection: -100,
                  lastRetreat: -100,
                  ambient: {},
                },
              ]),
            ),
            sides: {
              white: { retreats: 0, lastAmbient: -100, pairs: {} },
              black: { retreats: 0, lastAmbient: -100, pairs: {} },
            },
          },
        }
      : {}),
  } as HiddenSimulation;
}
