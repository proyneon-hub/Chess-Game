import { expect, it } from "vitest";
import { v5Fixture, constructedV5Court } from "../encounter-fixtures";
import { subjectAt } from "../fixtures";
import { encounters } from "@/lib/rpg/encounters/state";
import { candidates } from "@/lib/rpg/encounters/candidates";
import { scheduleEncounter } from "@/lib/rpg/encounters/director";
import { assessOrder } from "@/lib/rpg/facts";
import { lossOf, projectBoard } from "@/lib/rpg/encounters/objectives";
import type { Encounter } from "@/lib/rpg/encounters/types";
import { agencyForecast } from "@/lib/rpg/agency";
import { createGameState, getAllLegalMoves, submitMove } from "@/lib/game";
import { scheduleCourt, activePlot } from "@/lib/rpg/conspiracy";
import { progression } from "@/lib/rpg/pressure";
import { validateState } from "@/lib/game/validation";
import type { MoveAttempt } from "@/lib/game/types";
const rook = () =>
  v5Fixture(
    [
      ["K", [7, 7]],
      ["k", [0, 7]],
      ["R", [5, 0]],
      ["p", [2, 1]],
    ],
    40,
  );
const dangerous: MoveAttempt = { side: "white", from: [5, 0], to: [3, 0] };
it("a genuine problem outranks the other side's older routine opportunity", () => {
  const s = v5Fixture(
    [
      ["K", [7, 7]],
      ["k", [0, 7]],
      ["R", [3, 0]],
      ["p", [2, 1]],
      ["n", [0, 1]],
    ],
    20,
  );
  s.simulation!.kingdoms.white.ownTurnsCompleted = 10;
  s.simulation!.kingdoms.black.ownTurnsCompleted = 10;
  encounters(s).sides.white.lastStart = 0;
  scheduleEncounter(s, "white");
  expect(encounters(s).active[0].side).toBe("white");
  expect(encounters(s).active[0].family).toBe("protection");
});
it("first personality can express factually supported strain before relationship phase", () => {
  const s = v5Fixture(
    [
      ["K", [7, 7]],
      ["k", [0, 7]],
      ["R", [3, 0]],
      ["p", [2, 1]],
    ],
    14,
  );
  const sub = subjectAt(s, [3, 0]);
  sub.fear = 45;
  s.simulation!.kingdoms.white.ownTurnsCompleted = 7;
  encounters(s).subjects[sub.id].dangerTurns = [6, 7];
  expect(
    candidates(s, "white").candidates.some((c) => c.family === "strain"),
  ).toBe(true);
});
it("withdrawal destinations strictly improve capture-adjusted command loss", () => {
  const s = v5Fixture(
    [
      ["K", [7, 7]],
      ["k", [0, 7]],
      ["R", [5, 0]],
      ["b", [3, 0]],
      ["p", [2, 1]],
    ],
    40,
  );
  const sub = subjectAt(s, [5, 0]);
  sub.fear = 75;
  s.simulation!.kingdoms.white.ownTurnsCompleted = 10;
  encounters(s).subjects[sub.id].warningOwn = 9;
  const forecast = agencyForecast(s, dangerous);
  expect(forecast.retreatTo).not.toBeNull();
  expect(
    lossOf(projectBoard(s, { ...dangerous, to: forecast.retreatTo! }), sub.id),
  ).toBeLessThan(assessOrder(s, dangerous).residual);
});
it("cannot reveal agency through a refusal while the opening clock still reads eight", () => {
  let s = createGameState(42);
  for (let i = 0; i < 9; i++) {
    const m = getAllLegalMoves(s.board, s.sideToMove, s.rights)[0];
    expect(agencyForecast(s, m).guaranteed).toBe(true);
    const result = submitMove(s, m, { draw: () => 0 });
    expect(result.state.ply).toBe(i + 1);
    expect(result.resolution).toBe("executed");
    expect(encounters(result.state).active).toEqual([]);
    s = result.state;
  }
});
it("withdrawal requires a warning and response turn, preserves responsibility and second-command guarantees", () => {
  const s = rook(),
    sub = subjectAt(s, [5, 0]);
  Object.assign(sub, { fear: 75, loyalty: 80 });
  s.simulation!.kingdoms.white.ownTurnsCompleted = 10;
  expect(agencyForecast(s, dangerous).retreat).toBe(0);
  encounters(s).subjects[sub.id].warningOwn = 10;
  expect(agencyForecast(s, dangerous).retreat).toBe(0);
  encounters(s).subjects[sub.id].warningOwn = 9;
  const f = agencyForecast(s, dangerous);
  expect(f.retreat).toBe(0.05);
  const result = submitMove(s, dangerous, {
    draw: () => f.refusal + f.retreat / 2,
  });
  expect(result.resolution).toBe("autonomous");
  expect(result.state.simulation!.subjects[sub.id].loyalty).toBeLessThan(
    sub.loyalty,
  );
  expect(
    progression(result.state).subjects[sub.id].episodes.some(
      (e) => e.cause === "avoidable_exposure",
    ),
  ).toBe(true);
  const retry = structuredClone(s);
  retry.pendingRefusal = { from: dangerous.from, to: dangerous.to };
  retry.simulation!.turnContext.refusalUsed = true;
  expect(agencyForecast(retry, dangerous).retreat).toBe(0);
});
it("safe heroic deviation never creates a leadership grievance in v5", () => {
  const s = rook(),
    sub = subjectAt(s, [5, 0]);
  sub.morale = 80;
  const m: MoveAttempt = { ...dangerous, to: [4, 0] },
    f = agencyForecast(s, m);
  const r = submitMove(s, m, {
    draw: () => f.refusal + f.retreat + f.heroism / 2,
  });
  expect(r.state.lastMove?.[1]).toEqual([3, 0]);
  expect(r.state.simulation!.subjects[sub.id].loyalty).toBe(sub.loyalty);
  expect(encounters(r.state).sides.white.harms).toEqual([]);
  expect(progression(r.state).subjects[sub.id].episodes).toEqual([]);
});
it("v5 cannot create direct v4 plots, even with a zero creation roll", () => {
  const s = constructedV5Court();
  for (let i = 0; i < 5; i++) {
    s.simulation!.kingdoms.white.ownTurnsCompleted++;
    scheduleCourt(s, "white", () => 0, false);
  }
  expect(activePlot(s)).toBeUndefined();
});
it("two-stage complaint gates conspiracy; three committed warnings precede either terminal branch", () => {
  for (const roll of [0, 0.99]) {
    const s = constructedV5Court(),
      e = encounters(s),
      participants = [s.pieceIds[5][3]!, s.pieceIds[5][5]!] as [string, string];
    const complaint: Encounter = {
      id: "encounter-1",
      family: "complaint",
      phase: 5,
      side: "white",
      participants,
      causes: [7, 9],
      createdPly: 65,
      createdOwn: 7,
      deadline: 20,
      objective: {
        kind: "recover",
        pair: participants,
        initialLoss: 100,
        separated: 0,
      },
      stage: 2,
      stageOwn: 9,
      outcome: "active",
      consumed: [],
      parent: null,
      interacted: true,
      effective: false,
    };
    e.active = [complaint];
    e.serial = 1;
    e.sides.white.harms = [
      {
        revision: 7,
        own: 7,
        subject: participants[0],
        involved: [participants[1]],
        grave: true,
      },
      {
        revision: 9,
        own: 9,
        subject: participants[1],
        involved: [participants[0]],
        grave: true,
      },
      {
        revision: 10,
        own: 10,
        subject: participants[0],
        involved: [participants[1]],
        grave: true,
      },
    ];
    function tick(check = false) {
      s.ply += 2;
      s.revision++;
      s.simulation!.turnContext.ply = s.ply;
      s.simulation!.kingdoms.white.ownTurnsCompleted++;
      scheduleCourt(s, "white", () => roll, check);
    }
    tick();
    tick();
    expect(activePlot(s)?.stage).toBe("gathering");
    tick(true);
    expect(activePlot(s)?.stage).toBe("gathering");
    tick();
    expect(activePlot(s)?.stage).toBe("preparing");
    tick();
    expect(activePlot(s)?.stage).toBe("armed");
    expect(s.simulation!.counters.armedAttempts ?? 0).toBe(0);
    expect(activePlot(s)?.warningEventIds).toHaveLength(3);
    tick();
    expect(s.simulation!.counters.armedAttempts).toBe(1);
    expect(s.terminal?.reason ?? null).toBe(roll === 0 ? "regicide" : null);
    expect(s.board[7][4]).toBe("K");
  }
});
it("a check-escape turn extends an active response deadline and awards no success", () => {
  const s = v5Fixture(
      [
        ["K", [7, 4]],
        ["k", [0, 7]],
        ["r", [0, 4]],
        ["N", [7, 1]],
      ],
      20,
    ),
    id = s.pieceIds[7][1]!;
  encounters(s).active = [
    {
      id: "encounter-1",
      family: "initiative",
      phase: 1,
      side: "white",
      participants: [id],
      causes: [],
      createdPly: 10,
      createdOwn: 0,
      deadline: 3,
      objective: { kind: "develop", subject: id },
      stage: 1,
      stageOwn: 0,
      outcome: "active",
      consumed: [],
      parent: null,
      interacted: false,
      effective: false,
    },
  ];
  encounters(s).serial = 1;
  encounters(s).modifiers = ["steady", "support", "dispute"].map((kind) => ({
    encounterId: "encounter-1",
    subject: id,
    helper: null,
    kind: kind as "steady" | "support" | "dispute",
    expires: 6,
    consumed: false,
  }));
  const m = getAllLegalMoves(s.board, "white", s.rights)[0];
  const r = submitMove(s, m, { draw: () => 0.99 });
  expect(encounters(r.state).active[0].deadline).toBe(4);
  expect(encounters(r.state).recent).toEqual([]);
  expect(encounters(r.state).modifiers.map((m) => m.expires)).toEqual([
    7, 6, 6,
  ]);
  validateState(r.state);
});
