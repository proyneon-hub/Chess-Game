import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createGameState, submitMove } from "../lib/game";
import { validateState } from "../lib/game/validation";

const path = process.argv[2];
if (!path)
  throw Error(
    "Usage: npx tsx scripts/replay-encounter-trace.ts <normal-start trace.json.gz>",
  );
const { record, trace } = JSON.parse(
  gunzipSync(readFileSync(path)).toString("utf8"),
);
let state = createGameState(record.seed);
const observed: { ply: number; text: string }[] = [];
for (const step of trace) {
  const result = submitMove(state, step.move);
  if (
    !result.accepted ||
    result.resolution !== step.resolution ||
    result.state.revision !== step.revision
  )
    throw Error(
      `Replay diverged at revision ${step.revision}; use the report's frozen source.`,
    );
  const events = result.state.events.filter((e) => e.seq > state.eventSeq);
  if (JSON.stringify(events) !== JSON.stringify(step.events))
    throw Error(`Public history diverged at revision ${step.revision}`);
  state = result.state;
  validateState(state);
  for (const event of events)
    if (
      /encounter|complaint|plot|retreat/i.test(
        state.simulation!.privateEvents.find((e) => e.seq === event.seq)
          ?.code ?? "",
      )
    )
      observed.push({ ply: state.ply, text: event.message });
}
console.log(
  JSON.stringify(
    {
      seed: record.seed,
      pair: record.pair,
      plies: state.ply,
      classification:
        "deterministic replay of a recorded normal-start policy game; no forced rolls or preloaded politics",
      verifiedActions: trace.length,
      observed,
      counters: state.simulation!.counters,
    },
    null,
    2,
  ),
);
