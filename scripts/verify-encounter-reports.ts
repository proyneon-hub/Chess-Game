import { readFileSync, writeFileSync } from "node:fs";
import { readArchived } from "./archived";
import { join } from "node:path";

const root = "docs/v5-encounters";
const freeze = JSON.parse(readFileSync(join(root, "freeze-7.json"), "utf8"));
const names = [
  "freeze7-development-aware",
  "freeze7-development-pressure",
  "freeze7-holdout-aware",
  "freeze7-holdout-pressure",
  "freeze7-board-ordinary",
  "freeze7-board-protective",
  "freeze7-board-mistreatment",
];
const gates: {
  cohort: string;
  metric: string;
  actual: number;
  requirement: string;
  pass: boolean;
}[] = [];
const summaries = names.map((name) => {
  const report = JSON.parse(readArchived(join(root, name, "report.json")));
  const metadata = JSON.parse(
    readFileSync(join(root, name, "metadata.json"), "utf8"),
  );
  for (const [path, hash] of Object.entries(freeze.sha256)) {
    if (!/\.(ts|tsx)$/.test(path)) continue;
    if (metadata.sourceHashes[path] !== hash)
      throw Error(`Source mismatch: ${name}: ${path}`);
  }
  if (report.measurementVersion !== 4 || report.records.length !== report.games)
    throw Error(`Incomplete or incompatible report: ${name}`);
  const gate = (
    metric: string,
    actual: number,
    requirement: string,
    pass: boolean,
  ) => gates.push({ cohort: name, metric, actual, requirement, pass });
  gate("invariant failures", report.failures, "0", report.failures === 0);
  gate(
    "discovery by 16",
    report.discovery16,
    ">= 0.90",
    report.discovery16 >= 0.9,
  );
  gate(
    "first offer",
    report.medianFirstOffer,
    "10–14",
    report.medianFirstOffer >= 10 && report.medianFirstOffer <= 14,
  );
  gate(
    "offers by 40",
    report.medianOffers40,
    "4–7",
    report.medianOffers40 >= 4 && report.medianOffers40 <= 7,
  );
  gate(
    "offers by 64",
    report.medianOffers64,
    "8–12",
    report.medianOffers64 >= 8 && report.medianOffers64 <= 12,
  );
  gate(
    "three families by 64",
    report.threeFamilies64,
    ">= 0.75",
    report.threeFamilies64 >= 0.75,
  );
  // Raw completed-ply gaps are conservative: check/cooldown intervals are not
  // removed. Preserve this distinction instead of relabeling a miss as passed.
  gate(
    "raw gap median",
    report.medianInterval,
    "4–6",
    report.medianInterval >= 4 && report.medianInterval <= 6,
  );
  gate("raw gap p90", report.p90Interval, "<= 10", report.p90Interval <= 10);
  gate(
    "refusal rate",
    report.refusalRate,
    "0.005–0.025",
    report.refusalRate >= 0.005 && report.refusalRate <= 0.025,
  );
  gate(
    "retreat rate",
    report.retreatRate,
    "<= 0.005",
    report.retreatRate <= 0.005,
  );
  if (report.policy === "aware") {
    gate(
      "mechanically resolved by 24",
      report.resolved24,
      ">= 0.75",
      report.resolved24 >= 0.75,
    );
    gate(
      "ordinary regicide rate",
      report.regicideRate,
      "<= 0.01",
      report.regicideRate <= 0.01,
    );
  }
  if (report.policy === "board-protective")
    gate(
      "supportive arc by 64",
      report.supportive64,
      ">= 0.75",
      report.supportive64 >= 0.75,
    );
  if (report.policy === "sustained-pressure") {
    gate(
      "conflict by 64",
      report.conflict64,
      ">= 0.50",
      report.conflict64 >= 0.5,
    );
    gate(
      "dispute relevance",
      report.disputeRelevance,
      ">= 0.60",
      report.disputeRelevance >= 0.6,
    );
    gate(
      "distinct warned retreat seeds",
      report.retreatSeeds.length,
      ">= 5",
      report.retreatSeeds.length >= 5,
    );
    gate(
      "distinct warned attempt seeds",
      report.attemptSeeds.length,
      ">= 3",
      report.attemptSeeds.length >= 3,
    );
  }
  const diagnosticTotals: Record<string, number> = {};
  for (const row of report.records)
    for (const [key, value] of Object.entries(row.diagnostics))
      diagnosticTotals[key] = (diagnosticTotals[key] ?? 0) + Number(value);
  const allGames = Object.fromEntries(
    [16, 24, 40, 64].map((ply) => [
      ply,
      {
        atRisk: report.atRisk[ply],
        endedBefore: report.games - report.atRisk[ply],
      },
    ]),
  );
  const { records, aggregate, ...summary } = report;
  return {
    name,
    ...summary,
    independentPairedSeeds: report.games / 2,
    checkpoints: allGames,
    diagnostics: diagnosticTotals,
    effects: Object.fromEntries(
      Object.entries(aggregate).filter(([key]) =>
        /encounter|modifier|complaint|plot|retreat|armedAttempts|regicide/.test(
          key,
        ),
      ),
    ),
  };
});
const result = {
  freeze: "freeze-7.json",
  classification:
    "normal-start cohorts; no cooperative or forced fixtures pooled",
  acceptancePassed: gates.every((g) => g.pass),
  humanTesting: "pending",
  publication: "not authorized or performed",
  summaries,
  gates,
};
writeFileSync(join(root, "acceptance.json"), JSON.stringify(result, null, 2), {
  flag: "wx",
});
const lines = [
  "# Frozen v5 measurement results",
  "",
  "These are actual normal-start measurements. A passed test suite does not imply product acceptance. See acceptance.json for every gate and denominator.",
  "",
  "| Cohort | Games / independent paired seeds | Discovery 16 | Mechanical resolution 24 | Offers 40 / 64 | Three families 64 | Conflict 64 | Retreat / attempt seeds | Truncated |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
];
for (const s of summaries)
  lines.push(
    `| ${s.name} | ${s.games} / ${s.independentPairedSeeds} | ${(100 * s.discovery16).toFixed(2)}% | ${(100 * s.resolved24).toFixed(2)}% | ${s.medianOffers40} / ${s.medianOffers64} | ${(100 * s.threeFamilies64).toFixed(2)}% | ${(100 * s.conflict64).toFixed(2)}% | ${s.retreatSeeds.length} / ${s.attemptSeeds.length} | ${s.truncated} |`,
  );
lines.push(
  "",
  "Resolution-at-24 acceptance applies to the aware policy. Checkpoint percentages use games reaching that checkpoint; acceptance.json also records all-game denominators and games ending earlier. Each color-swapped pair is one independent seed. Truncation at 240 plies is not a gameplay draw.",
  "",
  "Raw inter-start gaps include checks and cooldowns; eligible-only pacing remains a separate measurement limitation. Source hashes match freeze 7. Holdouts were not used to retune the candidate.",
  "",
  "## Unmet measured gates",
  "",
);
for (const g of gates.filter((g) => !g.pass))
  lines.push(
    `- ${g.cohort}: ${g.metric} = ${g.actual}; required ${g.requirement}.`,
  );
lines.push(
  "",
  "Human playtesting is pending. No commit, push, merge, deployment, or production verification was performed for v5.",
);
writeFileSync(join(root, "results.md"), lines.join("\n") + "\n", {
  flag: "wx",
});
console.log(
  JSON.stringify(
    {
      cohorts: summaries.length,
      acceptancePassed: result.acceptancePassed,
      failedGates: gates.filter((g) => !g.pass),
    },
    null,
    2,
  ),
);
if (!result.acceptancePassed) process.exitCode = 1;
