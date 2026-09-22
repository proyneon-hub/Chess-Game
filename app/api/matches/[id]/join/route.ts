import { joinServerMatch } from "@/lib/serverMatches";
import { emptyBody, guestMutation, noStore } from "@/lib/serverHttp";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  return guestMutation(
    request,
    emptyBody,
    "Invalid request.",
    async (session) => {
      const result = await joinServerMatch(params.id, session.playerId);
      return noStore(
        result.match
          ? { ...result.match, error: result.error }
          : { error: result.error },
        result.status,
      );
    },
  );
}
