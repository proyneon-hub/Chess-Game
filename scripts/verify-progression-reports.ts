import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG } from "../lib/rpg/config";
import type {
  CourtPlot,
  KingdomState,
  PressureEpisode,
  SubjectState,
} from "../lib/game/types";
type Report = {
  configVersion: string;
  rates: Record<string, [number, number]>;
  discovery: { wholeCohort: [number, number]; reached40: [number, number] };
  pressureGates: {
    gamesWithEligibility: [number, number];
    distinctDisputeSeeds: number;
    distinctPlotSeeds: number;
  };
  resolverMs: { p95: number };
  invalid: number;
  stalls: number;
  errors: number;
  openingAnomalies: number;
  privacyFailures: number;
  terminalViolations: number;
  duplicateMutations: number;
  results: {
    seed: number;
    maxStorage: Record<string, number>;
    rareEvents?: {
      kind: string;
      kingdoms: Record<"white" | "black", KingdomState>;
      plots: CourtPlot[];
      participants: { subject: SubjectState; episodes: PressureEpisode[] }[];
    }[];
  }[];
};
const checks: { name: string; passed: boolean; actual: unknown }[] = [];
const check = (name: string, passed: boolean, actual: unknown) =>
  checks.push({ name, passed, actual });
const rate = ([n, d]: [number, number]) => (d ? n / d : NaN);
for (const name of [
  "candidate-6-comparison",
  "pressure-6",
  "holdout-6",
  "holdout-pressure-6",
]) {
  const s: Report = JSON.parse(
    readFileSync(join("docs/progression", name, "raw.json"), "utf8"),
  );
  check(
    `${name}: selected rules`,
    s.configVersion === CONFIG.version,
    s.configVersion,
  );
  const failures =
    s.invalid +
    s.stalls +
    s.errors +
    s.openingAnomalies +
    s.privacyFailures +
    s.terminalViolations +
    s.duplicateMutations;
  check(`${name}: zero measured invariants`, failures === 0, failures);
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
  if (!name.includes("pressure")) {
    check(
      `${name}: ordinary refusal .5–2%`,
      rate(s.rates.refusal) >= 0.005 && rate(s.rates.refusal) <= 0.02,
      s.rates.refusal,
    );
    check(
      `${name}: calm refusal <=.8%`,
      rate(s.rates.calmRefusal) <= 0.008,
      s.rates.calmRefusal,
    );
    check(
      `${name}: discovery 25–60% among games reaching 40`,
      rate(s.discovery.reached40) >= 0.25 && rate(s.discovery.reached40) <= 0.6,
      s.discovery,
    );
    check(
      `${name}: retreats <=.5%`,
      rate(s.rates.retreat) <= 0.005,
      s.rates.retreat,
    );
    check(
      `${name}: regicide <=1%`,
      rate(s.rates.regicidePerMatch) <= 0.01,
      s.rates.regicidePerMatch,
    );
    check(
      `${name}: resolver p95 <=5ms`,
      s.resolverMs.p95 <= 5,
      s.resolverMs.p95,
    );
  } else {
    check(
      `${name}: court eligibility 5–20%`,
      rate(s.pressureGates.gamesWithEligibility) >= 0.05 &&
        rate(s.pressureGates.gamesWithEligibility) <= 0.2,
      s.pressureGates.gamesWithEligibility,
    );
    check(
      `${name}: disputes in multiple seeds`,
      s.pressureGates.distinctDisputeSeeds > 1,
      s.pressureGates.distinctDisputeSeeds,
    );
    check(
      `${name}: plots in multiple seeds`,
      s.pressureGates.distinctPlotSeeds > 1,
      s.pressureGates.distinctPlotSeeds,
    );
  }
  if (name === "holdout-pressure-6") {
    let verifiedPlots = 0,
      verifiedDisputes = 0;
    for (const game of s.results)
      for (const trace of game.rareEvents ?? []) {
        if (trace.kind === "plots") {
          const plot = trace.plots.find((p) => p.stage === "gathering")!;
          const histories = (id: string) =>
            trace.participants
              .find((p) => p.subject.id === id)!
              .episodes.filter(
                (e) =>
                  trace.kingdoms[plot.side].ownTurnsCompleted -
                    e.lastAppliedOwnTurn <
                    CONFIG.progression!.graveWindow &&
                  e.causes.some((c) =>
                    [
                      "coerced",
                      "neglected_under_threat",
                      "repeated_risky_order",
                    ].includes(c),
                  ),
              );
          const leader = histories(plot.ringleader),
            accomplice = histories(plot.accomplice);
          check(
            `seed ${game.seed}: natural plot grave histories`,
            new Set(leader.map((e) => e.id)).size >= 2 &&
              new Set(accomplice.map((e) => e.id)).size >= 1,
            {
              leader: leader.map((e) => e.id),
              accomplice: accomplice.map((e) => e.id),
            },
          );
          verifiedPlots++;
        } else if (trace.kind === "disputes") {
          const causal = trace.participants.some(
            (p) =>
              p.subject.grievance &&
              p.subject.memories.some((m) =>
                ["rival_friction", "promotion_envy"].includes(m.type),
              ),
          );
          check(
            `seed ${game.seed}: natural dispute has recorded cause`,
            causal,
            trace.participants.map((p) => p.subject.id),
          );
          verifiedDisputes++;
        }
      }
    check(
      "holdout causal traces present",
      verifiedPlots >= 5 && verifiedDisputes >= 20,
      { verifiedPlots, verifiedDisputes },
    );
  }
}
const archived = JSON.parse(
  readFileSync("docs/progression/baseline-committed/seeded-games.json", "utf8"),
);
const reproduced = JSON.parse(
  readFileSync(
    "docs/progression/baseline-post-refactor/seeded-games.json",
    "utf8",
  ),
);
check(
  "1000 historical v2 trajectories identical",
  reproduced.results.length === 1000 &&
    JSON.stringify(archived.results) === JSON.stringify(reproduced.results),
  reproduced.results.length,
);
writeFileSync(
  "docs/progression/acceptance.json",
  JSON.stringify(
    {
      config: CONFIG.version,
      scope:
        "Measured simulation gates and raw causal traces; test suites recorded separately",
      checks,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `${checks.filter((c) => c.passed).length}/${checks.length} measurement checks passed.`,
);
if (checks.some((c) => !c.passed)) process.exitCode = 1;
