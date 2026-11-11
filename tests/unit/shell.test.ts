import { expect, it, vi } from "vitest";
import { createGameState, movesFor, submitMove } from "@/lib/game";
import { publicState, type PublicMatch } from "@/lib/game/publicState";
import { recordTurn, undoTurn } from "@/lib/game/undo";
import { validateState } from "@/lib/game/validation";
import { BATTLE_CONFIG } from "@/lib/battle/config";
import { submitWithFallback } from "@/hooks/useComputerTurn";
import { newerMatch } from "@/hooks/useOnlineMatch";
import { statusText, type StatusInput } from "@/components/chess/statusText";
import type { MoveAttempt, MoveResult } from "@/lib/game/types";
import { KINGS, boardFixture } from "../fixtures";

const game = publicState(createGameState(1));
const remote = { waitingForOpponent: false } as PublicMatch;
const base: StatusInput = {
  game,
  kind: "local",
  online: { error: "", remote: null, busy: false },
  computerThinking: false,
  message: "White to move.",
};

it("the result takes precedence over every mode message", () => {
  expect(
    statusText({
      ...base,
      kind: "online",
      game: { ...game, result: "Draw." },
      online: { ...base.online, error: "x" },
    }),
  ).toBe("Draw.");
});
it("online status follows connection and match state", () => {
  const online = (o: Partial<StatusInput["online"]>) =>
    statusText({ ...base, kind: "online", online: { ...base.online, ...o } });
  expect(online({})).toBe("Opening the match…");
  expect(online({ remote, error: "Lost." })).toBe("Lost.");
  expect(online({ remote: { ...remote, waitingForOpponent: true } })).toBe(
    "Waiting for an opponent to join.",
  );
  expect(online({ remote, busy: true })).toBe("Submitting move…");
  expect(online({ remote })).toBe("Select a piece and destination.");
});
it("local and computer modes show the local message or thinking", () => {
  expect(statusText(base)).toBe("White to move.");
  expect(
    statusText({ ...base, kind: "computer", computerThinking: true }),
  ).toBe("Your opponent is considering the board.");
});

it("a rejected computer move falls back instead of stalling the turn", () => {
  const move: MoveAttempt = { from: [1, 0], to: [3, 0], side: "black" };
  const fallback: MoveAttempt = { from: [1, 1], to: [2, 1], side: "black" };
  const submit = vi.fn(
    (a: MoveAttempt) =>
      ({ requestAccepted: a === fallback, message: "" }) as MoveResult,
  );
  expect(submitWithFallback(submit, move, fallback).requestAccepted).toBe(true);
  expect(submit).toHaveBeenCalledTimes(2);
  submit.mockClear();
  expect(submitWithFallback(submit, fallback, fallback).requestAccepted).toBe(
    true,
  );
  expect(submit).toHaveBeenCalledTimes(1);
});
it("older polls and responses to departed matches are ignored", () => {
  const m = {
    id: "a",
    state: game,
    version: 3,
    playerSide: "white" as const,
    waitingForOpponent: false,
  };
  expect(newerMatch(m, { ...m, version: 2 }, "a")).toBe(false);
  expect(newerMatch(m, { ...m, version: 4 }, null)).toBe(false);
  expect(newerMatch(m, { ...m, id: "b", version: 10 }, "a")).toBe(false);
  expect(newerMatch(m, { ...m, version: 4 }, "a")).toBe(true);
});

it("threefold can be claimed and fivefold ends the game", () => {
  let s = createGameState(1);
  const shuffle = () => {
    for (const [from, to] of [
      [
        [7, 6],
        [5, 5],
      ],
      [
        [0, 6],
        [2, 5],
      ],
      [
        [5, 5],
        [7, 6],
      ],
      [
        [2, 5],
        [0, 6],
      ],
    ] as [[number, number], [number, number]][])
      s = submitMove(s, { from, to, side: s.sideToMove }).state;
  };
  expect(
    submitMove(s, { type: "claim-draw", side: "white" }).requestAccepted,
  ).toBe(false);
  shuffle();
  shuffle();
  expect(publicState(s).drawClaims.threefold).toBe(true);
  const claim = submitMove(s, { type: "claim-draw", side: s.sideToMove });
  expect(claim.state.terminal?.reason).toBe("threefold");
  expect(claim.state.ply).toBe(s.ply);
  expect(() => validateState(structuredClone(claim.state))).not.toThrow();
  shuffle();
  shuffle();
  expect(s.terminal?.reason).toBe("fivefold");
});
it("fifty quiet moves allow a claim and seventy-five end the game", () => {
  const s = boardFixture([...KINGS, ["R", [7, 0]], ["r", [0, 0]]]);
  s.rights.halfmove = 99;
  const quiet = submitMove(s, { from: [7, 0], to: [6, 0], side: "white" });
  expect(publicState(quiet.state).drawClaims.fiftyMove).toBe(true);
  expect(
    submitMove(quiet.state, { type: "claim-draw", side: "black" }).state
      .terminal?.reason,
  ).toBe("fifty-move");
  s.rights.halfmove = 149;
  expect(
    submitMove(s, { from: [7, 0], to: [6, 0], side: "white" }).state.terminal
      ?.reason,
  ).toBe("seventy-five-move");
});
it("a side with no move draws", () => {
  // Black has only a pawn, and it is blocked. White's king steps aside.
  const s = boardFixture([
    ["K", [7, 7]],
    ["p", [3, 0]],
    ["P", [4, 0]],
  ]);
  const r = submitMove(s, { from: [7, 7], to: [7, 6], side: "white" });
  expect(r.state.terminal).toMatchObject({ reason: "stalemate", winner: null });
});

it("moves out of turn, after the end, or on unknown rules are rejected", () => {
  const s = createGameState(2);
  expect(
    submitMove(s, { from: [1, 4], to: [3, 4], side: "black" }).message,
  ).toBe("It is not your turn.");
  const done = { ...s, status: "finished" as const };
  expect(
    submitMove(done, { from: [6, 4], to: [4, 4], side: "white" }).message,
  ).toBe("This game has already ended.");
  expect(
    submitMove(
      { ...s, configVersion: "2026-09-23.1" },
      { from: [6, 4], to: [4, 4], side: "white" },
    ).requestAccepted,
  ).toBe(false);
  expect(() => createGameState(1, "2026-09-23.1")).toThrow();
});
it("games begun under older rules are refused as incompatible", () => {
  for (const old of [
    { schemaVersion: 6, rulesetVersion: "hidden-kingdom-v6" },
    { schemaVersion: 1, rulesetVersion: "legacy-v1" },
    { board: [], pieceIds: [], rpgState: {} },
    null,
  ])
    expect(() =>
      validateState(old && { ...createGameState(1), ...old }),
    ).toThrow("incompatible");
  // Fields an earlier Battle Chess build stored are ignored, not rejected.
  const earlier = {
    ...createGameState(3),
    simulation: null,
    pendingRefusal: null,
    warning: null,
    specialSquare: null,
  };
  expect(() => validateState(earlier)).not.toThrow();
});
it("undo keeps at most the configured number of turns", () => {
  let s = createGameState(4),
    history = { start: s, completed: [] as (typeof s)[] };
  for (let i = 0; i < 30 && s.status === "active"; i++) {
    const r = submitMove(s, movesFor(s)[i % movesFor(s).length]);
    history = recordTurn(history, r);
    s = r.state;
  }
  expect(history.completed).toHaveLength(BATTLE_CONFIG.undoLimit);
  const undone = undoTurn(history, s);
  expect(undone.message).toBe("Last move undone.");
  expect(undone.game.ply).toBe(s.ply - 1);
  expect(undoTurn({ start: s, completed: [] }, s).message).toBe(
    "No move to undo.",
  );
});
