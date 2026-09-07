import { boardFixture, subjectAt } from "./fixtures";
import { remember } from "@/lib/rpg/subjects";
import { submitMove } from "@/lib/game";
import type { GameState } from "@/lib/game/types";
export function lateCourt() {
  const s = boardFixture(
      [
        ["K", [7, 4]],
        ["k", [0, 4]],
        ["B", [5, 3]],
        ["N", [5, 5]],
        ["R", [7, 0]],
        ["r", [0, 0]],
      ],
      40,
    ),
    k = s.simulation!.kingdoms.white;
  k.tyranny = 80;
  k.legitimacy = 25;
  const a = subjectAt(s, [5, 3]),
    b = subjectAt(s, [5, 5]);
  a.resentment = 90;
  a.loyalty = 20;
  a.ambition = 85;
  b.resentment = 80;
  b.loyalty = 30;
  remember(s, a, "coerced", a.id, 1, 12);
  return s;
}
export function courtTurn(
  s: GameState,
  side: "white" | "black",
  success = true,
) {
  const row = side === "white" ? 7 : 0,
    c = s.board[row][0]?.toLowerCase() === "r" ? 0 : 1;
  let draws = 0;
  return submitMove(
    s,
    { from: [row, c], to: [row, c === 0 ? 1 : 0], side },
    { draw: () => (draws++ === 0 ? 0.99 : success ? 0 : 0.99) },
  );
}
