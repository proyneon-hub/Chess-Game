import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cpus, totalmem } from "node:os";
import { CONFIGS } from "../lib/rpg/config";
const root = "docs/progression";
const rows: string[] = [];
for (const entry of readdirSync(root, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .sort((a, b) => a.name.localeCompare(b.name))) {
  let s;
  try {
    s = JSON.parse(
      readFileSync(join(root, entry.name, "summary.json"), "utf8"),
    );
  } catch {
    continue;
  }
  const ratio = (pair: number[]) =>
    `${pair[0]}/${pair[1]} (${pair[1] ? ((pair[0] / pair[1]) * 100).toFixed(2) : "n/a"}%)`;
  rows.push(
    `| [${entry.name}](${entry.name}/summary.json) | ${s.configVersion} | ${s.seedStart} | ${s.games} | ${ratio(s.rates.refusal)} | ${ratio(s.discovery.reached40)} | ${ratio(s.pressureGates.gamesWithEligibility)} | ${s.pressureGates.distinctDisputeSeeds} / ${s.pressureGates.distinctPlotSeeds} | ${s.resolverMs.p95.toFixed(3)} | ${s.invalid + s.stalls + s.errors + s.openingAnomalies + s.privacyFailures + s.terminalViolations + s.duplicateMutations} |`,
  );
}
writeFileSync(
  join(root, "configurations.json"),
  JSON.stringify(CONFIGS, null, 2) + "\n",
);
writeFileSync(
  join(root, "measurement-index.md"),
  `# Measurement index\n\nReference host: ${cpus()[0].model}; ${cpus().length} logical CPUs; ${Math.round(totalmem() / 1024 ** 3)} GiB RAM; ${process.platform}/${process.arch}; Node ${process.version}. Some independent cohorts ran concurrently. Timings describe this environment.\n\n| Run | Config | First seed | Games | Refusals / eligible commands | Discovery / games reaching 40 | Eligible court / games | Distinct dispute / plot seeds | Resolver p95 ms | Invariant failures |\n|---|---|---:|---:|---|---|---|---:|---:|---:|\n${rows.join("\n")}\n\nEach seed has two color-swapped games. Development runs are tuning evidence, not holdouts. See each raw.json for full-cohort discovery, checkpoint censoring, first-event times, extrema, storage bounds and commanded policy/side/personality/phase counts. Counts absent from a counter dictionary are zero; a zero denominator means no opportunity was observed. Metrics v1 gate crossings use the initial candidate's thresholds; v2 and later include explicit selected thresholds and observed calm-command denominators. Metrics v3 also records causal participant snapshots when natural disputes/plots arise. Metrics v2/v3 group attempts were counted twice; use breakdown-corrected.json sidecars for reconciled group attempts and AI choices. Metrics v4 fixes the exporter. These diagnostic changes do not change choices or RNG.\n\nThe simulation's duplicateMutations field is a sampled deterministic resolver replay check. Actual HTTP/database receipt and concurrency behavior is verified separately by integration/browser tests. Private/public sizes sample final states; they are not worst-case network packet limits. No simulation is human playtesting.\n`,
);
console.log(`Indexed ${rows.length} cohorts.`);
