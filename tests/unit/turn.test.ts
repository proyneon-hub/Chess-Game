import { expect, it } from "vitest";
import { createGameState } from "@/lib/game";
import { publicState } from "@/lib/game/publicState";
import { canMove } from "@/components/chess/turn";

const game = publicState(createGameState(1));
const online = {
  remote: { waitingForOpponent: false },
  busy: false,
  retryable: false,
};
const base = {
  game,
  side: "white" as const,
  kind: "local" as const,
  computerThinking: false,
  online,
};

it("the side to move may act in an active game", () => {
  expect(canMove(base)).toBe(true);
  expect(canMove({ ...base, side: "black" })).toBe(false);
  expect(canMove({ ...base, side: null })).toBe(false);
  expect(canMove({ ...base, game: null })).toBe(false);
  expect(canMove({ ...base, game: { ...game, status: "finished" } })).toBe(
    false,
  );
});

it("a computer search blocks input", () => {
  expect(canMove({ ...base, kind: "computer", computerThinking: true })).toBe(
    false,
  );
});

it("online play waits for an opponent, a pending request and a retry", () => {
  const onlineBase = { ...base, kind: "online" as const };
  expect(canMove(onlineBase)).toBe(true);
  expect(canMove({ ...onlineBase, online: { ...online, remote: null } })).toBe(
    false,
  );
  expect(
    canMove({
      ...onlineBase,
      online: { ...online, remote: { waitingForOpponent: true } },
    }),
  ).toBe(false);
  expect(canMove({ ...onlineBase, online: { ...online, busy: true } })).toBe(
    false,
  );
  expect(
    canMove({ ...onlineBase, online: { ...online, retryable: true } }),
  ).toBe(false);
  // Online transport state never blocks local play.
  expect(canMove({ ...base, online: { ...online, busy: true } })).toBe(true);
});
