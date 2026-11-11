import { describe, expect, it } from "vitest";
import { type Square, freshRights } from "@/lib/chess";
import { createGameState, movesFor, submitMove } from "@/lib/game";
import { publicState } from "@/lib/game/publicState";
import { recordTurn, undoTurn } from "@/lib/game/undo";
import { validateState } from "@/lib/game/validation";
import { BATTLE_CONFIG, DEFAULT_CONFIG } from "@/lib/battle/config";
import { unitGrid } from "@/lib/battle/resolve";
import { searchBattle } from "@/lib/battle/search";
import { BATTLE_RULES, freshUnit, odds } from "@/lib/battle/stats";
import { KINGS, boardFixture as fixture, rolls, unitAt } from "../fixtures";
import { statusText } from "@/components/chess/statusText";

describe("battle odds", () => {
  it("cover every roll and match the table by hand", () => {
    const pawn = freshUnit("p"),
      rook = freshUnit("r");
    const o = odds(pawn, pawn);
    expect(o.defeat + o.wound + o.repel).toBeCloseTo(1);
    // Pawn on pawn: the attacker is two ahead before the dice, ties go to
    // the defender, and any hit deals at least a pawn's 3 HP.
    expect(o.defeat).toBeCloseTo(26 / 36);
    expect(o.wound).toBe(0);
    expect(o.repel).toBeCloseTo(10 / 36);
    expect(o.fall).toBe(0);
    expect(odds({ ...pawn, hp: 1 }, rook).fall).toBeCloseTo(
      odds(pawn, rook).repel,
    );
    expect(odds(freshUnit("q"), pawn).defeat).toBeGreaterThan(0.8);
  });
});

describe("battle resolution", () => {
  it("new games are Battle Chess with visible units and no politics", () => {
    const s = createGameState(7);
    expect(DEFAULT_CONFIG).toBe(BATTLE_CONFIG);
    expect([s.schemaVersion, s.rulesetVersion]).toEqual([7, "battle-v1"]);
    expect(Object.keys(s.battle.units)).toHaveLength(32);
    expect(() => validateState(structuredClone(s))).not.toThrow();
  });

  it("an equal total is repelled", () => {
    const s = fixture([...KINGS, ["N", [4, 4]], ["r", [2, 3]]]);
    const r = submitMove(
      s,
      { from: [4, 4], to: [2, 3], side: "white" },
      { draw: rolls(1, 3) },
    );
    expect(r.state.battle.last).toMatchObject({
      outcome: "repelled",
      attackTotal: 6,
      defenceTotal: 6,
    });
    expect(unitAt(r.state, [4, 4]).hp).toBe(4);
  });

  it("a defeated defender is removed and the attacker takes the square", () => {
    const s = fixture([...KINGS, ["N", [4, 4]], ["p", [2, 3]]]);
    const r = submitMove(
      s,
      { from: [4, 4], to: [2, 3], side: "white" },
      { draw: rolls(6, 1) },
    );
    expect([r.requestAccepted, r.turnConsumed, r.boardChanged]).toEqual([
      true,
      true,
      true,
    ]);
    expect(r.state.board[2][3]).toBe("N");
    expect(r.state.board[4][4]).toBeNull();
    expect(Object.keys(r.state.battle.units)).toHaveLength(3);
    expect(r.state.battle.last).toMatchObject({
      outcome: "defeated",
      attackTotal: 11,
      defenceTotal: 2,
      damage: 9,
      defenderHp: 0,
    });
    expect(r.state.sideToMove).toBe("black");
    expect(r.message).toContain("defeats the black pawn on d6");
    expect(() => validateState(structuredClone(r.state))).not.toThrow();
  });

  it("a wounded defender holds its square and keeps the damage", () => {
    const s = fixture([...KINGS, ["N", [4, 4]], ["r", [2, 3]]]);
    const r = submitMove(
      s,
      { from: [4, 4], to: [2, 3], side: "white" },
      { draw: rolls(1, 1) },
    );
    expect(r.state.board[4][4]).toBe("N");
    expect(r.state.board[2][3]).toBe("r");
    // 1+5 against 1+3 is a difference of 2, raised to the minimum of 3.
    expect(unitAt(r.state, [2, 3]).hp).toBe(4);
    expect(r.state.battle.last!.outcome).toBe("wounded");
    expect([r.turnConsumed, r.state.sideToMove, r.state.ply]).toEqual([
      true,
      "black",
      s.ply + 1,
    ]);
    // Damage persists into the next battle.
    const again = submitMove(
      { ...r.state, sideToMove: "white" },
      { from: [4, 4], to: [2, 3], side: "white" },
      { draw: rolls(6, 1) },
    );
    expect(again.state.board[2][3]).toBe("N");
  });

  it("a repelled attacker loses HP, and falls at zero", () => {
    const s = fixture([...KINGS, ["P", [3, 3]], ["r", [2, 4]]]);
    const move = {
      from: [3, 3] as Square,
      to: [2, 4] as Square,
      side: "white" as const,
    };
    const r = submitMove(s, move, { draw: rolls(1, 6) });
    expect(r.state.battle.last!.outcome).toBe("repelled");
    expect(unitAt(r.state, [3, 3]).hp).toBe(2);
    expect(unitAt(r.state, [2, 4]).hp).toBe(7);
    expect(r.state.board[3][3]).toBe("P");
    unitAt(s, [3, 3]).hp = 1;
    const fell = submitMove(s, move, { draw: rolls(1, 6) });
    expect(fell.state.battle.last!.outcome).toBe("fell");
    expect(fell.state.board[3][3]).toBeNull();
    expect(fell.state.pieceIds[3][3]).toBeNull();
    expect(() => validateState(structuredClone(fell.state))).not.toThrow();
  });

  it("defeating the king ends the game", () => {
    const s = fixture([...KINGS, ["Q", [1, 4]]]);
    unitAt(s, [0, 4]).hp = 1;
    const r = submitMove(
      s,
      { from: [1, 4], to: [0, 4], side: "white" },
      { draw: rolls(3, 3) },
    );
    expect(r.state.terminal).toMatchObject({
      reason: "king-defeated",
      winner: "white",
    });
    expect(r.state.result).toBe("The black king has fallen. White wins.");
    expect(r.resolution).toBe("terminal");
    expect(r.state.board.flat().includes("k")).toBe(false);
    expect(() => validateState(structuredClone(r.state))).not.toThrow();
    expect(
      submitMove(r.state, { from: [0, 4], to: [0, 3], side: "black" })
        .requestAccepted,
    ).toBe(false);
  });

  it("a king that attacks at 1 HP and is repelled loses the game", () => {
    const s = fixture([...KINGS, ["r", [6, 4]]]);
    unitAt(s, [7, 4]).hp = 1;
    const r = submitMove(
      s,
      { from: [7, 4], to: [6, 4], side: "white" },
      { draw: rolls(1, 6) },
    );
    expect(r.state.terminal).toMatchObject({
      reason: "king-defeated",
      winner: "black",
    });
  });

  it("has no check: kings walk into attack and pinned pieces move", () => {
    const s = fixture([...KINGS, ["r", [0, 3]], ["R", [6, 4]], ["q", [3, 4]]]);
    // d1 is covered by the rook on d8; the e2 rook is pinned to the king.
    expect(
      submitMove(s, { from: [7, 4], to: [7, 3], side: "white" })
        .requestAccepted,
    ).toBe(true);
    expect(
      submitMove(s, { from: [6, 4], to: [6, 0], side: "white" })
        .requestAccepted,
    ).toBe(true);
    const view = publicState(s);
    expect(
      statusText({
        game: view,
        kind: "local",
        online: { error: "", remote: null, busy: false },
        computerThinking: false,
        message: "Your move.",
      }),
    ).toBe("Your move.");
  });

  it("castles even while the king is attacked", () => {
    const s = fixture([...KINGS, ["R", [7, 7]], ["r", [3, 4]]]);
    s.rights = freshRights(true);
    const r = submitMove(s, { from: [7, 4], to: [7, 6], side: "white" });
    expect([r.state.board[7][6], r.state.board[7][5]]).toEqual(["K", "R"]);
    expect(unitAt(r.state, [7, 5]).maxHp).toBe(BATTLE_RULES.stats.r.hp);
    expect(r.state.rights.castling.white).toEqual({
      king: false,
      queen: false,
    });
  });

  it("en passant is a battle against the pawn", () => {
    const s = fixture([...KINGS, ["P", [3, 4]], ["p", [3, 3]]]);
    s.rights.enPassant = [2, 3];
    const move = {
      from: [3, 4] as Square,
      to: [2, 3] as Square,
      side: "white" as const,
    };
    const held = submitMove(s, move, { draw: rolls(1, 6) });
    expect([held.state.board[3][4], held.state.board[3][3]]).toEqual([
      "P",
      "p",
    ]);
    const won = submitMove(s, move, { draw: rolls(6, 1) });
    expect([
      won.state.board[2][3],
      won.state.board[3][3],
      won.state.board[3][4],
    ]).toEqual(["P", null, null]);
  });

  it("a promoted pawn becomes a full-strength piece", () => {
    const s = fixture([...KINGS, ["P", [1, 0]]]);
    unitAt(s, [1, 0]).hp = 1;
    const r = submitMove(s, {
      from: [1, 0],
      to: [0, 0],
      side: "white",
      promotion: "r",
    });
    expect(r.state.board[0][0]).toBe("R");
    expect(unitAt(r.state, [0, 0])).toEqual(freshUnit("r"));
  });

  it("a battle resets the draw clocks", () => {
    const s = fixture([...KINGS, ["N", [4, 4]], ["r", [2, 3]]]);
    s.rights.halfmove = 80;
    s.positions = { stale: 2 };
    const r = submitMove(
      s,
      { from: [4, 4], to: [2, 3], side: "white" },
      { draw: rolls(1, 1) },
    );
    expect(r.state.rights.halfmove).toBe(0);
    expect(Object.keys(r.state.positions)).toHaveLength(1);
  });

  it("rejects moves that are not available", () => {
    const s = createGameState(3);
    for (const [from, to] of [
      [
        [6, 4],
        [3, 4],
      ],
      [
        [7, 0],
        [5, 0],
      ],
      [
        [1, 4],
        [2, 4],
      ],
    ] as [Square, Square][])
      expect(submitMove(s, { from, to, side: "white" }).requestAccepted).toBe(
        false,
      );
  });
});

describe("battle state outside the reducer", () => {
  it("public state shows stats and dice but no ids or RNG", () => {
    const s = fixture([...KINGS, ["N", [4, 4]], ["r", [2, 3]]]);
    const r = submitMove(
      s,
      { from: [4, 4], to: [2, 3], side: "white" },
      { draw: rolls(2, 1) },
    );
    const view = publicState(r.state);
    expect(view.units![2][3]).toEqual({
      hp: 4,
      maxHp: 7,
      attack: 6,
      defence: 3,
    });
    expect(view.dice).toEqual({
      die: 6,
      repel: 1,
      minDamage: 3,
      defenderWinsTies: true,
    });
    expect(view.battle).toMatchObject({ attackRoll: 2, defenceRoll: 1 });
    const json = JSON.stringify(view);
    for (const hidden of ["pieceIds", "rngState", "gameplay", "white_knight"])
      expect(json).not.toContain(hidden);
  });

  it("is deterministic per seed, and undo cannot re-roll a battle", () => {
    const play = (seed: number) => {
      let s = createGameState(seed);
      const states = [s];
      for (let i = 0; i < 60 && s.status === "active"; i++) {
        const moves = movesFor(s);
        s = submitMove(s, moves[(i * 7 + seed) % moves.length]).state;
        states.push(s);
      }
      return states;
    };
    expect(JSON.stringify(play(11))).toBe(JSON.stringify(play(11)));
    expect(JSON.stringify(play(11).at(-1))).not.toBe(
      JSON.stringify(play(12).at(-1)),
    );
    const s = fixture([...KINGS, ["N", [4, 4]], ["r", [2, 3]]]);
    const move = {
      from: [4, 4] as Square,
      to: [2, 3] as Square,
      side: "white" as const,
    };
    const first = submitMove(s, move);
    const history = recordTurn({ start: s, completed: [] }, first);
    const undone = undoTurn(history, first.state);
    expect(undone.game).toBe(s);
    expect(submitMove(undone.game, move).state.battle.last).toEqual(
      first.state.battle.last,
    );
  });

  it("rejects tampered saved units", () => {
    const s = createGameState(5);
    for (const tamper of [
      (x: typeof s) => (Object.values(x.battle.units)[0].hp = 99),
      (x: typeof s) => delete x.battle.units[Object.keys(x.battle.units)[0]],
      (x: typeof s) => ((x as { battle?: unknown }).battle = undefined),
      (x: typeof s) => ((x as { schemaVersion: number }).schemaVersion = 6),
      (x: typeof s) => (x.configVersion = "2026-09-23.1"),
      (x: typeof s) => (x.board[7][4] = null),
    ]) {
      const copy = structuredClone(s);
      tamper(copy);
      expect(() => validateState(copy)).toThrow();
    }
  });
});

describe("battle search", () => {
  const search = (s: ReturnType<typeof fixture>, depth = 2) =>
    searchBattle({
      rules: "battle",
      board: s.board,
      rights: s.rights,
      side: s.sideToMove,
      units: unitGrid(s),
      depth,
      budgetMs: 2000,
    });
  it("strikes a king it can defeat", () => {
    const s = fixture([...KINGS, ["Q", [1, 3]], ["p", [4, 0]]]);
    unitAt(s, [0, 4]).hp = 1;
    expect(search(s).moves[0]).toMatchObject({ from: [1, 3], to: [0, 4] });
  });
  it("picks the more valuable of two attacks", () => {
    const s = fixture([...KINGS, ["N", [4, 4]], ["p", [2, 3]], ["q", [2, 5]]]);
    // A queen on its last HP is worth far more than a fresh pawn.
    unitAt(s, [2, 5]).hp = 1;
    expect(search(s).moves[0]).toMatchObject({ from: [4, 4], to: [2, 5] });
  });
  it("returns only available moves from the start position", () => {
    const s = createGameState(9);
    const result = search(s, 1);
    expect(result.completedDepth).toBe(1);
    expect(result.moves).toHaveLength(20);
    expect(submitMove(s, result.moves[0]).requestAccepted).toBe(true);
  });
});
