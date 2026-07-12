import { NextRequest, NextResponse } from "next/server";
import { getServerMatch, submitServerMove } from "@/lib/serverMatches";
import { isDatabaseConnectivityError } from "@/lib/db";
import { getGuestSession, persistGuestSession } from "@/lib/session";

export const runtime = "nodejs";

type Context = { params: { id: string } };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const session = getGuestSession();
    const match = await getServerMatch(params.id, session.playerId);
    const response = match
      ? NextResponse.json(match)
      : NextResponse.json({ error: "Match not found." }, { status: 404 });
    const secure = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
    return persistGuestSession(response, session, secure);
  } catch (error) {
    const message = isDatabaseConnectivityError(error)
      ? "Database unavailable. Check MongoDB Atlas access and MONGODB_URI."
      : "Unable to load the match.";
    return NextResponse.json({ error: message }, { status: isDatabaseConnectivityError(error) ? 503 : 500 });
  }
}

export async function POST(request: NextRequest, { params }: Context) {
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.from) || !Array.isArray(body.to)) {
    return NextResponse.json({ error: "A move is required." }, { status: 400 });
  }
  try {
    const session = getGuestSession();
    const result = await submitServerMove(params.id, session.playerId, { from: body.from, to: body.to });
    const response = result.match
      ? NextResponse.json({ ...result.match, error: result.error }, { status: result.status })
      : NextResponse.json({ error: result.error }, { status: result.status });
    const secure = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
    return persistGuestSession(response, session, secure);
  } catch (error) {
    const message = isDatabaseConnectivityError(error)
      ? "Database unavailable. Check MongoDB Atlas access and MONGODB_URI."
      : "Unable to submit the move.";
    return NextResponse.json({ error: message }, { status: isDatabaseConnectivityError(error) ? 503 : 500 });
  }
}
