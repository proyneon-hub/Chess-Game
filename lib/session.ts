import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { type NextResponse } from "next/server";
import { cookies } from "next/headers";
import { UUID } from "@/lib/game/validation";

const COOKIE_NAME = "rpg_chess_guest";

const secret = () => {
  if (process.env.CHESS_AUTH_SECRET) return process.env.CHESS_AUTH_SECRET;
  if (process.env.NODE_ENV === "production")
    throw new Error("CHESS_AUTH_SECRET is missing.");
  return "local-development-secret-change-me";
};

const signatureFor = (playerId: string) =>
  createHmac("sha256", secret()).update(playerId).digest("base64url");

const validPlayerId = (value: string) => UUID.test(value);

export type GuestSession = { playerId: string; isNew: boolean };

export const getGuestSession = (): GuestSession => {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (token) {
    const separator = token.lastIndexOf(".");
    const playerId = token.slice(0, separator);
    const suppliedSignature = token.slice(separator + 1);
    const expectedSignature = signatureFor(playerId);
    if (
      separator > 0 &&
      validPlayerId(playerId) &&
      /^[A-Za-z0-9_-]{43}$/.test(suppliedSignature) &&
      suppliedSignature.length === expectedSignature.length
    ) {
      const valid = timingSafeEqual(
        Buffer.from(suppliedSignature),
        Buffer.from(expectedSignature),
      );
      if (valid) return { playerId, isNew: false };
    }
  }
  return { playerId: randomUUID(), isNew: true };
};

export const persistGuestSession = (
  response: NextResponse,
  session: GuestSession,
  secure: boolean,
) => {
  if (!session.isNew) return response;
  response.cookies.set({
    name: COOKIE_NAME,
    value: `${session.playerId}.${signatureFor(session.playerId)}`,
    httpOnly: true,
    sameSite: "lax",
    // Secure cookies are mandatory on deployed HTTPS requests, but local
    // `next start` uses HTTP even though NODE_ENV is production.
    secure,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
};
