import { spawnSync } from "node:child_process";
import { configFor } from "../lib/rpg/config";
const version = process.argv[2];
if (!version || configFor(version)?.generation !== 4)
  throw Error("Supply a registered v4 config.");
const board = process.argv[3] === "board";
const jobs = board
  ? ([
      ["board-ordinary", 200, 120000],
      ["board-protective", 200, 121000],
      ["board-mistreatment", 200, 122000],
    ] as const)
  : ([
      ["ordinary", 200, 100000],
      ["pressure", 400, 110000],
    ] as const);
for (const [suite, games, seed] of jobs) {
  const run = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "scripts/simulate-balance.ts",
      "--config",
      version,
      "--suite",
      suite,
      "--games",
      String(games),
      "--seed-start",
      String(seed),
      "--out",
      `docs/readable-politics/${board ? "board" : "screen"}-${version}-${suite}`,
    ],
    { stdio: "inherit", windowsHide: true },
  );
  if (run.status !== 0) process.exit(run.status ?? 1);
}
