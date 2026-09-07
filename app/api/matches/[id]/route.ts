import { NextRequest, NextResponse } from "next/server";
import { getServerMatch, submitServerMove } from "@/lib/serverMatches";
import { getGuestSession, persistGuestSession } from "@/lib/session";
import { genericError, readBody, sameOrigin } from "@/lib/serverHttp";
import { parseAction } from "@/lib/game/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: { id: string } };
export async function GET(request: NextRequest, { params }: Context) {
  try {
    const session = getGuestSession(),
      match = await getServerMatch(params.id, session.playerId);
    const response = match
      ? NextResponse.json(match, { headers: { "Cache-Control": "no-store" } })
      : NextResponse.json({ error: "Match not found." }, { status: 404 });
    return persistGuestSession(
      response,
      session,
      request.nextUrl.protocol === "https:" ||
        request.headers.get("x-forwarded-proto") === "https",
    );
  } catch (error) {
    return genericError(error);
  }
}
export async function POST(request: NextRequest, { params }: Context) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  let action;
  try {
    action = parseAction(await readBody(request));
  } catch {
    /* Malformed or oversized body. */
  }
  if (!action)
    return NextResponse.json(
      { error: "A valid action is required." },
      { status: 400 },
    );
  try {
    const session = getGuestSession(),
      result = await submitServerMove(params.id, session.playerId, action);
    const response = NextResponse.json(
      result.match
        ? { ...result.match, error: result.error, duplicate: result.duplicate }
        : { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
    return persistGuestSession(
      response,
      session,
      request.nextUrl.protocol === "https:" ||
        request.headers.get("x-forwarded-proto") === "https",
    );
  } catch (error) {
    return genericError(error);
  }
}
