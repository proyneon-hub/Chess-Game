import { searchMoves, type SearchInput } from "@/lib/ai/search";
import { chooseAfterRefusal } from "./restraint";
import { materializeView } from "./leadershipView";
self.onmessage = (
  event: MessageEvent<{ revision: number; input: SearchInput }>,
) => {
  const { revision, input } = event.data;
  try {
    const result = searchMoves(input);
    const view = input.own?.view;
    const choice = view?.pendingRefusal
      ? chooseAfterRefusal(materializeView(view), result.scores)
      : undefined;
    if (choice)
      result.moves = [
        choice.move,
        ...result.moves.filter(
          (m) => JSON.stringify(m) !== JSON.stringify(choice.move),
        ),
      ];
    self.postMessage({ revision, result });
  } catch {
    self.postMessage({ revision, error: "Search unavailable." });
  }
};
