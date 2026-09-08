import type { GameState } from "@/lib/game/types";
import type { Square } from "@/lib/chess";
import { rulesFor } from "@/lib/rpg/config";
export function event(
  s: GameState,
  code: string,
  message: string,
  options: {
    square?: Square;
    intended?: Square;
    actual?: Square;
    special?: boolean;
    subjectId?: string;
    details?: Record<string, number | string | boolean>;
  } = {},
) {
  const seq = ++s.eventSeq;
  s.events.push({
    seq,
    ply: s.ply,
    message,
    square: options.square ?? null,
    intended: options.intended ?? null,
    actual: options.actual ?? null,
    special: options.special ?? false,
  });
  if (s.simulation) {
    s.simulation.privateEvents.push({
      seq,
      code,
      ...(options.subjectId ? { subjectId: options.subjectId } : {}),
      details: options.details ?? {},
    });
    s.simulation.privateEvents = s.simulation.privateEvents.slice(
      -rulesFor(s).privateEventLimit,
    );
    count(s, code);
  }
  return seq;
}
export function count(s: GameState, key: string, n = 1) {
  if (s.simulation)
    s.simulation.counters[key] = (s.simulation.counters[key] ?? 0) + n;
}
