import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { createGameState, submitMove } from "@/lib/game";
import { v4Fixture } from "../progression-fixtures";
import { v6Fixture } from "../encounter-fixtures";
import { encounters, encounterPhase } from "@/lib/rpg/encounters/state";
import { presence, RPG_LINE_CODES } from "@/lib/rpg/presence";
import { V2_CONFIG, V4_CONFIG } from "@/lib/rpg/config";
import type { Encounter, Objective } from "@/lib/rpg/encounters/types";
import type { GameState } from "@/lib/game/types";

function offer(
  s: GameState,
  participants: string[],
  objective: Objective,
): Encounter {
  const e: Encounter = {
    id: "encounter-1",
    family: "initiative",
    phase: encounterPhase(s.ply),
    side: "white",
    participants,
    causes: [],
    createdPly: s.ply,
    createdOwn: 0,
    deadline: 3,
    objective,
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
  return e;
}

it("an active card gives the card channel, for the offering side", () => {
  const s = v6Fixture(
    [
      ["K", [7, 4]],
      ["k", [0, 4]],
      ["N", [7, 1]],
    ],
    20,
  );
  const before = structuredClone(s);
  const knight = s.pieceIds[7][1]!;
  offer(s, [knight], { kind: "develop", subject: knight });
  const { channels, cardSides } = presence(before, s);
  expect(channels.has("card")).toBe(true);
  expect(cardSides.has("white")).toBe(true);
});

it("a refusal gives hesitation, and so does the move that resolves it", () => {
  const s = v6Fixture(
    [
      ["K", [7, 4]],
      ["k", [0, 4]],
      ["N", [7, 1]],
    ],
    20,
  );
  const before1 = structuredClone(s);
  const refused = submitMove(
    s,
    { from: [7, 1], to: [5, 2], side: "white" },
    { draw: () => 0 },
  );
  expect(refused.resolution).toBe("refused");
  expect(presence(before1, refused.state).channels.has("hesitation")).toBe(
    true,
  );
  // The next move is guaranteed (a pendingRefusal is active), so any draw
  // resolves it; the move that ends the hesitation should still be flagged.
  const before2 = structuredClone(refused.state);
  const resolved = submitMove(
    refused.state,
    { from: [7, 1], to: [5, 2], side: "white" },
    { draw: () => 0 },
  );
  expect(resolved.resolution).not.toBe("refused");
  expect(presence(before2, resolved.state).channels.has("hesitation")).toBe(
    true,
  );
});

it("a plain early move gives an empty channel set", () => {
  const s = createGameState(1);
  const before = structuredClone(s);
  const r = submitMove(s, { from: [6, 4], to: [4, 4], side: "white" });
  expect(presence(before, r.state).channels.size).toBe(0);
});

it("v2 and v4 states never give the card channel", () => {
  for (const config of [V2_CONFIG.version, V4_CONFIG.version]) {
    const s = createGameState(1, config);
    const before = structuredClone(s);
    const r = submitMove(s, { from: [6, 4], to: [4, 4], side: "white" });
    expect(presence(before, r.state).channels.has("card")).toBe(false);
  }
  // v4Fixture exercises the same guard through a constructed position.
  const v4 = v4Fixture(
    [
      ["K", [7, 4]],
      ["k", [0, 4]],
    ],
    20,
  ) as GameState;
  expect(presence(v4, v4).channels.has("card")).toBe(false);
});

it("presence does not mutate either state it reads", () => {
  const s = v6Fixture(
    [
      ["K", [7, 4]],
      ["k", [0, 4]],
      ["N", [7, 1]],
    ],
    20,
  );
  const before = structuredClone(s);
  offer(s, [s.pieceIds[7][1]!], {
    kind: "develop",
    subject: s.pieceIds[7][1]!,
  });
  const beforeSnapshot = JSON.stringify(before);
  const afterSnapshot = JSON.stringify(s);
  presence(before, s);
  expect(JSON.stringify(before)).toBe(beforeSnapshot);
  expect(JSON.stringify(s)).toBe(afterSnapshot);
});

it("every RPG_LINE_CODES entry is a real event code in the engine", () => {
  const source = [
    "lib/game.ts",
    "lib/rpg/encounters/resolve.ts",
    "lib/rpg/encounters/director.ts",
    "lib/rpg/conspiracy.ts",
  ]
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");
  for (const code of RPG_LINE_CODES)
    expect(source, `missing event("${code}", ...) call`).toMatch(
      new RegExp(`"${code}"`),
    );
  // And nothing in the list is a plain-chess or ambient code.
  expect(RPG_LINE_CODES).not.toContain("move");
  expect(RPG_LINE_CODES).not.toContain("draw");
  expect(RPG_LINE_CODES).not.toContain("ambient");
});
