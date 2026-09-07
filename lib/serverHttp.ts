import { NextResponse } from "next/server";
import { IncompatibleStateError } from "@/lib/game/validation";
import { isDatabaseConnectivityError } from "@/lib/db";
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
export const genericError = (error: unknown) =>
  NextResponse.json(
    {
      error:
        error instanceof IncompatibleStateError
          ? error.message
          : isDatabaseConnectivityError(error)
            ? "The match service is temporarily unavailable."
            : "Unable to process this match.",
    },
    {
      status:
        error instanceof IncompatibleStateError
          ? 409
          : isDatabaseConnectivityError(error)
            ? 503
            : 500,
      headers: { "Cache-Control": "no-store" },
    },
  );
