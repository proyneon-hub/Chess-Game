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
  // A match with no schemaVersion at all: saved before schemaVersion existed
  // (the original D20 prototype), never migrated in place.
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
      collection.countDocuments({ schemaVersion: null }),
      collection
        .aggregate<{ _id: string | null; count: number }>([
          { $group: { _id: "$configVersion", count: { $sum: 1 } } },
        ])
        .toArray(),
      collection
        .aggregate<{ _id: number | null; count: number }>([
          { $group: { _id: "$schemaVersion", count: { $sum: 1 } } },
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
