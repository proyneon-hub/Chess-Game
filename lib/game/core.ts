// Small state helpers shared by the game reducer and the rules modules. Kept
// apart from lib/game.ts so rules modules do not import the reducer back.
import { type Side, sameSquare } from "@/lib/chess";
import type { GameState, Intention, Terminal } from "@/lib/game/types";
export const sameIntention = (a: Intention, b: Intention) =>
  sameSquare(a.from, b.from) &&
  sameSquare(a.to, b.to) &&
  a.promotion === b.promotion;
export function finish(
  s: GameState,
  reason: Terminal["reason"],
  winner: Side | null,
) {
  s.terminal = { reason, winner, terminalPly: s.ply };
  s.status = "finished";
  s.warning = null;
  s.result =
    reason === "regicide"
      ? `The king falls to his own court. ${winner === "white" ? "White" : "Black"} wins.`
      : reason === "checkmate"
        ? `Checkmate — ${winner === "white" ? "White" : "Black"} wins!`
        : reason === "stalemate"
          ? "Stalemate — draw."
          : `Draw — ${reason.replaceAll("-", " ")}.`;
}
