import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { type NextResponse } from "next/server";
import { cookies } from "next/headers";
import { UUID } from "@/lib/game/validation";

const COOKIE_NAME = "rpg_chess_guest";
const DAY = 60 * 60 * 24;
const MAX_AGE = 30 * DAY;
// Active guests are re-issued a fresh cookie once it is half-way through its
// lifetime, so an identity only expires after 30 days without any visit.
const REFRESH_AFTER = 15 * DAY;

const secret = () => {
  if (process.env.CHESS_AUTH_SECRET) return process.env.CHESS_AUTH_SECRET;
  if (process.env.NODE_ENV === "production")
    throw new Error("CHESS_AUTH_SECRET is missing.");
  return "local-development-secret-change-me";
};
// Verify-only secret, so rotating CHESS_AUTH_SECRET does not log guests out.
const secrets = () =>
  [secret(), process.env.CHESS_AUTH_SECRET_PREVIOUS].filter(
    (s): s is string => !!s,
  );

const sign = (key: string, payload: string) =>
  createHmac("sha256", key).update(payload).digest("base64url");
const matches = (supplied: string, expected: string) =>
  supplied.length === expected.length &&
  timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));

export type GuestSession = {
  playerId: string;
  isNew: boolean;
  /** The cookie should be re-issued: legacy format, aging, or old secret. */
  refresh?: boolean;
};

export const issueGuestToken = (playerId: string, now = Date.now()) => {
  const issuedAt = Math.floor(now / 1000);
  return `${playerId}.${issuedAt}.${sign(secret(), `${playerId}.${issuedAt}`)}`;
};

/**
 * Accepts `playerId.issuedAt.signature` and the original
 * `playerId.signature` format; returns null for anything unverifiable.
 */
export function readGuestToken(
  token: string,
  now = Date.now(),
): { playerId: string; refresh: boolean } | null {
  const parts = token.split(".");
  if (parts.length < 2 || parts.length > 3) return null;
  const playerId = parts[0],
    supplied = parts[parts.length - 1],
    issuedAt = parts.length === 3 ? parts[1] : null;
  if (!UUID.test(playerId) || !/^[A-Za-z0-9_-]{43}$/.test(supplied))
    return null;
  if (issuedAt !== null && !/^\d{1,12}$/.test(issuedAt)) return null;
  const payload = issuedAt === null ? playerId : `${playerId}.${issuedAt}`;
  const keys = secrets(),
    index = keys.findIndex((key) => matches(supplied, sign(key, payload)));
  if (index < 0) return null;
  const age = issuedAt === null ? Infinity : now / 1000 - Number(issuedAt);
  return {
    playerId,
    refresh: index > 0 || !(age >= 0 && age < REFRESH_AFTER),
  };
}

export const getGuestSession = (): GuestSession => {
  const token = cookies().get(COOKIE_NAME)?.value;
  const verified = token ? readGuestToken(token) : null;
  return verified
    ? { playerId: verified.playerId, isNew: false, refresh: verified.refresh }
    : { playerId: randomUUID(), isNew: true };
};

export const persistGuestSession = (
  response: NextResponse,
  session: GuestSession,
  secure: boolean,
) => {
  if (!session.isNew && !session.refresh) return response;
  response.cookies.set({
    name: COOKIE_NAME,
    value: issueGuestToken(session.playerId),
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: MAX_AGE,
  });
  return response;
};
