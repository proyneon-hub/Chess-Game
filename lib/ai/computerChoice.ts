import { searchMoves, type SearchInput, type SearchResult } from "./search";
import { chooseAfterRefusal } from "./restraint";
import { materializeView } from "./leadershipView";
import { sameSquare } from "@/lib/chess";
/**
 * The computer's ranked moves: a search, then (after its own piece refused)
 * the restraint choice between repeating the order and a safer alternative.
 */
export function computerChoice(input: SearchInput): SearchResult {
  const result = searchMoves(input);
  const view = input.own?.view;
  const choice = view?.pendingRefusal
    ? chooseAfterRefusal(materializeView(view), result.scores)
    : undefined;
  if (choice)
    result.moves = [
      choice.move,
      ...result.moves.filter(
        (m) =>
          !sameSquare(m.from, choice.move.from) ||
          !sameSquare(m.to, choice.move.to) ||
          (m.promotion ?? "q") !== (choice.move.promotion ?? "q"),
      ),
    ];
  return result;
}
