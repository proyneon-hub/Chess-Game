import { NextResponse } from "next/server";
import { isDatabaseConnectivityError } from "@/lib/db";
import { getGuestSession, persistGuestSession } from "@/lib/session";
import { joinServerMatch } from "@/lib/serverMatches";

export const runtime = "nodejs";

type Context = { params: { id: string } };

export async function POST(request: Request, { params }: Context) {
  try {
    const session = getGuestSession();
    const result = await joinServerMatch(params.id, session.playerId);
    const response = result.match
      ? NextResponse.json({ ...result.match, error: result.error }, { status: result.status })
      : NextResponse.json({ error: result.error }, { status: result.status });
    const secure = new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
    return persistGuestSession(response, session, secure);
  } catch (error) {
    const message = isDatabaseConnectivityError(error)
      ? "Database unavailable. Check MongoDB Atlas access and MONGODB_URI."
      : "Unable to join the match.";
    return NextResponse.json({ error: message }, { status: isDatabaseConnectivityError(error) ? 503 : 500 });
  }
}
