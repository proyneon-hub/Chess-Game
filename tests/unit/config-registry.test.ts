import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { CONFIGS } from "@/lib/rpg/config";

// Refactoring safety net for lib/rpg/config.ts: moving where a rule config's
// literal is defined (e.g. quarantining tuning-process leftovers into their
// own file) must never change any registered config's actual values, even
// ones no replay or golden exercises. Sorted keys make key order irrelevant.
const canonical = (v: unknown): string =>
  JSON.stringify(v, (_, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, x[k]]),
        )
      : x,
  );

const PINS = {
  count: 19,
  hash: "bb9a277784bdf5cf",
};

it("the registered config count and every value are unchanged", () => {
  const keys = Object.keys(CONFIGS).sort();
  const hash = createHash("sha256")
    .update(canonical(Object.fromEntries(keys.map((k) => [k, CONFIGS[k]]))))
    .digest("hex")
    .slice(0, 16);
  expect({ count: keys.length, hash }).toEqual(PINS);
});
