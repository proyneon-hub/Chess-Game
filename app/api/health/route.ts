import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { noStore } from "@/lib/serverHttp";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Liveness plus database reachability, for uptime checks. No session. */
export async function GET() {
  try {
    await connectToDatabase();
    await mongoose.connection.db!.admin().ping();
    return noStore({ ok: true });
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        path: "/api/health",
        error: error instanceof Error ? error.name : typeof error,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return noStore({ ok: false }, 503);
  }
}
