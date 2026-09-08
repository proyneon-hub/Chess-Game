import type { GameState, MoveAttempt } from "@/lib/game/types";
import { getAllLegalMoves, sameIntention, submitMove } from "@/lib/game";
import { rulesFor } from "@/lib/rpg/config";
import { politicalScore, ownPolitics } from "./politicalEvaluation";
import { evaluateBoard } from "@/lib/ai";
import { applyMove } from "@/lib/chess";
import { materializeView } from "./leadershipView";
export function refusalFallback(s: GameState): MoveAttempt | undefined {
  const moves = getAllLegalMoves(s.board, s.sideToMove, s.rights);
  if (s.schemaVersion === 3 && s.pendingRefusal)
    return moves.find((m) => !sameIntention(m, s.pendingRefusal!)) ?? moves[0];
  return s.pendingRefusal
    ? { ...s.pendingRefusal, side: s.sideToMove }
    : moves[0];
}
export type LeadershipChoice = {
  move: MoveAttempt;
  restraint: boolean;
  tacticalCost: number;
};
export function chooseAfterRefusal(
  s: GameState,
  scores?: { move: MoveAttempt; score: number }[],
): LeadershipChoice | undefined {
  if (!s.pendingRefusal) return undefined;
  const repeat = { ...s.pendingRefusal, side: s.sideToMove };
  if (s.schemaVersion !== 3)
    return { move: repeat, restraint: false, tacticalCost: 0 };
  const own = ownPolitics(s, s.sideToMove)!;
  const view = materializeView(own.view!),
    sign = s.sideToMove === "white" ? 1 : -1;
  const candidates = getAllLegalMoves(s.board, s.sideToMove, s.rights).map(
    (move) => {
      // All commands are guaranteed. The clone projection cannot consume real RNG.
      const projected = submitMove(view, move, { draw: () => 0.999999 });
      const chess =
        scores?.find((c) => sameIntention(c.move, move))?.score ??
        evaluateBoard(projected.state.board) * sign;
      const terminal = projected.state.terminal;
      const tactical =
        terminal?.winner === s.sideToMove
          ? 99000
          : terminal?.winner
            ? -99000
            : terminal
              ? 0
              : chess;
      const kingdom = projected.state.simulation!.kingdoms[s.sideToMove],
        old = view.simulation!.kingdoms[s.sideToMove];
      const refusedId =
        view.pieceIds[s.pendingRefusal!.from[0]][s.pendingRefusal!.from[1]]!;
      const sub = projected.state.simulation!.subjects[refusedId],
        previous = view.simulation!.subjects[refusedId];
      const leadership =
        (sub.loyalty - previous.loyalty) * 2 -
        (sub.resentment - previous.resentment) * 2 +
        (kingdom.legitimacy - old.legitimacy) -
        (kingdom.tyranny - old.tyranny);
      const court = politicalScore(s.board, projected.state.board, move, own);
      return {
        move,
        tactical,
        score: tactical + leadership + (Math.abs(court) > 100 ? court : 0),
        harm: sub.resentment - previous.resentment,
      };
    },
  );
  const repeated = candidates.find((c) => sameIntention(c.move, repeat));
  if (!repeated) return undefined;
  const alternative = candidates
    .filter((c) => !sameIntention(c.move, repeat))
    .sort((a, b) => b.score - a.score)[0];
  if (!alternative) return { move: repeat, restraint: false, tacticalCost: 0 };
  const cost = repeated.tactical - alternative.tactical;
  const forcedWin = repeated.tactical >= 98000 && alternative.tactical < 98000;
  const restraint =
    !forcedWin &&
    ((cost <= rulesFor(s).progression!.restraintCp &&
      alternative.harm < repeated.harm) ||
      alternative.score > repeated.score);
  return {
    move: restraint ? alternative.move : repeat,
    restraint,
    tacticalCost: restraint ? cost : 0,
  };
}
