import { beforeEach, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
const cookie = vi.hoisted(() => ({ value: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: () => (cookie.value ? { value: cookie.value } : undefined),
  }),
}));
import { getGuestSession, persistGuestSession } from "@/lib/session";
beforeEach(() => {
  cookie.value = undefined;
  process.env.CHESS_AUTH_SECRET = "isolated-session-test";
});
it("signed guests persist identity and cookie protections", () => {
  const session = getGuestSession(),
    response = persistGuestSession(NextResponse.json({}), session, true),
    c = response.cookies.get("rpg_chess_guest")!;
  cookie.value = c.value;
  expect(getGuestSession()).toEqual({
    playerId: session.playerId,
    isNew: false,
  });
  expect(c.httpOnly).toBe(true);
  expect(c.secure).toBe(true);
  expect(c.sameSite).toBe("lax");
});
it("tampered, malformed and multibyte signatures produce fresh guests", () => {
  const original = getGuestSession();
  const c = persistGuestSession(
    NextResponse.json({}),
    original,
    false,
  ).cookies.get("rpg_chess_guest")!.value;
  for (const token of [
    c.replace(c[0], c[0] === "a" ? "b" : "a"),
    "garbage",
    original.playerId + "." + "é".repeat(43),
  ]) {
    cookie.value = token;
    const next = getGuestSession();
    expect(next.isNew).toBe(true);
    expect(next.playerId).not.toBe(original.playerId);
  }
});
