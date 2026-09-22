import { test, expect, type Page } from "@playwright/test";
async function move(page: Page, from: string, to: string) {
  await page.locator(`[data-square="${from}"]`).click();
  await page.locator(`[data-square="${to}"]`).click();
  const repeat = page.getByRole("button", {
    name: "Repeat order",
    exact: true,
  });
  if (await repeat.isVisible()) await repeat.click();
}
async function opening(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Play here/ }).click();
  for (const [i, [from, to]] of [
    ["e2", "e4"],
    ["e7", "e5"],
    ["g1", "f3"],
    ["b8", "c6"],
    ["f1", "c4"],
    ["f8", "c5"],
    ["d2", "d3"],
    ["d7", "d6"],
    ["b1", "c3"],
    ["g8", "f6"],
  ].entries()) {
    await move(page, from, to);
    if (i < 8)
      await expect(
        page.getByRole("region", { name: "Piece requests" }),
      ).toHaveCount(0);
  }
  await expect(
    page.getByRole("region", { name: "Piece requests" }),
  ).toBeVisible();
}
test("normal-start request is visible, fulfilled through a legal move, and restored by undo", async ({
  page,
}) => {
  await opening(page);
  const region = page.getByRole("region", { name: "Piece requests" });
  const blackRequest = (await region.innerText()).includes("bishop at c8");
  const origin = blackRequest ? "c8" : "c1";
  await expect(region).toContainText(`bishop at ${origin}`);
  await expect(region).toContainText("3 response turns remaining");
  await page.screenshot({
    // The committed docs image is a release record; runs write test-results.
    path: "test-results/visible-request.png",
    fullPage: true,
  });
  if (blackRequest) await move(page, "a2", "a3");
  await move(page, origin, blackRequest ? "e6" : "e3");
  await expect(region).toContainText("renewed confidence");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(region).toContainText(`bishop at ${origin}`);
  await expect(region).toContainText("3 response turns remaining");
  await expect(page.locator(`[data-square="${origin}"]`)).toHaveAttribute(
    "aria-label",
    blackRequest ? /Black bishop/ : /White bishop/,
  );
});
test("a player can continue another plan and let a request expire neutrally on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await opening(page);
  for (const [from, to] of [
    ["a2", "a3"],
    ["a7", "a6"],
    ["h2", "h3"],
    ["h7", "h6"],
    ["a3", "a4"],
    ["a6", "a5"],
  ])
    await move(page, from, to);
  await expect(
    page.getByRole("region", { name: "Piece requests" }),
  ).toContainText("request passes without a response");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "New Game", exact: true }).click();
  await page.getByRole("button", { name: "Discard game" }).click();
  await expect(
    page.getByRole("region", { name: "Piece requests" }),
  ).toHaveCount(0);
});
