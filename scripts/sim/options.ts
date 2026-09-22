import { existsSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { CONFIG, configFor } from "../../lib/rpg/config";

export const SUITES = [
  "ordinary",
  "pressure",
  "holdout",
  "development",
  "board-ordinary",
  "board-protective",
  "board-mistreatment",
];
const FLAGS = [
  "--config",
  "--games",
  "--seed-start",
  "--out",
  "--suite",
  "--trace-seed",
];

export type SimOptions = {
  version: string;
  suite: string;
  seedStart: number;
  games: number;
  output: string;
  traceSeed: number;
};

/** Parses and validates the simulation CLI; throws on anything invalid. */
export function parseOptions(
  argv: string[],
  env: NodeJS.ProcessEnv,
): SimOptions {
  const flags: Record<string, string> = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i],
      value = argv[i + 1];
    if (!FLAGS.includes(key) || value === undefined || flags[key] !== undefined)
      throw Error("Invalid or duplicate option: " + key);
    flags[key] = value;
  }
  const version = flags["--config"] ?? CONFIG.version,
    suite = flags["--suite"] ?? "ordinary",
    seedStart = Number(flags["--seed-start"] ?? 10000);
  if (
    !configFor(version) ||
    (suite === "pressure" && (configFor(version)?.generation ?? 0) < 3) ||
    !SUITES.includes(suite) ||
    !Number.isSafeInteger(seedStart) ||
    seedStart < 0 ||
    seedStart > 4294960000
  )
    throw Error("Invalid config, suite or seed.");
  const output = resolve(
      flags["--out"] ?? `docs/progression/${version}-${suite}-${seedStart}`,
    ),
    inside = relative(process.cwd(), output);
  if (
    !inside ||
    inside.startsWith("..") ||
    isAbsolute(inside) ||
    inside.split(/[\\/]/).some((x) => x.startsWith("."))
  )
    throw Error("Output must be a visible directory inside the repository.");
  if (existsSync(output))
    throw Error("Refusing to overwrite an existing report directory.");
  const games = Number(flags["--games"] ?? env.SIM_GAMES ?? 1000);
  if (!Number.isSafeInteger(games) || games < 2 || games > 10000 || games % 2)
    throw Error("Games must be an even integer from 2 to 10000.");
  return {
    version,
    suite,
    seedStart,
    games,
    output,
    traceSeed: Number(flags["--trace-seed"]),
  };
}
