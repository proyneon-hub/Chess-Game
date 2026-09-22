import { test, expect, type Page } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
const square = (page: Page, name: string) =>
  page.locator(`[data-square="${name}"]`);
const move = async (page: Page, from: string, to: string) => {
  await square(page, from).click();
  await square(page, to).click();
};
test("ordinary opening, keyboard moves, undo, and production privacy", async ({
  page,
}) => {
  await page.goto("/?debug=1");
  await expect(page.getByText(/diagnostics|RPG|kingdom|dice/i)).toHaveCount(0);
  await page.getByRole("button", { name: /Play here/ }).click();
  await square(page, "e2").focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await expect(square(page, "e4")).toHaveAttribute("aria-label", /White pawn/);
  await expect(page.getByText("Black to Move", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(square(page, "e2")).toHaveAttribute("aria-label", /White pawn/);
  await expect(page.getByText("White to Move", { exact: true })).toBeVisible();
  for (const [a, b] of [
    ["e2", "e4"],
    ["e7", "e5"],
    ["g1", "f3"],
    ["b8", "c6"],
    ["f1", "c4"],
    ["g8", "f6"],
    ["d2", "d3"],
    ["f8", "c5"],
  ])
    await move(page, a, b);
  await expect(page.getByRole("button", { name: "Repeat order" })).toHaveCount(
    0,
  );
  await expect(page.getByText(/hesitates|court|loyalty/i)).toHaveCount(0);
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
});
test("AI completes and restart cancels worker", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Difficulty").selectOption("advanced");
  await page.getByRole("button", { name: /Play computer/ }).click();
  await move(page, "e2", "e4");
  await page.getByRole("button", { name: "New Game", exact: true }).click();
  await page.waitForTimeout(1500);
  await expect(square(page, "e2")).toHaveAttribute("aria-label", /White pawn/);
  await expect(page.getByText("No moves yet.")).toBeVisible();
  await move(page, "d2", "d4");
  await expect(page.getByText("White to Move", { exact: true })).toBeVisible({
    timeout: 10000,
  });
  await expect(square(page, "d4")).toHaveAttribute("aria-label", /White pawn/);
});
test("mobile board fits and respects reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: /Play here/ }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(page.getByRole("region", { name: "Chess board" })).toBeVisible();
  await move(page, "e2", "e4");
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});
test("MongoDB invite, separate sessions, Black orientation, retries and leave", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Play online/ }).click();
  await expect(
    page.getByRole("button", { name: "Copy invite link" }),
  ).toBeVisible();
  const url = page.url();
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(url);
  await guest.getByRole("button", { name: "Join as Black" }).click();
  await expect(guest.locator("[data-square]").first()).toHaveAttribute(
    "data-square",
    "h1",
  );
  await expect(page.getByText("Waiting for an opponent to join.")).toHaveCount(
    0,
  );
  await move(page, "e2", "e4");
  await expect(square(guest, "e4")).toHaveAttribute("aria-label", /White pawn/);
  await move(guest, "e7", "e5");
  await expect(square(page, "e5")).toHaveAttribute("aria-label", /Black pawn/);
  const response = await page.request.get(
    new URL(url).origin +
      "/api/matches/" +
      new URL(url).searchParams.get("match"),
  );
  expect(await response.text()).not.toMatch(
    /"(?:rngState|subjects|pieceIds|kingdoms|loyalty|personality|privateEvents|rpgState)"/,
  );
  await guest.getByRole("button", { name: "Leave", exact: true }).click();
  await guest.waitForTimeout(1700);
  await expect(guest.getByRole("button", { name: /Play here/ })).toBeVisible();
  expect(guest.url()).not.toContain("match=");
  await guestContext.close();
});
test("cross-origin and oversized API requests are rejected", async ({
  request,
}) => {
  const response = await request.post("/api/matches", {
    headers: { origin: "https://wrong.example" },
    data: {},
  });
  expect(response.status()).toBe(403);
  const large = await request.post("/api/matches", {
    headers: { origin: "http://localhost:3100" },
    data: { padding: "x".repeat(2000) },
  });
  expect(large.status()).toBe(400);
});

test("full computer search runs in a worker with no main-thread search task", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as typeof window & {
      aiReports: unknown[];
      longTasks: number[];
    };
    w.aiReports = [];
    w.longTasks = [];
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.addEventListener("message", (event) => {
          if (event.data.result) {
            const { elapsedMs, nodes, completedDepth } = event.data.result;
            w.aiReports.push({ elapsedMs, nodes, completedDepth });
          }
        });
      }
    };
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.longTasks.push(e.duration);
    }).observe({ type: "longtask", buffered: false });
  });
  await page.goto("/");
  await page.getByLabel("Difficulty").selectOption("advanced");
  await page.getByRole("button", { name: /Play computer/ }).click();
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    (window as typeof window & { longTasks: number[] }).longTasks = [];
  });
  await move(page, "e2", "e4");
  await expect(page.getByText("White to Move", { exact: true })).toBeVisible();
  const report = await page.evaluate(() => {
    const w = window as typeof window & {
      aiReports: unknown[];
      longTasks: number[];
    };
    return { workers: w.aiReports, longTasks: w.longTasks };
  });
  expect(report.workers.length).toBeGreaterThan(0);
  mkdirSync(".test-services", { recursive: true });
  writeFileSync(
    ".test-services/browser-ai.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  expect(report.longTasks).toHaveLength(0);
});

test("security headers are sent and the CSP allows the computer worker", async ({
  page,
}) => {
  const violations: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text()))
      violations.push(m.text());
  });
  const response = await page.goto("/");
  const headers = response!.headers();
  expect(headers["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(headers["content-security-policy"]).not.toContain("unsafe-eval");
  expect(headers["referrer-policy"]).toBe("same-origin");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-powered-by"]).toBeUndefined();
  await page.getByRole("button", { name: /Play computer/ }).click();
  await move(page, "e2", "e4");
  await expect(page.getByText("White to Move", { exact: true })).toBeVisible({
    timeout: 5000,
  });
  expect(violations).toEqual([]);
});

test("the board is one tab stop with arrow, Home and End navigation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Play here/ }).click();
  await expect(page.locator('[data-square][tabindex="0"]')).toHaveCount(1);
  await square(page, "e2").focus();
  await page.keyboard.press("End");
  await expect(square(page, "h2")).toBeFocused();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowUp");
  await expect(square(page, "a3")).toBeFocused();
  await expect(square(page, "a3")).toHaveAttribute("tabindex", "0");
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() =>
      (document.activeElement as HTMLElement | null)?.getAttribute(
        "data-square",
      ),
    ),
  ).toBeNull();
  await page.keyboard.press("Shift+Tab");
  await expect(square(page, "a3")).toBeFocused();
  await move(page, "e2", "e4");
  await expect(square(page, "e4")).toHaveAttribute(
    "aria-label",
    /White pawn, last move/,
  );
});
