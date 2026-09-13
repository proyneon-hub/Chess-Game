import { test, expect } from "@playwright/test";
import { joinedFixture, installFixture } from "../browser-fixtures";
import { v5Fixture } from "../encounter-fixtures";
import { encounters } from "@/lib/rpg/encounters/state";
import { submitMove } from "@/lib/game";
import { subjectAt } from "../fixtures";
// Explicit isolated branch fixtures; not natural-occurrence evidence.
test("protection survives reconnect and a dropped fulfillment response awards only once", async ({
  page,
}) => {
  const { id, context, guest } = await joinedFixture(page);
  const s = v5Fixture(
      [
        ["K", [7, 7]],
        ["k", [0, 7]],
        ["R", [4, 0]],
        ["N", [5, 2]],
        ["p", [3, 1]],
      ],
      20,
    ),
    subject = s.pieceIds[4][0]!;
  encounters(s).active = [
    {
      id: "encounter-1",
      family: "protection",
      phase: 2,
      side: "white",
      participants: [subject],
      causes: [],
      createdPly: 20,
      createdOwn: 0,
      deadline: 3,
      objective: { kind: "protect", subject, initialLoss: 500, defenders: [] },
      stage: 1,
      stageOwn: 0,
      outcome: "active",
      consumed: [],
      parent: null,
      interacted: false,
      effective: false,
    },
  ];
  encounters(s).serial = 1;
  await installFixture(id, s);
  await page.reload();
  await guest.reload();
  await expect(
    page.getByRole("region", { name: "Piece requests" }),
  ).toContainText("rook at a4");
  let dropped = false;
  await page.route(`**/api/matches/${id}`, async (route) => {
    if (route.request().method() === "POST" && !dropped) {
      dropped = true;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.locator('[data-square="c3"]').click();
  await page.locator('[data-square="b5"]').click();
  await expect(
    page.getByRole("button", { name: "Retry connection" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry connection" }).click();
  await expect(
    page.getByRole("region", { name: "Piece requests" }),
  ).toContainText("burden eases");
  await guest.reload();
  await expect(
    guest.getByRole("region", { name: "Piece requests" }),
  ).toContainText("burden eases");
  const state = (await (await page.request.get(`/api/matches/${id}`)).json())
    .state;
  expect(state.moves).toHaveLength(1);
  expect(
    state.events.filter((e: { message: string }) =>
      e.message.includes("burden eases"),
    ),
  ).toHaveLength(1);
  expect(JSON.stringify(state)).not.toMatch(
    /modifiers|loyalty|causes|objective|rngState/,
  );
  await context.close();
});
test("contextual dispute refusal keeps Repeat order visible and a legal mediation resolves the request", async ({
  page,
}) => {
  const { id, context, guest } = await joinedFixture(page);
  const s = v5Fixture(
      [
        ["K", [7, 7]],
        ["k", [0, 7]],
        ["R", [5, 0]],
        ["N", [5, 2]],
        ["p", [3, 1]],
      ],
      40,
    ),
    a = s.pieceIds[5][0]!,
    b = s.pieceIds[5][2]!;
  Object.assign(subjectAt(s, [5, 0]), {
    fear: 80,
    resentment: 80,
    loyalty: 20,
  });
  encounters(s).active = [
    {
      id: "encounter-1",
      family: "dispute",
      phase: 3,
      side: "white",
      participants: [a, b],
      causes: [],
      createdPly: 40,
      createdOwn: 0,
      deadline: 3,
      objective: { kind: "mediate", pair: [a, b], separated: 0 },
      stage: 1,
      stageOwn: 0,
      outcome: "active",
      consumed: [],
      parent: null,
      interacted: false,
      effective: false,
    },
  ];
  encounters(s).serial = 1;
  encounters(s).modifiers = [
    {
      encounterId: "encounter-1",
      subject: a,
      helper: b,
      kind: "dispute",
      expires: 6,
      consumed: false,
    },
  ];
  const refused = submitMove(
    s,
    { side: "white", from: [5, 0], to: [4, 0] },
    { draw: () => 0 },
  ).state;
  await installFixture(id, refused);
  await page.reload();
  await guest.reload();
  await expect(
    page.getByRole("button", { name: "Repeat order", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "knight at c3's watch" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Repeat order", exact: true }).click();
  await expect(page.locator('[data-square="a4"]')).toHaveAttribute(
    "aria-label",
    /White rook/,
  );
  await expect(guest.getByText("Black to Move", { exact: true })).toBeVisible();
  await guest.locator('[data-square="h8"]').click();
  await guest.locator('[data-square="g8"]').click();
  await expect(page.getByText("White to Move", { exact: true })).toBeVisible();
  await page.locator('[data-square="a4"]').click();
  await page.locator('[data-square="a5"]').click();
  const repeat = page.getByRole("button", {
    name: "Repeat order",
    exact: true,
  });
  await expect
    .poll(
      async () =>
        (await repeat.isVisible()) ||
        (await page
          .getByRole("region", { name: "Piece requests" })
          .textContent()
          .then((t) => !!t?.includes("ease their dispute"))),
    )
    .toBe(true);
  if (await repeat.isVisible()) await repeat.click();
  await expect(
    page.getByRole("region", { name: "Piece requests" }),
  ).toContainText("ease their dispute");
  await context.close();
});
