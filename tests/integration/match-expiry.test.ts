import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { GameMatch } from "@/models/GameMatch";
import {
  hasTtlIndex,
  reportMatches,
  backfillExpiry,
} from "@/lib/maintenance/matchExpiry";

let db: MongoMemoryServer;
beforeAll(async () => {
  db = await MongoMemoryServer.create();
  process.env.MONGODB_URI = db.getUri("match_expiry_test");
  const { connectToDatabase } = await import("@/lib/db");
  await connectToDatabase();
  // Mongoose builds declared indexes lazily in the background; the TTL index
  // must exist before any test that checks for it.
  await GameMatch.init();
}, 120000);
afterAll(async () => {
  await mongoose.disconnect();
  await db?.stop();
});
beforeEach(async () => {
  await GameMatch.collection.deleteMany({});
});

const doc = (overrides: Record<string, unknown>) => ({
  inviteId: randomUUID(),
  whitePlayerId: "white-1",
  blackPlayerId: null,
  state: { board: [] },
  version: 1,
  receipts: [],
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  ...overrides,
});

it("finds the TTL index the schema declares", async () => {
  expect(await hasTtlIndex(GameMatch.collection)).toBe(true);
});

it("reports no TTL index on a collection that never got one", async () => {
  const other = mongoose.connection.db!.collection("no_ttl_index_here");
  await other.insertOne({ ok: true });
  expect(await hasTtlIndex(other)).toBe(false);
});

describe("reportMatches", () => {
  it("counts totals, missing expiry, legacy and version breakdowns", async () => {
    await GameMatch.collection.insertMany([
      doc({
        schemaVersion: 6,
        configVersion: "2026-09-23.1",
        expiresAt: new Date("2027-01-01T00:00:00Z"),
      }),
      doc({
        schemaVersion: 5,
        configVersion: "2026-09-10.1",
        expiresAt: new Date("2027-01-01T00:00:00Z"),
      }),
      doc({ schemaVersion: 2, configVersion: "2026-09-07.3", expiresAt: null }),
      // A true legacy match: no schemaVersion field at all, like a record
      // saved before the field existed.
      doc({ expiresAt: null }),
    ]);
    const report = await reportMatches(GameMatch.collection);
    expect(report.total).toBe(4);
    expect(report.missingExpiry).toBe(2);
    expect(report.legacy).toBe(1);
    expect(report.bySchemaVersion).toEqual({
      "6": 1,
      "5": 1,
      "2": 1,
      "(none)": 1,
    });
    expect(report.byConfigVersion["2026-09-23.1"]).toBe(1);
    expect(report.byConfigVersion["(none)"]).toBe(1);
  });
});

describe("backfillExpiry", () => {
  it("dates only matches missing expiresAt, leaves updatedAt and already-dated matches alone, and is idempotent", async () => {
    const dated = new Date("2027-01-01T00:00:00Z");
    await GameMatch.collection.insertMany([
      doc({ expiresAt: dated }),
      doc({ expiresAt: null }),
      doc({ expiresAt: null }),
    ]);
    const before = await GameMatch.collection
      .find({})
      .sort({ _id: 1 })
      .toArray();

    const gate = new Date("2026-10-23T00:00:00Z");
    const modified = await backfillExpiry(GameMatch.collection, gate);
    expect(modified).toBe(2);

    const after = await GameMatch.collection
      .find({})
      .sort({ _id: 1 })
      .toArray();
    for (const [i, b] of before.entries()) {
      expect(after[i].updatedAt).toEqual(b.updatedAt);
      expect(after[i].expiresAt).toEqual(b.expiresAt ?? gate);
    }
    expect(
      after.filter((d) => d.expiresAt?.getTime() === dated.getTime()),
    ).toHaveLength(1);

    const secondRun = await backfillExpiry(GameMatch.collection, new Date());
    expect(secondRun).toBe(0);
  });
});
