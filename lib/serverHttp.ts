import { randomUUID } from "node:crypto";
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
/**
 * Resolves the guest session, persists a new or renewed one, and maps
 * failures. Every response carries an x-request-id that server logs share.
 */
export async function withGuest(
  request: Request,
  handler: (session: GuestSession) => Promise<NextResponse>,
) {
  const requestId = randomUUID();
  let response: NextResponse;
  try {
    const session = getGuestSession();
    response = persistGuestSession(
      await handler(session),
      session,
      isSecureRequest(request),
    );
  } catch (error) {
    response = genericError(error, { requestId, request });
  }
  response.headers.set("x-request-id", requestId);
  return response;
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
const failure = (error: unknown) =>
  error instanceof IncompatibleStateError
    ? { status: 409, message: error.message }
    : isDatabaseConnectivityError(error)
      ? {
          status: 503,
          message: "The match service is temporarily unavailable.",
        }
      : { status: 500, message: "Unable to process this match." };
/**
 * Maps a failure to its public response and logs one structured line. Only
 * request metadata and the error are logged: never cookies, bodies or state.
 */
export function genericError(
  error: unknown,
  context?: { requestId: string; request: Request },
) {
  const { status, message } = failure(error);
  if (context) {
    const url = new URL(context.request.url);
    const entry = {
      level: status === 409 ? "warn" : "error",
      requestId: context.requestId,
      method: context.request.method,
      path: url.pathname,
      status,
      error: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };
    (status === 409 ? console.warn : console.error)(JSON.stringify(entry));
  }
  return noStore({ error: message }, status);
}
