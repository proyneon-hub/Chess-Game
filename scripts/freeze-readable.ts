import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { readArchived } from "./archived";
import { createHash } from "node:crypto";
import { CONFIG, READABLE_CANDIDATES } from "../lib/rpg/config";
const dir = "docs/readable-politics";
const screens = READABLE_CANDIDATES.map((c) => {
  const s = JSON.parse(
    readArchived(`${dir}/screen-${c.version}-pressure/raw.json`),
  );
  return {
    version: c.version,
    passing: ["retreats", "disputeRelevantCommands", "armedAttempts"].every(
      (k) => s.naturalGates[k].seeds.length > 1,
    ),
  };
});
if (screens.some((s) => s.passing))
  throw Error(
    "A candidate passed screening; complete its development comparison before freezing.",
  );
const files = [
  ...["lib", "hooks"].flatMap((d) =>
    readdirSync(d, { recursive: true })
      .filter((f) => String(f).endsWith(".ts"))
      .map((f) => `${d}/${String(f).replaceAll("\\", "/")}`),
  ),
  "scripts/simulate-balance.ts",
  "scripts/political-diagnostics.ts",
  "scripts/board-policies.ts",
  "scripts/progression-policies.ts",
];
const sourceHashes = Object.fromEntries(
  files
    .sort()
    .map((file) => [
      file,
      createHash("sha256")
        .update(readFileSync(file, "utf8").replaceAll("\r\n", "\n"))
        .digest("hex"),
    ]),
);
writeFileSync(
  `${dir}/freeze.json`,
  JSON.stringify(
    {
      frozenAt: new Date().toISOString(),
      config: CONFIG,
      reason:
        "No bounded candidate passed the declared natural progression screen; retain the corrected baseline as authorized.",
      screens,
      sourceHashes,
      holdout: {
        ordinary: { games: 1000, seedStart: 200000 },
        pressure: { games: 1000, seedStart: 210000 },
      },
      humanPlaytest: "pending",
      deployed: false,
    },
    null,
    2,
  ) + "\n",
  { flag: "wx" },
);
console.log(`Frozen ${CONFIG.version} before independent holdout.`);
