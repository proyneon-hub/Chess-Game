# Measurements archive

The simulation campaigns under `docs/balance/`, `docs/progression/`,
`docs/readable-politics/` and `docs/v5-encounters/` produced about 110 MB of
machine-readable output. To keep clones and the working tree small, that output
was removed after commit `3c43599`. The Markdown reports, `summary.json`,
`acceptance.json`, `metadata.json` and freeze manifests stay in the tree.

Removed, and still in git history at `3c43599`:

| Files                                                       | Used by                                                   |
| ----------------------------------------------------------- | --------------------------------------------------------- |
| `raw.json`, `breakdown-corrected.json`                      | `verify-progression-reports.ts`, `verify-readable-reports.ts`, `freeze-readable.ts`, `correct-progression-breakdowns.ts` |
| `docs/v5-encounters/*/report.json`                          | `verify-encounter-reports.ts`                             |
| `seeded-games.json`, `docs/balance/baseline-2026-09-07.1.json` | `verify-progression-reports.ts` (v2 trajectory identity) |
| `docs/v5-encounters/*/sources.json.gz`, probe `<seed>-<pair>.json` | Provenance only                                   |

Markdown reports that link to these files point at paths that no longer exist
in the tree.

## Restoring

Restore a campaign (or one cohort directory) from history, then unstage it so
it stays out of the next commit. `.gitignore` keeps the restored files
untracked:

```sh
git checkout 3c43599 -- docs/progression
git restore --staged docs/progression
```

The audit scripts read these files through `scripts/archived.ts`, which names
the restore command when a file is missing. CI does not need the archive. The
one unit test that replayed archived data, `tests/unit/natural-v4.test.ts`, now
reads a trimmed copy in `tests/goldens/natural-replay-v4.json`.

New simulation runs write the same kinds of files. They are ignored by git.
