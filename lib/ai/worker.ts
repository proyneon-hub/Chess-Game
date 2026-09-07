import { searchMoves, type SearchInput } from "@/lib/ai/search";
self.onmessage = (
  event: MessageEvent<{ revision: number; input: SearchInput }>,
) => {
  const { revision, input } = event.data;
  try {
    self.postMessage({ revision, result: searchMoves(input) });
  } catch {
    self.postMessage({ revision, error: "Search unavailable." });
  }
};
