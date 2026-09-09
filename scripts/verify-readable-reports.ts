import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { CONFIG } from "../lib/rpg/config";
type Report = {
  configVersion: string;
  games: number;
  seedStart: number;
  cap: number;
  suite: string;
  rates: Record<string, [number, number]>;
  discovery: { reached40: [number, number] };
  resolverMs: { p95: number };
  pressureGates: {
    gamesWithEligibility: [number, number];
    distinctDisputeSeeds: number;
    distinctPlotSeeds: number;
  };
  naturalGates: Record<string, { seeds: number[] }>;
  results: {
    seed: number;
    maxStorage: { episodes: number; memories: number; relationships: number };
    plotTransitions?: {
      stage: string;
      warningOwnTurns: number[];
      termination: string | null;
    }[];
  }[];
  invalid: number;
  stalls: number;
  errors: number;
  openingAnomalies: number;
  privacyFailures: number;
  terminalViolations: number;
  duplicateMutations: number;
};
const dir = "docs/readable-politics",
  checks: {
    name: string;
    passed: boolean;
    actual: unknown;
    category: string;
  }[] = [];
const check = (
  name: string,
  passed: boolean,
  actual: unknown,
  category = "correctness",
) => checks.push({ name, passed, actual, category });
const rate = ([n, d]: [number, number]) => (d ? n / d : NaN);
const freeze = JSON.parse(readFileSync(`${dir}/freeze.json`, "utf8")) as {
  config: unknown;
  sourceHashes: Record<string, string>;
};
check(
  "frozen config unchanged",
  JSON.stringify(freeze.config) === JSON.stringify(CONFIG),
  CONFIG.version,
);
for (const [file, hash] of Object.entries(freeze.sourceHashes))
  check(
    `frozen source: ${file}`,
    createHash("sha256")
      .update(readFileSync(file, "utf8").replaceAll("\r\n", "\n"))
      .digest("hex") === hash,
    hash,
  );
const measured = readdirSync(dir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);
let games = 0;
for (const name of measured) {
  const s: Report = JSON.parse(readFileSync(`${dir}/${name}/raw.json`, "utf8"));
  games += s.games;
  const failures =
    s.invalid +
    s.stalls +
    s.errors +
    s.openingAnomalies +
    s.privacyFailures +
    s.terminalViolations +
    s.duplicateMutations;
  check(
    `${name}: zero measured invariants`,
    failures === 0,
    failures,
    name === "board-2026-09-09.1-board-mistreatment"
      ? "superseded-measurement"
      : "correctness",
  );
  check(
    `${name}: complete paired cohort`,
    s.results.length === s.games &&
      s.games % 2 === 0 &&
      s.cap === 240 &&
      s.results.every((r, i) => r.seed === s.seedStart + Math.floor(i / 2)),
    { games: s.results.length, seedStart: s.seedStart, cap: s.cap },
  );
  check(
    `${name}: bounded storage`,
    s.results.every(
      (r) =>
        r.maxStorage.episodes <= 6 &&
        r.maxStorage.memories <= 12 &&
        r.maxStorage.relationships <= 4,
    ),
    { episodes: 6, memories: 12, relationships: 4 },
  );
}
const oldBoard = JSON.parse(
  readFileSync(`${dir}/board-2026-09-09.1-board-mistreatment/raw.json`, "utf8"),
);
const correctedBoard = JSON.parse(
  readFileSync(`${dir}/board-mistreatment-corrected/raw.json`, "utf8"),
);
check(
  "opening classifier correction preserves every board-policy game outcome",
  oldBoard.results.every(
    (
      r: { seed: number; plies: number; terminal: string; counters: unknown },
      i: number,
    ) => {
      const c = correctedBoard.results[i];
      return (
        r.seed === c.seed &&
        r.plies === c.plies &&
        r.terminal === c.terminal &&
        JSON.stringify(r.counters) === JSON.stringify(c.counters)
      );
    },
  ),
  {
    originalOpeningAnomalies: oldBoard.openingAnomalies,
    correctedOpeningAnomalies: correctedBoard.openingAnomalies,
  },
);
for (const name of [
  "v4-development-ordinary",
  "v4-development-pressure",
  "holdout-ordinary",
  "holdout-pressure",
]) {
  const s: Report = JSON.parse(readFileSync(`${dir}/${name}/raw.json`, "utf8"));
  check(
    `${name}: selected rules and cohort`,
    s.configVersion === CONFIG.version && s.games === 1000,
    { config: s.configVersion, games: s.games },
  );
  if (name.startsWith("holdout"))
    check(
      `${name}: independent declared seeds`,
      s.seedStart === (name.endsWith("pressure") ? 210000 : 200000),
      s.seedStart,
    );
  if (name.endsWith("ordinary")) {
    check(
      `${name}: refusal .5–2%`,
      rate(s.rates.refusal) >= 0.005 && rate(s.rates.refusal) <= 0.02,
      s.rates.refusal,
      "ordinary",
    );
    check(
      `${name}: calm refusal <=.8%`,
      rate(s.rates.calmRefusal) <= 0.008,
      s.rates.calmRefusal,
      "ordinary",
    );
    check(
      `${name}: discovery 25–60% among games reaching 40`,
      rate(s.discovery.reached40) >= 0.25 && rate(s.discovery.reached40) <= 0.6,
      s.discovery.reached40,
      "ordinary",
    );
    check(
      `${name}: retreat <=.5%`,
      rate(s.rates.retreat) <= 0.005,
      s.rates.retreat,
      "ordinary",
    );
    check(
      `${name}: regicide <=1%`,
      rate(s.rates.regicidePerMatch) <= 0.01,
      s.rates.regicidePerMatch,
      "ordinary",
    );
    check(
      `${name}: resolver p95 <=5ms`,
      s.resolverMs.p95 <= 5,
      s.resolverMs.p95,
      "ordinary",
    );
  } else {
    check(
      `${name}: court eligibility 5–20%`,
      rate(s.pressureGates.gamesWithEligibility) >= 0.05 &&
        rate(s.pressureGates.gamesWithEligibility) <= 0.2,
      s.pressureGates.gamesWithEligibility,
      "progression",
    );
    check(
      `${name}: multiple dispute seeds`,
      s.pressureGates.distinctDisputeSeeds > 1,
      s.pressureGates.distinctDisputeSeeds,
      "progression",
    );
    check(
      `${name}: multiple plot seeds`,
      s.pressureGates.distinctPlotSeeds > 1,
      s.pressureGates.distinctPlotSeeds,
      "progression",
    );
    for (const key of ["retreats", "disputeRelevantCommands", "armedAttempts"])
      check(
        `${name}: natural ${key} in >1 seed`,
        s.naturalGates[key].seeds.length > 1,
        s.naturalGates[key].seeds,
        "progression",
      );
    const attempts = s.results
      .flatMap((r) => r.plotTransitions ?? [])
      .filter((t) => t.stage === "resolved");
    check(
      `${name}: all observed attempts previously warned`,
      attempts.every(
        (t) =>
          t.warningOwnTurns.length === 3 &&
          t.warningOwnTurns[0] < t.warningOwnTurns[1] &&
          t.warningOwnTurns[1] < t.warningOwnTurns[2],
      ),
      { attempts: attempts.length },
    );
  }
}
const output = {
  measuredGames: games,
  checks,
  passed: checks.filter((c) => c.passed).length,
  failed: checks.filter((c) => !c.passed),
  unresolved: checks.filter(
    (c) => !c.passed && c.category !== "superseded-measurement",
  ),
  supersededMeasurementFailures: checks.filter(
    (c) => !c.passed && c.category === "superseded-measurement",
  ),
  humanPlaytest: "pending",
  deployment: "not performed",
};
writeFileSync(
  `${dir}/acceptance.json`,
  JSON.stringify(output, null, 2) + "\n",
  { flag: "wx" },
);
console.log(
  JSON.stringify(
    { games, passed: output.passed, failed: output.failed },
    null,
    2,
  ),
);
if (output.failed.length) process.exitCode = 2;
