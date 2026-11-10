import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { type Board, freshRights } from "@/lib/chess";
import { positionKey } from "@/lib/chessRules";
import { createGameState, submitMove } from "@/lib/game";
import type { GameState } from "@/lib/game/types";
import { initializePieceIds } from "@/lib/rpgChess";
import { initialUnits } from "@/lib/battle/resolve";

const square = (page: Page, name: string) =>
  page.locator(`[data-square="${name}"]`);
const move = async (page: Page, from: string, to: string) => {
  await square(page, from).click();
  await square(page, to).click();
};
const seedSave = (page: Page, game: GameState) =>
  page.addInitScript(
    (save) => {
      if (sessionStorage.getItem("seeded")) return;
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("chess:local-game:v1", save);
    },
    JSON.stringify({
      mode: "local",
      difficulty: "normal",
      game,
      history: { start: game, completed: [] },
    }),
  );

test("pieces show HP, a selection shows odds, and a battle shows its dice", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Play here/ }).click();
  await expect(square(page, "e2")).toHaveAttribute(
    "aria-label",
    /White pawn, 3 of 3 HP, attack 2, defence 1/,
  );
  const panel = page.getByRole("region", { name: "Battle" });
  await expect(
    panel.getByRole("meter", { name: "White king HP" }),
  ).toHaveAttribute("aria-valuenow", "14");
  await move(page, "e2", "e4");
  await move(page, "d7", "d5");
  await square(page, "e4").click();
  await expect(square(page, "d5")).toHaveAttribute(
    "aria-label",
    /Black pawn, legal destination, .*28% to defeat/,
  );
  await expect(panel).toContainText(
    "Black pawn on d5 (3 HP): 28% defeat, 44% wound, 28% repelled; 1–6 damage.",
  );
  await square(page, "d5").click();
  await expect(panel).toContainText("White pawn attacks Black pawn on d5");
  await expect(panel).toContainText(/Attack: rolled [1-6] \+ 2 = \d/);
  await expect(panel).toContainText(
    /Defender (defeated|wounded)|Attack repelled/,
  );
  await expect(page.getByText("Black to Move", { exact: true })).toBeVisible();
  await expect(page.getByText("Check!")).toHaveCount(0);
  // The battle changed someone's HP or removed a piece, and a reload keeps it.
  const saved = () =>
    page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("chess:local-game:v1")!).game.battle
          .units,
    );
  const before = await saved();
  expect(JSON.stringify(before)).not.toBe(
    JSON.stringify(createGameState(1).battle!.units),
  );
  await page.reload();
  await expect(page.getByText("Your game has been restored.")).toBeVisible();
  expect(await saved()).toEqual(before);
  await expect(panel).toContainText("White pawn attacks Black pawn on d5");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
});

test("defeating the king ends the game, on a phone-sized screen", async ({
  page,
}) => {
  // A queen beside a king on its last HP; pick a seed whose dice land.
  let game: GameState | undefined;
  for (let seed = 1; !game; seed++) {
    const s = createGameState(seed);
    s.board = Array.from({ length: 8 }, () => Array(8).fill(null)) as Board;
    s.board[7][4] = "K";
    s.board[0][4] = "k";
    s.board[1][4] = "Q";
    s.pieceIds = initializePieceIds(s.board);
    s.battle!.units = initialUnits(s.board, s.pieceIds);
    s.battle!.units[s.pieceIds[0][4]!].hp = 1;
    s.rights = freshRights(false);
    s.positions = { [positionKey(s.board, "white", s.rights)]: 1 };
    if (
      submitMove(s, { from: [1, 4], to: [0, 4], side: "white" }).state.terminal
    )
      game = s;
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await seedSave(page, game);
  await page.goto("/");
  await expect(page.getByText("Your game has been restored.")).toBeVisible();
  await expect(square(page, "e8")).toHaveAttribute(
    "aria-label",
    /Black king, 1 of 14 HP/,
  );
  await move(page, "e7", "e8");
  await expect(page.getByText("Game Over", { exact: true })).toBeVisible();
  await expect(page.getByRole("status").first()).toContainText(
    "The black king has fallen. White wins.",
  );
  await expect(page.getByRole("region", { name: "Battle" })).toContainText(
    "Defender defeated",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
