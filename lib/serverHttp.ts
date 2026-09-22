import { NextResponse } from "next/server";
import { IncompatibleStateError, record } from "@/lib/game/validation";
import { isDatabaseConnectivityError } from "@/lib/db";
import {
  type GuestSession,
  getGuestSession,
  persistGuestSession,
} from "@/lib/session";
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return (
    !!origin &&
    origin === new URL(request.url).origin &&
    request.headers.get("sec-fetch-site") !== "cross-site"
  );
}
export async function readBody(request: Request, max = 1024): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > max)
    throw Error("Invalid request.");
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw Error("Invalid request.");
  const reader = request.body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) {
        await reader.cancel();
        throw Error("Invalid request.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export const noStore = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
// Deployed requests arrive over HTTPS (possibly via a proxy); local `next
// start` uses HTTP even though NODE_ENV is production.
export const isSecureRequest = (request: Request) =>
  new URL(request.url).protocol === "https:" ||
  request.headers.get("x-forwarded-proto") === "https";
/** Resolves the guest session, persists a new one, and maps failures. */
export async function withGuest(
  request: Request,
  handler: (session: GuestSession) => Promise<NextResponse>,
) {
  try {
    const session = getGuestSession();
    return persistGuestSession(
      await handler(session),
      session,
      isSecureRequest(request),
    );
  } catch (error) {
    return genericError(error);
  }
}
/**
 * Mutations: same-origin check and a bounded, parsed JSON body, both rejected
 * before a guest session is created.
 */
export async function guestMutation<T>(
  request: Request,
  parse: (body: unknown) => T | null | undefined,
  invalid: string,
  handler: (session: GuestSession, body: T) => Promise<NextResponse>,
) {
  if (!sameOrigin(request))
    return noStore({ error: "Invalid request origin." }, 403);
  let body: T | null | undefined;
  try {
    body = parse(await readBody(request));
  } catch {
    /* Malformed or oversized body. */
  }
  if (body === null || body === undefined)
    return noStore({ error: invalid }, 400);
  const parsed = body;
  return withGuest(request, (session) => handler(session, parsed));
}
/** Accepts only an empty JSON object. */
export const emptyBody = (body: unknown) =>
  record(body) && !Object.keys(body).length ? body : null;
export const genericError = (error: unknown) =>
  NextResponse.json(
    {
      error:
        error instanceof IncompatibleStateError
          ? error.message
          : isDatabaseConnectivityError(error)
            ? "The match service is temporarily unavailable."
            : "Unable to process this match.",
    },
    {
      status:
        error instanceof IncompatibleStateError
          ? 409
          : isDatabaseConnectivityError(error)
            ? 503
            : 500,
      headers: { "Cache-Control": "no-store" },
    },
  );
