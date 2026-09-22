import { expect, it } from "vitest";
import { createGameState } from "@/lib/game";
import { publicState, type PublicMatch } from "@/lib/game/publicState";
import { statusText, type StatusInput } from "@/components/chess/statusText";
import { boardFixture } from "../fixtures";

const game = publicState(createGameState(1));
const remote = { waitingForOpponent: false } as PublicMatch;
const base: StatusInput = {
  game,
  kind: "local",
  online: { error: "", remote: null, busy: false },
  computerThinking: false,
  message: "White to move.",
};

it("results, check, and warnings take precedence over mode messages", () => {
  expect(statusText({ ...base, game: { ...game, result: "Draw." } })).toBe(
    "Draw.",
  );
  const check = publicState(
    boardFixture([
      ["K", [7, 4]],
      ["r", [0, 4]],
      ["k", [0, 0]],
    ]),
  );
  expect(
    statusText({
      ...base,
      game: check,
      online: { ...base.online, error: "x" },
    }),
  ).toBe("Check!");
  expect(
    statusText({
      ...base,
      game: { ...game, warning: { message: "Unrest.", square: null } },
    }),
  ).toBe("Unrest.");
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
