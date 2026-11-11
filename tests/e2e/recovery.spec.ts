import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import mongoose from "mongoose";
import { KINGS, boardFixture } from "../fixtures";
import type { GameState } from "@/lib/game/types";
async function joined(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Play online/ }).click();
  await expect(
    page.getByRole("button", { name: "Copy invite link" }),
  ).toBeVisible();
  const id = new URL(page.url()).searchParams.get("match")!;
  const context = await page.context().browser()!.newContext(),
    guest = await context.newPage();
  await guest.goto(page.url());
  await guest.getByRole("button", { name: "Join as Black" }).click();
  await expect(page.getByText("Waiting for an opponent to join.")).toHaveCount(
    0,
  );
  return { id, context, guest };
}
async function fixture(id: string, state: GameState) {
  const { uri } = JSON.parse(
    readFileSync(".test-services/mongodb.json", "utf8"),
  );
  const connection = await mongoose.createConnection(uri).asPromise();
  await connection
    .collection("gamematches")
    .updateOne({ inviteId: id }, { $set: { state }, $inc: { version: 1 } });
  await connection.close();
}
test("dropped move response retries the same intent exactly once", async ({
  page,
}) => {
  const { id, context } = await joined(page);
  let first = true;
  const bodies: string[] = [];
  await page.route(`**/api/matches/${id}`, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    bodies.push(route.request().postData()!);
    if (first) {
      first = false;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.locator('[data-square="e2"]').click();
  await page.locator('[data-square="e4"]').dblclick();
  await expect(
    page.getByRole("button", { name: "Retry connection" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry connection" }).click();
  await expect(
    page.getByRole("button", { name: "Retry connection" }),
  ).toHaveCount(0);
  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toBe(bodies[1]);
  const m = await (await page.request.get(`/api/matches/${id}`)).json();
  expect(m.state.moves).toHaveLength(1);
  expect(m.version).toBe(3);
  await context.close();
});
test("keyboard promotion works online and returns focus to the board", async ({
  page,
}) => {
  const { id, context } = await joined(page);
  const promotion = boardFixture([
    ["K", [7, 7]],
    ["k", [0, 7]],
    ["P", [1, 0]],
    ["r", [4, 4]],
  ]);
  await fixture(id, promotion);
  await page.reload();
  await page.locator('[data-square="a7"]').click();
  await page.locator('[data-square="a8"]').click();
  const select = page.getByLabel("Promote pawn to");
  await expect(select).toHaveValue("q");
  await select.selectOption("n");
  await page.getByRole("button", { name: "Promote", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-square="a8"]')).toHaveAttribute(
    "aria-label",
    /White knight/,
  );
  // Closing the dialog returns focus to the board.
  await expect(page.locator('[data-square="a8"]')).toBeFocused();
  await context.close();
});
test("leaving during an in-flight poll cannot restore the old match", async ({
  page,
}) => {
  const { id, context } = await joined(page);
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let observed: () => void = () => {};
  const started = new Promise<void>((resolve) => {
    observed = resolve;
  });
  await page.route(`**/api/matches/${id}`, async (route) => {
    if (route.request().method() === "GET") {
      const response = await route.fetch();
      observed();
      await held;
      await route.fulfill({ response }).catch(() => {});
    } else await route.continue();
  });
  await started;
  await page.getByRole("button", { name: "Leave", exact: true }).click();
  release();
  await page.waitForTimeout(400);
  await expect(page.getByRole("button", { name: /Play here/ })).toBeVisible();
  expect(page.url()).not.toContain("match=");
  await context.close();
});

test("both players see the same battle, dice and HP online", async ({
  page,
}) => {
  const { id, context, guest } = await joined(page);
  await fixture(id, boardFixture([...KINGS, ["N", [4, 4]], ["r", [2, 3]]]));
  await Promise.all([page.reload(), guest.reload()]);
  // The odds are worked out in the browser from the public stats alone.
  await page.locator('[data-square="e4"]').click();
  await expect(page.locator('[data-square="d6"]')).toHaveAttribute(
    "aria-label",
    /Black rook, legal destination, 7 of 7 HP, attack 6, defence 3, 3% to defeat/,
  );
  await page.locator('[data-square="d6"]').click();
  for (const client of [page, guest]) {
    const panel = client.getByRole("region", { name: "Battle" });
    await expect(panel).toContainText("White knight attacks Black rook on d6");
    await expect(panel).toContainText(
      /Defender (wounded|defeated)|Attack repelled/,
    );
    await expect(
      client.getByText("Black to Move", { exact: true }),
    ).toBeVisible();
  }
  const [a, b] = await Promise.all(
    [page, guest].map(
      async (client) =>
        (await (await client.request.get(`/api/matches/${id}`)).json()).state,
    ),
  );
  expect(a).toEqual(b);
  expect(a.battle).toMatchObject({ from: [4, 4], target: [2, 3] });
  expect(a.events).toHaveLength(1);
  expect(JSON.stringify(a)).not.toMatch(/rngState|pieceIds|configVersion/);
  // Whoever lost HP shows it on both boards.
  const hurt = { wounded: "d6", repelled: "e4" }[a.battle.outcome as string];
  if (hurt)
    for (const client of [page, guest])
      await expect(
        client.locator(`[data-square="${hurt}"] [data-hp]`),
      ).toBeVisible();
  await context.close();
});

test("unchanged polls answer 304 and a move still reaches the opponent", async ({
  page,
}) => {
  const { id, context, guest } = await joined(page);
  const unchanged = guest.waitForResponse(
    (r) =>
      r.url().endsWith(`/api/matches/${id}`) &&
      r.request().method() === "GET" &&
      r.status() === 304,
  );
  await unchanged;
  await page.locator('[data-square="e2"]').click();
  await page.locator('[data-square="e4"]').click();
  await expect(guest.getByText(/Black to Move/)).toBeVisible();
  await context.close();
});
