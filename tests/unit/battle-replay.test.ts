import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { createGameState, movesFor, submitMove } from "@/lib/game";
import { publicState } from "@/lib/game/publicState";

// Refactoring safety net: seeded games played through the real reducer must
// produce exactly these boards, dice and HP. A deliberate rules change moves
// the pins; anything else that moves them changed behaviour by accident.
const PINS = { games: "8a101519adcc7dc6", publicView: "e70d92c0a558ef9d" };

/** The parts of a game that are the rules' output, in a fixed key order. */
const essence = (s: ReturnType<typeof createGameState>) => ({
  board: s.board,
  pieceIds: s.pieceIds,
  units: Object.keys(s.battle!.units)
    .sort()
    .map((id) => [id, s.battle!.units[id]]),
  last: s.battle!.last,
  rng: s.battle!.rngState,
  rights: s.rights,
  positions: Object.keys(s.positions)
    .sort()
    .map((k) => [k, s.positions[k]]),
  sideToMove: s.sideToMove,
  status: s.status,
  result: s.result,
  terminal: s.terminal,
  ply: s.ply,
  moves: s.moves,
  events: s.events.map((e) => [e.ply, e.message, e.square]),
});
const hash = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 16);

it("seeded Battle Chess games replay exactly", () => {
  const games = createHash("sha256"),
    views = createHash("sha256");
  for (let seed = 1; seed <= 12; seed++) {
    let s = createGameState(seed);
    for (let i = 0; i < 160 && s.status === "active"; i++) {
      const moves = movesFor(s);
      s = submitMove(s, moves[(i * 31 + seed * 7) % moves.length]).state;
      games.update(JSON.stringify(essence(s)));
    }
    const view = publicState(s);
    views.update(
      hash([view.board, view.units, view.battle, view.dice, view.result]),
    );
  }
  expect({
    games: games.digest("hex").slice(0, 16),
    publicView: views.digest("hex").slice(0, 16),
  }).toEqual(PINS);
});
