# V5 measurement data

Git tracks `metadata.json`, the Markdown reports, the freeze manifests, and the
traces and replay that [replay-walkthrough.md](replay-walkthrough.md) uses.

The cohort `report.json` files, the `sources.json.gz` manifests and the
pressure-probe seed dumps were removed from the working tree after commit
`3c43599` (see [the measurements archive note](../measurements-archive.md)).
`scripts/verify-encounter-reports.ts` needs the `report.json` files. Restore them
first:

```sh
git checkout 3c43599 -- docs/v5-encounters
git restore --staged docs/v5-encounters
```

Per-game traces (`<seed>-<pair>.json.gz`) and the other cooperative replay dumps
(about 160 MB, 12,754 files) were removed from the working tree after commit
`2b94021`. They remain in git history. To restore a cohort:

```sh
git checkout 2b94021 -- docs/v5-encounters/freeze7-holdout-aware
```

Restored files stay untracked because `.gitignore` excludes them. New runs of
`scripts/measure-encounters.ts` and `scripts/replay-encounter-arc.ts` write the
same kinds of files, which are ignored too.
