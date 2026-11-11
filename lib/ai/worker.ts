import { type BattleSearchInput, searchBattle } from "@/lib/battle/search";
self.onmessage = (
  event: MessageEvent<{ revision: number; input: BattleSearchInput }>,
) => {
  const { revision, input } = event.data;
  try {
    self.postMessage({ revision, result: searchBattle(input) });
  } catch {
    self.postMessage({ revision, error: "Search unavailable." });
  }
};
