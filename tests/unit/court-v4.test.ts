import { expect, it } from "vitest";
import { constructedV4Court } from "../progression-fixtures";
import { scheduleCourt, activePlot } from "@/lib/rpg/conspiracy";
import { validateState } from "@/lib/game/validation";
import { CONFIG, READABLE_CANDIDATES } from "@/lib/rpg/config";
import { v4Fixture } from "../progression-fixtures";
import { subjectAt } from "../fixtures";
import { agencyForecast } from "@/lib/rpg/agency";
import { progression } from "@/lib/rpg/pressure";
import { riskFriction } from "@/lib/rpg/relationships";
const tick = (s: ReturnType<typeof constructedV4Court>, roll = 0) => {
  s.ply += 2;
  s.revision++;
  s.simulation!.turnContext.ply = s.ply;
  s.simulation!.kingdoms.white.ownTurnsCompleted++;
  scheduleCourt(s, "white", () => roll, false);
};
it("v4 constructed court retains three separate warnings and a response before any attempt", () => {
  for (const success of [true, false]) {
    const s = constructedV4Court();
    tick(s);
    tick(s);
    expect(activePlot(s)?.stage).toBe("gathering");
    tick(s);
    tick(s);
    expect(s.events).toHaveLength(3);
    expect(s.simulation!.counters.armedAttempts ?? 0).toBe(0);
    validateState(s);
    tick(s, success ? 0 : 0.99);
    expect(s.simulation!.counters.armedAttempts).toBe(1);
    expect(s.terminal?.reason ?? null).toBe(success ? "regicide" : null);
    expect(s.board[7][4]).toBe("K");
    validateState(s);
  }
});
it("candidate configurations change only the declared eligibility windows and never event odds", () => {
  for (const c of READABLE_CANDIDATES)
    for (const key of [
      "agencyBase",
      "refusalMax",
      "retreatMax",
      "heroicChance",
      "plotChance",
      "plotMinChance",
      "plotMaxChance",
    ] as const)
      expect(c[key]).toBe(CONFIG[key]);
  const s = v4Fixture(
    [
      ["K", [7, 7]],
      ["k", [0, 7]],
      ["R", [5, 0]],
      ["p", [2, 1]],
    ],
    40,
  );
  Object.assign(subjectAt(s, [5, 0]), { fear: 62, loyalty: 50 });
  const m = {
    from: [5, 0] as [number, number],
    to: [3, 0] as [number, number],
    side: "white" as const,
  };
  expect(agencyForecast(s, m).retreat).toBe(0);
  s.configVersion = s.simulation!.configVersion = "2026-09-09.2";
  expect(agencyForecast(s, m).retreat).toBe(0.01);
});
it("nearby preference selects only an already qualified, streak-qualified leader and never moves it", () => {
  for (const version of ["2026-09-09.1", "2026-09-09.4"]) {
    const s = constructedV4Court();
    s.configVersion = s.simulation!.configVersion = version;
    const near = subjectAt(s, [5, 3]),
      far = subjectAt(s, [5, 5]);
    far.resentment = 90;
    s.board[5][5] = null;
    s.pieceIds[5][5] = null;
    s.board[3][5] = "N";
    s.pieceIds[3][5] = far.id;
    const board = structuredClone(s.board);
    tick(s);
    expect(activePlot(s)).toBeUndefined();
    tick(s);
    expect(activePlot(s)?.ringleader).toBe(
      version.endsWith(".4") ? near.id : far.id,
    );
    expect(s.board).toEqual(board);
    validateState(s);
  }
});
it("the longer rivalry window still needs two real episodes under the same sole defender", () => {
  for (const version of ["2026-09-09.1", "2026-09-09.3"]) {
    const s = constructedV4Court();
    s.configVersion = s.simulation!.configVersion = version;
    const a = subjectAt(s, [5, 3]),
      b = subjectAt(s, [5, 5]);
    a.personality = "proud";
    const q = progression(s).subjects[a.id];
    q.episodes.forEach((e, i) => {
      e.cause = "avoidable_exposure";
      e.causes = ["avoidable_exposure"];
      e.openedOwnTurn = 1 + i * 2;
      e.lastAppliedOwnTurn = e.openedOwnTurn;
      e.defenderIds = [b.id];
    });
    riskFriction(s, "white");
    expect(s.simulation!.counters.rivalFriction ?? 0).toBe(
      version.endsWith(".3") ? 1 : 0,
    );
  }
});
it("four deferrals preserve all response turns and eventually thwart a distant court", () => {
  for (const limit of [2, 4]) {
    const s = constructedV4Court();
    s.configVersion = s.simulation!.configVersion =
      limit === 2 ? "2026-09-09.1" : "2026-09-09.5";
    tick(s);
    tick(s);
    tick(s);
    tick(s);
    // Keep participants intact and move the king away, a real counterplay option.
    const kingId = s.pieceIds[7][4];
    s.board[7][4] = null;
    s.pieceIds[7][4] = null;
    s.board[7][7] = "K";
    s.pieceIds[7][7] = kingId;
    for (let n = 1; n <= limit; n++) {
      tick(s);
      expect(s.simulation!.counters.armedAttempts ?? 0).toBe(0);
      expect(s.simulation!.plots[0].deferredTurns).toBe(n);
      expect(s.simulation!.plots[0].stage).toBe(
        n === limit ? "thwarted" : "armed",
      );
    }
    expect(s.simulation!.counters["thwart:king-distance"]).toBe(1);
  }
});
it("v4 never attempts with missing warnings, protective guards or recovering leadership", () => {
  for (const blocker of ["warning", "guards", "recovery"]) {
    const s = constructedV4Court();
    tick(s);
    tick(s);
    tick(s);
    tick(s);
    if (blocker === "warning") s.events.splice(0, 1);
    if (blocker === "recovery") s.simulation!.kingdoms.white.legitimacy = 90;
    if (blocker === "guards") {
      // Construct two loyal guards from existing visible nonparticipants.
      const leader = activePlot(s)!;
      const extra = Object.values(s.simulation!.subjects).filter(
        (x) =>
          ![leader.ringleader, leader.accomplice].includes(x.id) &&
          x.currentKind !== "k",
      );
      for (const [i, x] of extra.entries()) {
        for (let r = 0; r < 8; r++)
          for (let c = 0; c < 8; c++)
            if (s.pieceIds[r][c] === x.id) {
              s.pieceIds[r][c] = null;
              s.board[r][c] = null;
            }
        x.side = "white";
        x.loyalty = 90;
        x.fear = 0;
        s.pieceIds[6][3 + i * 2] = x.id;
        s.board[6][3 + i * 2] = x.currentKind.toUpperCase();
      }
    }
    tick(s);
    expect(s.simulation!.counters.armedAttempts ?? 0).toBe(0);
    expect(s.terminal).toBeNull();
    expect(activePlot(s)).toBeUndefined();
  }
});
