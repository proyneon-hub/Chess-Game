import { NextRequest, NextResponse } from "next/server";
import { createServerMatch } from "@/lib/serverMatches";
import { isDatabaseConnectivityError } from "@/lib/db";
import { getGuestSession, persistGuestSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // Reading the body keeps this endpoint forwards-compatible without trusting
  // client-supplied identity. The signed, HTTP-only guest cookie owns identity.
  await request.json().catch(() => null);
  try {
    const session = getGuestSession();
    const match = await createServerMatch(session.playerId);
    const secure = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
    return persistGuestSession(NextResponse.json(match, { status: 201 }), session, secure);
  } catch (error) {
    const message = isDatabaseConnectivityError(error)
      ? "Database unavailable. Check MongoDB Atlas access and MONGODB_URI."
      : error instanceof Error ? error.message : "Unable to create the match.";
    return NextResponse.json({ error: message }, { status: isDatabaseConnectivityError(error) ? 503 : 500 });
  }
}
