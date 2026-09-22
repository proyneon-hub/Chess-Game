import { NextRequest, NextResponse } from "next/server";
import {
  getServerMatch,
  isCurrentVersion,
  submitServerMove,
} from "@/lib/serverMatches";
import { guestMutation, noStore, withGuest } from "@/lib/serverHttp";
import { parseAction } from "@/lib/game/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const etag = (version: number) => `"${version}"`;
export async function GET(request: NextRequest, context: Context) {
  const params = await context.params;
  return withGuest(
    request,
    async (session) => {
      // Polls send the last version they saw; skip the full state if unchanged.
      const known = /^"(\d+)"$/.exec(
        request.headers.get("if-none-match") ?? "",
      );
      if (
        known &&
        !session.isNew &&
        (await isCurrentVersion(params.id, Number(known[1])))
      )
        return new NextResponse(null, {
          status: 304,
          headers: { "Cache-Control": "no-store", ETag: known[0] },
        });
      const match = await getServerMatch(params.id, session.playerId);
      if (!match) return noStore({ error: "Match not found." }, 404);
      const response = noStore(match);
      response.headers.set("ETag", etag(match.version));
      return response;
    },
    { mint: false },
  );
}
export async function POST(request: NextRequest, context: Context) {
  const params = await context.params;
  return guestMutation(
    request,
    parseAction,
    "A valid action is required.",
    async (session, action) => {
      const result = await submitServerMove(
        params.id,
        session.playerId,
        action,
      );
      return noStore(
        result.match
          ? {
              ...result.match,
              error: result.error,
              duplicate: result.duplicate,
            }
          : { error: result.error },
        result.status,
      );
    },
  );
}
