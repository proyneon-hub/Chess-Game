import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import mongoose from "mongoose";
import { boardFixture } from "../fixtures";

// Automated WCAG 2.1 A/AA scans of each screen. Serious and critical
// violations fail; axe cannot judge everything, so keyboard and focus
// behavior keep their own tests.
async function scan(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${label}: ${v.id} (${v.nodes.length}) ${v.help}`);
  expect(blocking).toEqual([]);
}
const square = (page: Page, name: string) =>
  page.locator(`[data-square="${name}"]`);

test("menu, local game, and discard confirmation", async ({ page }) => {
  await page.goto("/");
  await scan(page, "menu");
  await page.getByRole("button", { name: /Play here/ }).click();
  await square(page, "e2").click();
  await scan(page, "local game with selection");
  await square(page, "e4").click();
  await page.getByRole("button", { name: "New Game", exact: true }).click();
  await scan(page, "discard confirmation");
});

test("online waiting screen and promotion dialog", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Play online/ }).click();
  await expect(
    page.getByRole("button", { name: "Copy invite link" }),
  ).toBeVisible();
  await scan(page, "online waiting");
  const id = new URL(page.url()).searchParams.get("match")!;
  const context = await page.context().browser()!.newContext(),
    guest = await context.newPage();
  await guest.goto(page.url());
  await guest.getByRole("button", { name: "Join as Black" }).click();
  await expect(page.getByText("Waiting for an opponent to join.")).toHaveCount(
    0,
  );
  const { uri } = JSON.parse(
    readFileSync(".test-services/mongodb.json", "utf8"),
  );
  const connection = await mongoose.createConnection(uri).asPromise();
  await connection.collection("gamematches").updateOne(
    { inviteId: id },
    {
      $set: {
        state: boardFixture(
          [
            ["K", [7, 7]],
            ["k", [0, 7]],
            ["P", [1, 0]],
          ],
          0,
        ),
      },
      $inc: { version: 1 },
    },
  );
  await connection.close();
  await page.reload();
  await square(page, "a7").click();
  await square(page, "a8").click();
  await expect(page.getByLabel("Promote pawn to")).toBeVisible();
  await scan(page, "promotion dialog");
  await context.close();
});
