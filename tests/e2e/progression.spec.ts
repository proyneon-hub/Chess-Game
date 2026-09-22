import { expect, test } from "@playwright/test";
test("Choose opponent clears old messages and cancels an outstanding computer turn", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Play computer/ }).click();
  await page.locator('[data-square="e2"]').click();
  await page.locator('[data-square="e4"]').click();
  await page
    .getByRole("button", { name: "Choose opponent", exact: true })
    .click();
  await page.getByRole("button", { name: "Discard game" }).click();
  await expect(
    page.getByText("Choose how you would like to play.", { exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(
    page.getByText("Choose how you would like to play.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Play here/ }).click();
  await expect(page.locator('[data-square="e2"]')).toHaveAttribute(
    "aria-label",
    /White pawn/,
  );
  await expect(page.getByText("No moves yet.")).toBeVisible();
});
test("worker construction failure still completes the computer turn", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.Worker = class {
      constructor() {
        throw Error("Test worker unavailable");
      }
    } as unknown as typeof Worker;
  });
  await page.goto("/");
  await page.getByRole("button", { name: /Play computer/ }).click();
  await page.locator('[data-square="e2"]').click();
  await page.locator('[data-square="e4"]').click();
  await expect(page.getByText("White to Move", { exact: true })).toBeVisible();
  await expect(page.getByText("No moves yet.")).toHaveCount(0);
});
