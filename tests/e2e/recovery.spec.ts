import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import mongoose from "mongoose";
import { boardFixture } from "../fixtures";
import { lateCourt, courtTurn } from "../scenarios";
import type { GameState } from "@/lib/game/types";
import {
  constructedV3Court,
  v3Fixture,
  constructedV4Court,
  v4Fixture,
} from "../progression-fixtures";
import { submitMove } from "@/lib/game";
import { scheduleCourt } from "@/lib/rpg/conspiracy";
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
  // The browser's own network error text is never shown.
  await expect(
    page.getByText("Connection interrupted. Retry the same move."),
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
test("a gateway error page offers a retry with a readable message", async ({
  page,
}) => {
  const { id, context } = await joined(page);
  let first = true;
  await page.route(`**/api/matches/${id}`, async (route) => {
    if (route.request().method() === "POST" && first) {
      first = false;
      await route.fulfill({
        status: 502,
        contentType: "text/html",
        body: "<!DOCTYPE html><title>Bad gateway</title>",
      });
    } else await route.continue();
  });
  await page.locator('[data-square="e2"]').click();
  await page.locator('[data-square="e4"]').dblclick();
  await expect(
    page.getByText("Connection interrupted. Retry the same move."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry connection" }).click();
  await expect(
    page.getByRole("button", { name: "Retry connection" }),
  ).toHaveCount(0);
  const m = await (await page.request.get(`/api/matches/${id}`)).json();
  expect(m.state.moves).toHaveLength(1);
  await context.close();
});
test("an expired match stops polling and says so", async ({ page }) => {
  const { id, context } = await joined(page);
  let polls = 0;
  await page.route(`**/api/matches/${id}`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    polls++;
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "Match not found." }),
    });
  });
  await expect(
    page.getByText("This match is no longer available."),
  ).toBeVisible();
  const seen = polls;
  await page.waitForTimeout(3500);
  expect(polls).toBe(seen);
  await context.close();
});
test("armed warning survives reconnect and keyboard promotion remains ordinary", async ({
  page,
}) => {
  const { id, context } = await joined(page);
  let s = lateCourt();
  for (let n = 0; n < 4; n++) {
    s = courtTurn(s, "white").state;
    s = courtTurn(s, "black").state;
  }
  expect(s.warning?.message).toContain("turning against");
  await fixture(id, s);
  await page.reload();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "The king's own court is turning against him." }),
  ).toBeVisible();
  await page.waitForTimeout(1800);
  await expect(
    page.getByRole("status").filter({ hasText: "turning against" }),
  ).toBeVisible();
  const promotion = boardFixture(
    [
      ["K", [7, 7]],
      ["k", [0, 7]],
      ["P", [1, 0]],
      ["r", [4, 4]],
    ],
    0,
  );
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

for (const generation of [3, 4])
  test(`two sessions reconnect to identical v${generation} public refusal and warning history`, async ({
    page,
  }) => {
    const { id, context, guest } = await joined(page);
    let s = (generation === 4 ? v4Fixture : v3Fixture)([
      ["K", [7, 7]],
      ["k", [0, 7]],
      ["Q", [4, 3]],
      ["r", [0, 0]],
    ]);
    const refused = submitMove(
      s,
      { from: [4, 3], to: [4, 0], side: "white" },
      { draw: () => 0 },
    );
    expect(refused.resolution).toBe("refused");
    await fixture(id, refused.state);
    await Promise.all([page.reload(), guest.reload()]);
    for (const client of [page, guest])
      await expect(
        client.getByText(refused.message, { exact: true }).first(),
      ).toBeVisible();
    const whiteState = (
      await (await page.request.get(`/api/matches/${id}`)).json()
    ).state;
    const blackState = (
      await (await guest.request.get(`/api/matches/${id}`)).json()
    ).state;
    expect(whiteState).toEqual(blackState);
    s = generation === 4 ? constructedV4Court() : constructedV3Court();
    for (let n = 0; n < 4; n++) {
      s.ply += 2;
      s.revision++;
      s.simulation!.turnContext.ply = s.ply;
      s.simulation!.kingdoms.white.ownTurnsCompleted++;
      scheduleCourt(s, "white", () => 0, false);
    }
    expect(s.warning?.message).toContain("turning against");
    await fixture(id, s);
    await Promise.all([page.reload(), guest.reload()]);
    for (const client of [page, guest])
      await expect(
        client.getByRole("status").filter({ hasText: "turning against" }),
      ).toBeVisible();
    const a = (await (await page.request.get(`/api/matches/${id}`)).json())
      .state;
    const b = (await (await guest.request.get(`/api/matches/${id}`)).json())
      .state;
    expect(a.events).toEqual(b.events);
    expect(a.events).toHaveLength(3);
    expect(JSON.stringify(a)).not.toMatch(
      /episodes|rngState|ringleader|accomplice|configVersion/,
    );
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
