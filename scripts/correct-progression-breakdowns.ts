// Diagnostic correction only. Preserve every original raw report and trajectory.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const root = "docs/progression";
let corrected = 0;
for (const entry of readdirSync(root, { withFileTypes: true }).filter((e) =>
  e.isDirectory(),
)) {
  let report: {
    metricsVersion?: number;
    aggregate: Record<string, number>;
    breakdown: Record<string, Record<string, number>>;
  };
  try {
    report = JSON.parse(
      readFileSync(join(root, entry.name, "raw.json"), "utf8"),
    );
  } catch {
    continue;
  }
  if (![2, 3].includes(report.metricsVersion ?? 0)) continue;
  const breakdown = structuredClone(report.breakdown);
  for (const [group, counts] of Object.entries(breakdown)) {
    if (counts.attempts % 2) throw Error(`Non-even affected count in ${group}`);
    counts.attempts /= 2;
    const policy = group.split("/")[0];
    if (!["coercive", "pressure"].includes(policy)) {
      // In these policies every post-refusal command runs chooseAfterRefusal.
      counts.aiRestraint = counts.alternativeOrders ?? 0;
      counts.aiCoercion = counts.repeats ?? 0;
    }
  }
  for (const key of [
    "attempts",
    "eligibleCommands",
    "refusal",
    "aiRestraint",
    "aiCoercion",
  ]) {
    const sum = Object.values(breakdown).reduce((n, c) => n + (c[key] ?? 0), 0);
    if (sum !== (report.aggregate[key] ?? 0))
      throw Error(`${entry.name}: ${key} mismatch`);
  }
  writeFileSync(
    join(root, entry.name, "breakdown-corrected.json"),
    JSON.stringify(
      {
        source: "raw.json",
        sourceMetricsVersion: report.metricsVersion,
        correction:
          "Metrics v2/v3 counted attempted commands explicitly and through engine counter deltas. Divide only group attempts by two. Derive AI choice counts from accepted repeats/alternatives in policies that always use the AI leadership helper. Aggregate rates and gameplay are unchanged.",
        verifiedSums: [
          "attempts",
          "eligibleCommands",
          "refusal",
          "aiRestraint",
          "aiCoercion",
        ],
        breakdown,
      },
      null,
      2,
    ) + "\n",
  );
  corrected++;
}
console.log(
  `Wrote and reconciled ${corrected} corrected breakdowns; raw reports untouched.`,
);
