import { expect, it } from "vitest";
import { v6Fixture } from "../encounter-fixtures";
import { createGameState, getAllLegalMoves, submitMove } from "@/lib/game";
import { ambientFlavor } from "@/lib/rpg/observations";
import { encounters, encounterPhase } from "@/lib/rpg/encounters/state";
import { event } from "@/lib/rpg/events";
import { progression } from "@/lib/rpg/pressure";
import { CONFIG, PLAYTEST_CONFIG } from "@/lib/rpg/config";
import { seedRng, draw } from "@/lib/rpg/rng";
import type { Encounter, Objective } from "@/lib/rpg/encounters/types";
import type { GameState } from "@/lib/game/types";
import type { Square } from "@/lib/chess";

const id = (s: GameState, [r, c]: Square) => s.pieceIds[r][c]!;

function fixture() {
  return v6Fixture(
    [
      ["K", [7, 4]],
      ["k", [0, 4]],
      ["N", [7, 1]],
    ],
    20,
  );
}
const neglect = (subjectId: string, square: Square) => [
  { kind: "neglect" as const, subjectId, square, message: "test neglect" },
];

it("an observed fact becomes exactly one ambient line, once per side/subject cooldown", () => {
  const s = fixture();
  const knight = id(s, [7, 1]);
  const before = s.eventSeq;
  ambientFlavor(s, s, "white", neglect(knight, [7, 1]), before);
  expect(s.events.at(-1)?.message).toBe("test neglect");
  const own = s.simulation!.kingdoms.white.ownTurnsCompleted;
  expect(progression(s).subjects[knight].ambient.neglect).toBe(own);
  expect(progression(s).sides.white.lastAmbient).toBe(own);
  // Immediately again: both the side and subject cooldowns are still open.
  const afterFirst = s.eventSeq;
  ambientFlavor(s, s, "white", neglect(knight, [7, 1]), afterFirst);
  expect(s.eventSeq).toBe(afterFirst);
});

it("nothing is emitted for a subject with an active card", () => {
  const s = fixture();
  const knight = id(s, [7, 1]);
  const e: Encounter = {
    id: "encounter-1",
    family: "initiative",
    phase: encounterPhase(s.ply),
    side: "white",
    participants: [knight],
    causes: [],
    createdPly: s.ply,
    createdOwn: 0,
    deadline: 3,
    objective: { kind: "develop", subject: knight } satisfies Objective,
    stage: 1,
    stageOwn: 0,
    outcome: "active",
    consumed: [],
    parent: null,
    interacted: false,
    effective: false,
  };
  encounters(s).active = [e];
  encounters(s).serial = 1;
  const before = s.eventSeq;
  ambientFlavor(s, s, "white", neglect(knight, [7, 1]), before);
  expect(s.eventSeq).toBe(before);
});

it("nothing is emitted once an RPG event has already fired this ply", () => {
  const s = fixture();
  const knight = id(s, [7, 1]);
  const sinceSeq = s.eventSeq;
  event(s, "shaken", "the knight is shaken", { square: [7, 1] });
  // sinceSeq predates the shaken line, so ambientFlavor must see it as spoken.
  ambientFlavor(s, s, "white", neglect(knight, [7, 1]), sinceSeq);
  expect(s.events.at(-1)?.message).toBe("the knight is shaken");
});

it("seeded play under CONFIG and PLAYTEST_CONFIG never touches counters.ambient", () => {
  for (const version of [CONFIG.version, PLAYTEST_CONFIG.version]) {
    let s: GameState = createGameState(9001, version);
    const rng = seedRng(9001);
    for (let ply = 0; ply < 100 && s.status === "active"; ply++) {
      const moves = getAllLegalMoves(s.board, s.sideToMove, s.rights),
        move = moves[Math.floor(draw(rng) * moves.length)];
      const r = submitMove(s, move);
      if (r.requestAccepted) s = r.state;
    }
    expect(s.simulation!.counters.ambient).toBeUndefined();
  }
});
