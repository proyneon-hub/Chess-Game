import { NextRequest, NextResponse } from "next/server";
import { createServerMatch } from "@/lib/serverMatches";
import { getGuestSession, persistGuestSession } from "@/lib/session";
import { genericError, readBody, sameOrigin } from "@/lib/serverHttp";
import { record } from "@/lib/game/validation";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  try {
    const body = await readBody(request);
    if (!record(body) || Object.keys(body).length)
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  try {
    const session = getGuestSession(),
      match = await createServerMatch(session.playerId);
    return persistGuestSession(
      NextResponse.json(match, {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      }),
      session,
      request.nextUrl.protocol === "https:" ||
        request.headers.get("x-forwarded-proto") === "https",
    );
  } catch (error) {
    return genericError(error);
  }
}
