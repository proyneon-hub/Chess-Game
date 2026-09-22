import { expect, it } from "vitest";
import { v5Fixture, v6Fixture } from "../encounter-fixtures";
import { subjectAt } from "../fixtures";
import { submitMove } from "@/lib/game";
import { publicState } from "@/lib/game/publicState";
import { validateState } from "@/lib/game/validation";
import { candidates } from "@/lib/rpg/encounters/candidates";
import { encounterPhase, encounters } from "@/lib/rpg/encounters/state";
import type { Encounter, Objective } from "@/lib/rpg/encounters/types";
import type { GameState } from "@/lib/game/types";
import type { Square } from "@/lib/chess";

const id = (s: GameState, [r, c]: Square) => s.pieceIds[r][c]!;
function offer(
  s: GameState,
  family: Encounter["family"],
  participants: string[],
  objective: Objective,
  at: { own: number; deadline: number; stage?: number },
) {
  const e: Encounter = {
    id: "encounter-1",
    family,
    phase: encounterPhase(s.ply),
    side: "white",
    participants,
    causes: [],
    createdPly: s.ply,
    createdOwn: at.own,
    deadline: at.deadline,
    objective,
    stage: at.stage ?? 1,
    stageOwn: at.own,
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

it("an ignored request leaves its piece restless in v6 only", () => {
  for (const [fixture, restless] of [
    [v5Fixture, false],
    [v6Fixture, true],
  ] as const) {
    const s = fixture(
      [
        ["K", [7, 4]],
        ["k", [0, 4]],
        ["N", [7, 1]],
      ],
      20,
    );
    const knight = id(s, [7, 1]);
    offer(
      s,
      "initiative",
      [knight],
      { kind: "develop", subject: knight },
      { own: 0, deadline: 1 },
    );
    // The king moves instead: the knight's request expires unanswered.
    const r = submitMove(s, { from: [7, 4], to: [6, 4], side: "white" });
    expect(r.requestAccepted).toBe(true);
    validateState(r.state);
    const state = encounters(r.state);
    expect(
      state.modifiers.some(
        (m) => m.subject === knight && m.kind === "restless",
      ),
    ).toBe(restless);
    const card = publicState(r.state).encounters!.find(
      (e) => e.id === "encounter-1",
    )!;
    expect(card.outcome).toMatch(
      restless ? /grows restless/ : /passes without a response/,
    );
  }
});

it("v6 never asks a rook pawn to find room to act", () => {
  for (const [fixture, rookPawnAsked] of [
    [v5Fixture, true],
    [v6Fixture, false],
  ] as const) {
    const s = fixture(
      [
        ["K", [7, 4]],
        ["k", [0, 4]],
        ["P", [6, 0]],
      ],
      12,
    );
    const pawn = id(s, [6, 0]);
    const asked = candidates(s, "white").candidates.some(
      (c) => c.family === "initiative" && c.participants.includes(pawn),
    );
    expect(asked).toBe(rookPawnAsked);
  }
});

it("a harsh v6 court hears a complaint after repeated harm to its side", () => {
  for (const [fixture, complains] of [
    [v5Fixture, false],
    [v6Fixture, true],
  ] as const) {
    const s = fixture(
      [
        ["K", [7, 7]],
        ["k", [0, 4]],
        ["N", [5, 2]],
        ["B", [5, 4]],
        ["R", [7, 0]],
      ],
      40,
    );
    const sim = s.simulation!;
    Object.assign(sim.kingdoms.white, {
      tyranny: 30,
      legitimacy: 40,
      ownTurnsCompleted: 20,
    });
    const [knight, bishop] = [id(s, [5, 2]), id(s, [5, 4])];
    encounters(s).sides.white.harms = [
      { revision: 30, own: 15, subject: knight, involved: [], grave: false },
      { revision: 34, own: 17, subject: knight, involved: [], grave: true },
      { revision: 36, own: 18, subject: bishop, involved: [], grave: false },
    ];
    const complaint = candidates(s, "white").candidates.find(
      (c) => c.family === "complaint",
    );
    expect(!!complaint).toBe(complains);
    if (complaint) expect(complaint.participants).toEqual([knight, bishop]);
  }
});

it("a v6 complaint outlives a captured speaker", () => {
  const s = v6Fixture(
    [
      ["K", [7, 7]],
      ["k", [3, 4]],
      ["N", [5, 2]],
      ["B", [4, 3]],
      ["P", [5, 6]],
    ],
    40,
  );
  s.sideToMove = "black";
  s.simulation!.turnContext.sideToMove = "black";
  const [knight, bishop, pawn] = [id(s, [5, 2]), id(s, [4, 3]), id(s, [5, 6])];
  offer(
    s,
    "complaint",
    [knight, bishop],
    { kind: "recover", pair: [knight, bishop], initialLoss: 0, separated: 0 },
    { own: 0, deadline: 7 },
  );
  // The black king takes the undefended bishop; kings always obey.
  const r = submitMove(s, { from: [3, 4], to: [4, 3], side: "black" });
  expect(r.requestAccepted).toBe(true);
  validateState(r.state);
  const complaint = encounters(r.state).active.find(
    (e) => e.family === "complaint",
  )!;
  expect(complaint.participants).toEqual([knight, pawn]);
});

it("a renewed v6 complaint under a harsh court becomes a warned plot", () => {
  const s = v6Fixture(
    [
      ["K", [7, 7]],
      ["k", [0, 0]],
      ["N", [5, 2]],
      ["B", [5, 4]],
      ["P", [6, 0]],
    ],
    50,
  );
  const sim = s.simulation!;
  Object.assign(sim.kingdoms.white, {
    tyranny: 30,
    legitimacy: 40,
    ownTurnsCompleted: 10,
  });
  const [knight, bishop] = [id(s, [5, 2]), id(s, [5, 4])];
  for (const sub of [subjectAt(s, [5, 2]), subjectAt(s, [5, 4])])
    Object.assign(sub, { loyalty: 30, resentment: 60 });
  offer(
    s,
    "complaint",
    [knight, bishop],
    { kind: "recover", pair: [knight, bishop], initialLoss: 0, separated: 0 },
    { own: 9, deadline: 16, stage: 2 },
  );
  // An unrelated king move leaves the renewed complaint unanswered.
  const r = submitMove(s, { from: [7, 7], to: [6, 7], side: "white" });
  expect(r.requestAccepted).toBe(true);
  validateState(r.state);
  const plot = r.state.simulation!.plots.find((p) => p.side === "white");
  expect(plot).toMatchObject({ ringleader: knight, accomplice: bishop });
  expect(r.state.warning?.message).toMatch(/turns away from its king/);
});
