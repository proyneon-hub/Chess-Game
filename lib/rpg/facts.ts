import {
  applyMove,
  getLegalMoves,
  isInCheck,
  sameSquare,
  type Square,
} from "@/lib/chess";
import { captureSquare, material } from "@/lib/chessRules";
import type { GameState, MoveAttempt } from "@/lib/game/types";
import {
  attackMap,
  attackers,
  exchangeLoss,
  locations,
  opposite,
  distance,
} from "./context";
import { progression } from "./pressure";
import { rulesFor } from "./config";

export function assessOrder(
  s: GameState,
  m: MoveAttempt,
  board = applyMove(s.board, m.from, m.to, m.promotion, s.rights),
) {
  const map = attackMap(board),
    captured = captureSquare(s.board, m);
  const capturedValue = captured
    ? material[s.board[captured[0]][captured[1]]!.toLowerCase()]
    : 0;
  const risk = exchangeLoss(board, m.to, m.side, map),
    residual = Math.max(0, risk - capturedValue);
  const checkEscape = isInCheck(s.board, m.side === "white"),
    givesCheck = isInCheck(board, m.side !== "white");
  const promotion =
    s.board[m.from[0]][m.from[1]]?.toLowerCase() === "p" &&
    [0, 7].includes(m.to[0]);
  return {
    map,
    risk,
    residual,
    captured,
    capturedValue,
    exempt: checkEscape || givesCheck || promotion || capturedValue > risk,
    checkEscape,
    givesCheck,
  };
}
export function saferMove(s: GameState, from: Square, risk: number): boolean {
  return getLegalMoves(
    s.board,
    ...from,
    s.sideToMove === "white",
    s.rights,
  ).some((to) => {
    const m = { from, to, side: s.sideToMove },
      b = applyMove(s.board, from, to, undefined, s.rights);
    return exchangeLoss(b, to, s.sideToMove) <= risk - 100;
  });
}
export type PoliticalFact = {
  kind:
    | "exposure"
    | "repeat-risk"
    | "neglect"
    | "safe"
    | "protection"
    | "capture"
    | "promotion"
    | "coerced"
    | "restraint";
  subjectId: string;
  square: Square;
  sourceId: string;
  episodeId?: string;
  attackers?: string[];
  defenders?: string[];
  capturedId?: string;
  key?: string;
  /** V4 only: whether the actual board supports a physical exposure. */
  physical?: boolean;
  /** V4 only: an autonomous benefit does not earn leadership credit. */
  playerCredit?: boolean;
};
export function derivePoliticalFacts(
  before: GameState,
  after: GameState,
  command: MoveAttempt,
  context = assessOrder(before, command, after.board),
): PoliticalFact[] {
  const rules = rulesFor(before),
    cfg = rules.progression!,
    p = progression(before),
    sim = before.simulation!,
    own = sim.kingdoms[command.side].ownTurnsCompleted + 1;
  if (before.ply < rules.grace) return [];
  const facts: PoliticalFact[] = [],
    pos = locations(after),
    oldPos = locations(before),
    oldMap = attackMap(before.board),
    map = context.map;
  const id = before.pieceIds[command.from[0]][command.from[1]]!,
    mover = sim.subjects[id],
    q = p.subjects[id];
  const base = { subjectId: id, sourceId: id, square: command.to };
  if (before.pendingRefusal) {
    const pending = before.pendingRefusal,
      rid = before.pieceIds[pending.from[0]][pending.from[1]]!;
    const repeated =
      sameSquare(pending.from, command.from) &&
      sameSquare(pending.to, command.to) &&
      (pending.promotion ?? "q") === (command.promotion ?? "q");
    facts.push({
      ...base,
      subjectId: rid,
      kind: repeated ? "coerced" : "restraint",
      square: pos[rid],
    });
  }
  const open = q.episodes.find(
    (e) => e.cause === "avoidable_exposure" && e.closedOwnTurn === null,
  );
  if (
    mover.currentKind !== "k" &&
    !context.exempt &&
    context.residual >= 100 &&
    saferMove(before, command.from, context.risk)
  ) {
    if (!open && own - q.lastExposure >= cfg.episodeCooldown) {
      facts.push({
        ...base,
        kind: "exposure",
        attackers: attackers(map, command.to, opposite(command.side))
          .map(([r, c]) => after.pieceIds[r][c]!)
          .filter(Boolean)
          .sort(),
        defenders: attackers(map, command.to, command.side)
          .map(([r, c]) => after.pieceIds[r][c]!)
          .filter((x) => !!x && x !== id)
          .sort(),
      });
    }
    if (
      own - q.lastRepeated >= cfg.repeatCooldown &&
      q.episodes.some(
        (e) =>
          e.cause === "avoidable_exposure" &&
          own - e.openedOwnTurn < cfg.harmWindow,
      )
    )
      facts.push({ ...base, kind: "repeat-risk", episodeId: open?.id });
  }
  let neglected = 0;
  for (const ally of Object.values(sim.subjects)
    .filter(
      (x) =>
        x.side === command.side &&
        x.status === "active" &&
        x.currentKind !== "k",
    )
    .sort((a, b) => a.id.localeCompare(b.id))) {
    const sq = pos[ally.id];
    if (!sq) continue;
    const memory = p.subjects[ally.id],
      ep = memory.episodes.find(
        (e) => e.cause === "avoidable_exposure" && e.closedOwnTurn === null,
      );
    const oldSq = oldPos[ally.id],
      loss = exchangeLoss(after.board, sq, command.side, map),
      previous = exchangeLoss(before.board, oldSq, command.side, oldMap);
    if (ep && loss < 100 && previous < 100)
      facts.push({
        kind: "safe",
        subjectId: ally.id,
        sourceId: id,
        square: sq,
        episodeId: ep.id,
      });
    if (ally.id === id) continue;
    if (
      ep &&
      loss >= 100 &&
      !context.exempt &&
      own - memory.lastNeglect >= cfg.neglectCooldown &&
      neglected < cfg.neglectLimit &&
      saferMove(before, oldSq, previous)
    ) {
      facts.push({
        kind: "neglect",
        subjectId: ally.id,
        sourceId: id,
        square: sq,
        episodeId: ep.id,
      });
      neglected++;
    }
    const defNow = attackers(map, sq, command.side).some((x) =>
        sameSquare(x, command.to),
      ),
      defBefore = attackers(oldMap, oldSq, command.side).some((x) =>
        sameSquare(x, command.from),
      );
    const key = attackers(oldMap, oldSq, opposite(command.side))
      .map(([r, c]) => before.pieceIds[r][c])
      .sort()
      .join("|");
    if (
      previous >= 100 &&
      loss < previous &&
      defNow &&
      !defBefore &&
      own - memory.lastProtection >= rules.cooldown &&
      !ally.memories.some(
        (m) => m.type === "protection_episode" && m.source === key,
      ) &&
      (!ep || (!ep.rewarded && own - ep.openedOwnTurn >= rules.cooldown))
    )
      facts.push({
        kind: "protection",
        subjectId: ally.id,
        sourceId: id,
        square: sq,
        episodeId: ep?.id,
        key,
      });
  }
  if (context.captured) {
    const victim = before.pieceIds[context.captured[0]][context.captured[1]]!;
    facts.push({
      ...base,
      kind: "capture",
      capturedId: victim,
      square: context.captured,
    });
  }
  if (mover.currentKind !== after.simulation!.subjects[id].currentKind)
    facts.push({ ...base, kind: "promotion" });
  return facts;
}
