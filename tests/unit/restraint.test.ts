import { expect, it } from "vitest";
import { v3Fixture } from "../progression-fixtures";
import { subjectAt } from "../fixtures";
import {
  submitMove,
  getAllLegalMoves,
  sameIntention,
  createGameState,
} from "@/lib/game";
import { chooseAfterRefusal, refusalFallback } from "@/lib/ai/restraint";
import { ownPolitics } from "@/lib/ai/politicalEvaluation";
import { agencyForecast } from "@/lib/rpg/agency";
import { materializeView } from "@/lib/ai/leadershipView";
const refusal = () => {
  const s = v3Fixture([
    ["K", [7, 7]],
    ["k", [0, 7]],
    ["Q", [4, 3]],
    ["r", [0, 0]],
  ]);
  Object.assign(subjectAt(s, [4, 3]), { fear: 80, resentment: 70 });
  return submitMove(
    s,
    { from: [4, 3], to: [4, 0], side: "white" },
    { draw: () => 0 },
  ).state;
};
it("AI chooses restraint near tactical equality and coercion for a clearly superior continuation", () => {
  const s = refusal(),
    saved = structuredClone(s),
    moves = getAllLegalMoves(s.board, s.sideToMove, s.rights);
  const equal = moves.map((move) => ({ move, score: 0 }));
  const restraint = chooseAfterRefusal(s, equal)!;
  expect(restraint.restraint).toBe(true);
  expect(submitMove(s, restraint.move).turnConsumed).toBe(true);
  const winning = moves.map((move) => ({
    move,
    score: sameIntention(move, s.pendingRefusal!) ? 5000 : 0,
  }));
  expect(chooseAfterRefusal(s, winning)?.restraint).toBe(false);
  expect(s).toEqual(saved);
  expect(sameIntention(refusalFallback(s)!, s.pendingRefusal!)).toBe(false);
});
it("AI forecast uses only own politics with identical probabilities and no RNG consumption", () => {
  const s = refusal(),
    move = getAllLegalMoves(s.board, s.sideToMove, s.rights)[0],
    own = ownPolitics(s, "white")!;
  expect(agencyForecast(materializeView(own.view!), move)).toEqual(
    agencyForecast(s, move),
  );
  const before = JSON.stringify(own);
  s.simulation!.kingdoms.black.tyranny = 99;
  for (const sub of Object.values(s.simulation!.subjects).filter(
    (x) => x.side === "black",
  )) {
    sub.resentment = 99;
    sub.loyalty = 1;
  }
  s.simulation!.rngState.gameplay = 123;
  expect(JSON.stringify(ownPolitics(s, "white"))).toBe(before);
});
it("v2 keeps automatic repetition and valid fallback", () => {
  const s = createGameState(1, "2026-09-07.3");
  s.pendingRefusal = { from: [6, 4], to: [4, 4] };
  expect(chooseAfterRefusal(s)?.restraint).toBe(false);
  expect(refusalFallback(s)).toEqual({ ...s.pendingRefusal, side: "white" });
});
