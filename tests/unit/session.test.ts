import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
const cookie = vi.hoisted(() => ({ value: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: () => (cookie.value ? { value: cookie.value } : undefined),
  }),
}));
import {
  getGuestSession,
  issueGuestToken,
  persistGuestSession,
  readGuestToken,
} from "@/lib/session";
beforeEach(() => {
  cookie.value = undefined;
  vi.stubEnv("CHESS_AUTH_SECRET", "isolated-session-test");
});
afterEach(() => vi.unstubAllEnvs());
it("signed guests persist identity and cookie protections", async () => {
  const session = await getGuestSession(),
    response = persistGuestSession(NextResponse.json({}), session, true),
    c = response.cookies.get("rpg_chess_guest")!;
  cookie.value = c.value;
  expect(await getGuestSession()).toEqual({
    playerId: session.playerId,
    isNew: false,
    refresh: false,
  });
  expect(c.httpOnly).toBe(true);
  expect(c.secure).toBe(true);
  expect(c.sameSite).toBe("lax");
  // A current cookie is not re-sent on every response.
  expect(
    persistGuestSession(
      NextResponse.json({}),
      await getGuestSession(),
      true,
    ).cookies.get("rpg_chess_guest"),
  ).toBeUndefined();
});
it("tampered, malformed and multibyte signatures produce fresh guests", async () => {
  const original = await getGuestSession();
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
    const next = await getGuestSession();
    expect(next.isNew).toBe(true);
    expect(next.playerId).not.toBe(original.playerId);
  }
});

const id = "3b241101-e2bb-4255-8caf-4136c566a962";
const DAY = 24 * 60 * 60 * 1000;
const legacy = (key: string) =>
  `${id}.${createHmac("sha256", key).update(id).digest("base64url")}`;
it("fresh tokens verify without refresh; aging tokens refresh", () => {
  const now = Date.now(),
    token = issueGuestToken(id, now);
  expect(readGuestToken(token, now + DAY)).toEqual({
    playerId: id,
    refresh: false,
  });
  expect(readGuestToken(token, now + 16 * DAY)?.refresh).toBe(true);
});
it("legacy two-part tokens are accepted, refreshed, and re-issued", async () => {
  cookie.value = legacy("isolated-session-test");
  const session = await getGuestSession();
  expect(session).toEqual({ playerId: id, isNew: false, refresh: true });
  const upgraded = persistGuestSession(
    NextResponse.json({}),
    session,
    true,
  ).cookies.get("rpg_chess_guest")!.value;
  expect(upgraded.split(".")).toHaveLength(3);
  expect(readGuestToken(upgraded)).toEqual({ playerId: id, refresh: false });
});
it("foreign and forged tokens are rejected", () => {
  const [, issuedAt, sig] = issueGuestToken(id).split(".");
  const other = "9b241101-e2bb-4255-8caf-4136c566a962";
  expect(readGuestToken(`${other}.${issuedAt}.${sig}`)).toBeNull();
  expect(readGuestToken(`${id}.${Number(issuedAt) + 1}.${sig}`)).toBeNull();
  expect(readGuestToken(legacy("someone-else"))).toBeNull();
  for (const bad of ["", id, `${id}.x.y.z`, `not-a-uuid.${sig}`])
    expect(readGuestToken(bad)).toBeNull();
});
it("the previous secret still verifies during rotation, then re-signs", () => {
  vi.stubEnv("CHESS_AUTH_SECRET", "old");
  const token = issueGuestToken(id);
  vi.stubEnv("CHESS_AUTH_SECRET", "new");
  expect(readGuestToken(token)).toBeNull();
  vi.stubEnv("CHESS_AUTH_SECRET_PREVIOUS", "old");
  expect(readGuestToken(token)).toEqual({ playerId: id, refresh: true });
  expect(readGuestToken(issueGuestToken(id))?.refresh).toBe(false);
});
