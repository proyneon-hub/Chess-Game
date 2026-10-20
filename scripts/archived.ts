import { existsSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

// Bulky measurement data (raw.json, report.json, seeded-games.json, ...) was
// removed from the working tree after this commit. It remains in git history.
// See docs/measurements-archive.md.
export const ARCHIVE_COMMIT = "3c43599";

/** Reads an archived measurement file, explaining how to restore it if absent. */
export function readArchived(path: string) {
  if (!existsSync(path))
    throw Error(
      `Missing archived measurement file ${path}.\n` +
        `Restore it from git history with:\n` +
        `  git checkout ${ARCHIVE_COMMIT} -- ${dirname(path).replaceAll("\\", "/")}`,
    );
  return readFileSync(path, "utf8");
}
