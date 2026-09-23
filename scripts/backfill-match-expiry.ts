// One-time backfill: dates every GameMatch saved before the expiresAt TTL
// index existed (2026-09-21), so it ages out on the same 30-day idle clock
// as everything written since. See docs/v1-sunset.md.
//
// Dry run (default, no writes):
//   npm run backfill:match-expiry
// Apply (writes; --confirm must name the connected database exactly):
//   npm run backfill:match-expiry -- --apply --confirm hidden_kingdom
import mongoose from "mongoose";
import { connectToDatabase } from "../lib/db";
import { GameMatch, MATCH_RETENTION_MS } from "../models/GameMatch";
import {
  hasTtlIndex,
  reportMatches,
  backfillExpiry,
} from "../lib/maintenance/matchExpiry";

const flags: Record<string, string | true> = {};
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i];
  if (key === "--apply") {
    flags[key] = true;
    continue;
  }
  if (key === "--confirm") {
    flags[key] = process.argv[++i];
    continue;
  }
  throw Error("Invalid option: " + key);
}

function printReport(
  label: string,
  report: Awaited<ReturnType<typeof reportMatches>>,
) {
  console.log(`\n${label}`);
  console.log(`  total: ${report.total}`);
  console.log(`  missing expiresAt: ${report.missingExpiry}`);
  console.log(`  legacy (no schemaVersion): ${report.legacy}`);
  console.log(`  by configVersion: ${JSON.stringify(report.byConfigVersion)}`);
  console.log(`  by schemaVersion: ${JSON.stringify(report.bySchemaVersion)}`);
}

async function main() {
  await connectToDatabase();
  const dbName = mongoose.connection.db!.databaseName;
  const collection = GameMatch.collection;

  if (!(await hasTtlIndex(collection))) {
    console.error(
      `No expiresAt TTL index found on database "${dbName}". Deploy main ` +
        "(it adds the index) before running this script - backfilling " +
        "expiresAt without it would date matches that nothing ever deletes.",
    );
    process.exitCode = 1;
    return;
  }

  printReport(
    `Before (database "${dbName}"):`,
    await reportMatches(collection),
  );

  if (!flags["--apply"]) {
    console.log(
      "\nDry run - no writes made. Re-run with --apply --confirm <dbName> to backfill.",
    );
    return;
  }
  if (flags["--confirm"] !== dbName) {
    console.error(
      `--confirm must exactly match the connected database name ("${dbName}"), got ${JSON.stringify(flags["--confirm"] ?? null)}.`,
    );
    process.exitCode = 1;
    return;
  }

  const expiresAt = new Date(Date.now() + MATCH_RETENTION_MS);
  const modified = await backfillExpiry(collection, expiresAt);
  console.log(
    `\nBackfilled expiresAt on ${modified} match(es) to ${expiresAt.toISOString()}.`,
  );
  printReport("After:", await reportMatches(collection));

  const gate = new Date(expiresAt.getTime() + 24 * 60 * 60 * 1000);
  console.log(
    `\nO2 gate date (expiresAt + 1 day, covering TTL-monitor delay and timezones): ${gate.toISOString()}\n` +
      "Record this date and today's counts in docs/v1-sunset.md.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
