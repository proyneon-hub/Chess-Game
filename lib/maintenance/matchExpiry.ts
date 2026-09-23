import type { Collection, Document } from "mongodb";

// Checks the TTL index actually exists (not just that the field is declared
// in the schema): without it, backfilling expiresAt would silently do
// nothing, since nothing would ever delete the dated documents.
export async function hasTtlIndex(
  collection: Collection<Document>,
): Promise<boolean> {
  const indexes = await collection.indexes();
  return indexes.some(
    (idx) => idx.key?.expiresAt === 1 && idx.expireAfterSeconds === 0,
  );
}

export type MatchReport = {
  total: number;
  // {expiresAt: null} matches both a literally-null field and a missing one,
  // which covers every match saved before the field existed.
  missingExpiry: number;
  // A match whose saved state has no schemaVersion at all - the field
  // migrateState() (lib/game/migrate.ts) actually inspects to decide
  // whether a record is the original D20 prototype. Not the top-level
  // GameMatch.schemaVersion mirror: that field was added to the schema
  // after schemaVersion already existed inside state on v2+ matches, so an
  // old-but-valid v2-v5 match saved before the mirror existed would also
  // read null there without being legacy at all.
  legacy: number;
  byConfigVersion: Record<string, number>;
  bySchemaVersion: Record<string, number>;
};

export async function reportMatches(
  collection: Collection<Document>,
): Promise<MatchReport> {
  const [total, missingExpiry, legacy, configAgg, schemaAgg] =
    await Promise.all([
      collection.countDocuments({}),
      collection.countDocuments({ expiresAt: null }),
      collection.countDocuments({ "state.schemaVersion": null }),
      collection
        .aggregate<{ _id: string | null; count: number }>([
          { $group: { _id: "$state.configVersion", count: { $sum: 1 } } },
        ])
        .toArray(),
      collection
        .aggregate<{ _id: number | null; count: number }>([
          { $group: { _id: "$state.schemaVersion", count: { $sum: 1 } } },
        ])
        .toArray(),
    ]);
  return {
    total,
    missingExpiry,
    legacy,
    byConfigVersion: Object.fromEntries(
      configAgg.map((a) => [a._id ?? "(none)", a.count]),
    ),
    bySchemaVersion: Object.fromEntries(
      schemaAgg.map((a) => [String(a._id ?? "(none)"), a.count]),
    ),
  };
}

// Writes directly on the native collection (not through Mongoose) so
// updatedAt is left untouched. Only ever targets {expiresAt: null}, so an
// already-dated match's expiry is never extended by a later run - safe to
// re-run with a new date, and a second run always reports 0 modified.
export async function backfillExpiry(
  collection: Collection<Document>,
  expiresAt: Date,
): Promise<number> {
  const result = await collection.updateMany(
    { expiresAt: null },
    { $set: { expiresAt } },
  );
  return result.modifiedCount;
}
