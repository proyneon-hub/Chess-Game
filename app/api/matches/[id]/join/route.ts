import { NextResponse } from "next/server";
import { joinServerMatch } from "@/lib/serverMatches";
import { getGuestSession, persistGuestSession } from "@/lib/session";
import { genericError, readBody, sameOrigin } from "@/lib/serverHttp";
import { record } from "@/lib/game/validation";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
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
      result = await joinServerMatch(params.id, session.playerId);
    const response = NextResponse.json(
      result.match
        ? { ...result.match, error: result.error }
        : { error: result.error },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
    return persistGuestSession(
      response,
      session,
      new URL(request.url).protocol === "https:" ||
        request.headers.get("x-forwarded-proto") === "https",
    );
  } catch (error) {
    return genericError(error);
  }
}
