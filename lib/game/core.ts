// Small state helpers shared by the game shell and the battle reducer.
import type { Side, Square } from "@/lib/chess";
import type { GameState, Terminal } from "@/lib/game/types";

export function finish(
  s: GameState,
  reason: Terminal["reason"],
  winner: Side | null,
) {
  s.terminal = { reason, winner, terminalPly: s.ply };
  s.status = "finished";
  s.result =
    reason === "king-defeated"
      ? `The ${winner === "white" ? "black" : "white"} king has fallen. ${winner === "white" ? "White" : "Black"} wins.`
      : reason === "stalemate"
        ? "Stalemate — draw."
        : `Draw — ${reason.replaceAll("-", " ")}.`;
}
/** Appends a line to the public event log. */
export function event(s: GameState, message: string, square?: Square) {
  s.events.push({
    seq: ++s.eventSeq,
    ply: s.ply,
    message,
    square: square ?? null,
  });
}
