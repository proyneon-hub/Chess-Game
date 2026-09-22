import { NextRequest } from "next/server";
import { createServerMatch, tooManyOpenInvites } from "@/lib/serverMatches";
import { emptyBody, guestMutation, noStore } from "@/lib/serverHttp";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  return guestMutation(
    request,
    emptyBody,
    "Invalid request.",
    async (session) =>
      (await tooManyOpenInvites(session.playerId))
        ? noStore({ error: "Too many open invites. Try again later." }, 429)
        : noStore(await createServerMatch(session.playerId), 201),
  );
}
