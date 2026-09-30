import type { SearchInput } from "@/lib/ai/search";
import { computerChoice } from "./computerChoice";
self.onmessage = (
  event: MessageEvent<{ revision: number; input: SearchInput }>,
) => {
  const { revision, input } = event.data;
  try {
    self.postMessage({ revision, result: computerChoice(input) });
  } catch {
    self.postMessage({ revision, error: "Search unavailable." });
  }
};
