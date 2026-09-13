import { expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import mongoose from "mongoose";
import type { GameState } from "@/lib/game/types";
export async function joinedFixture(page: Page) {
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
export async function installFixture(id: string, state: GameState) {
  const { uri } = JSON.parse(
    readFileSync(".test-services/mongodb.json", "utf8"),
  );
  const connection = await mongoose.createConnection(uri).asPromise();
  await connection
    .collection("gamematches")
    .updateOne({ inviteId: id }, { $set: { state }, $inc: { version: 1 } });
  await connection.close();
}
