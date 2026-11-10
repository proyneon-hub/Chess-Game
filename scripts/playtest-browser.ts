// Browser cross-check for the frequency playtest: plays real "Play computer"
// games through the UI (clicks only) and counts what is actually on screen at
// each of the player's turns, then compares that with the saved game state.
// Needs the production build running: `npm run build && npx next start -p 3100`.
//
//   npx tsx scripts/playtest-browser.ts --games 6 [--first 0] [--shots <dir>]
import { chromium, type Page } from "@playwright/test";
import { squareName } from "../lib/chess";
import { createGameState } from "../lib/game";
import { publicState } from "../lib/game/publicState";
import type { GameState } from "../lib/game/types";
import { seedRng, draw } from "../lib/rpg/rng";
import { awareChoice } from "./board-policies";

const flags: Record<string, string> = {};
for (let i = 2; i < process.argv.length; i += 2)
  flags[process.argv[i]] = process.argv[i + 1];
const games = Number(flags["--games"] ?? 6),
  first = Number(flags["--first"] ?? 0),
  shots = flags["--shots"] ?? null,
  base = flags["--url"] ?? "http://localhost:3100",
  cap = 200,
  LEVELS = ["easy", "normal", "advanced"] as const;

const save = (page: Page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem("chess:local-game:v1");
    return raw ? (JSON.parse(raw).game as unknown) : null;
  }) as Promise<GameState | null>;

/** What a player can see right now, read from the DOM alone. */
const screen = (page: Page) =>
  page.evaluate(() => {
    const region = document.querySelector(
      'section[aria-label="Piece requests"]',
    );
    const labels = [...document.querySelectorAll("[data-square]")].map(
      (el) => el.getAttribute("aria-label") ?? "",
    );
    const log = [...document.querySelectorAll("details")].find((d) =>
      d.querySelector("summary")?.textContent?.includes("Event Log"),
    );
    return {
      cards: [...(region?.querySelectorAll("article") ?? [])].map(
        (a) => a.querySelector("p")?.textContent ?? "",
      ),
      repeat: [...document.querySelectorAll("button")].some(
        (b) => b.textContent === "Repeat order",
      ),
      unexpected: labels.some((l) => l.includes("unexpected destination")),
      warning: labels.some((l) => /, warning/.test(l)),
      status: document.querySelector('[role="status"]')?.textContent ?? "",
      amberLog: log ? log.querySelectorAll("li.text-amber-200").length : 0,
      over: document.body.textContent?.includes("Game Over") ?? false,
    };
  });

async function playGame(page: Page, index: number) {
  const level = LEVELS[index % LEVELS.length],
    rng = seedRng(9000 + index);
  await page.goto(base);
  await page.getByLabel("Difficulty").selectOption(level);
  await page.getByRole("button", { name: /Play computer/ }).click();
  await page.locator('[data-square="e2"]').waitFor();

  const row = {
    game: index + 1,
    difficulty: level,
    plies: 0,
    ending: "",
    playerTurns: 0,
    turnsWithRpgOnScreen: 0,
    turnsWithCard: 0,
    turnsWithRepeatOrder: 0,
    turnsWithUnexpectedMark: 0,
    turnsWithWarningMark: 0,
    distinctCardTexts: 0,
    firstRpgPly: null as number | null,
    amberLogEntries: 0,
    mismatches: 0,
    saved: {} as Record<string, number>,
  };
  const cardTexts = new Set<string>(),
    taken = new Set<string>();
  const shot = async (name: string) => {
    if (!shots || taken.has(name)) return;
    taken.add(name);
    await page.screenshot({ path: `${shots}/game${index + 1}-${name}.png` });
  };

  let game = await save(page);
  for (let guard = 0; guard < 400; guard++) {
    // Wait until it is the player's turn again (or the game is over).
    await page.waitForFunction(
      () => {
        const raw = localStorage.getItem("chess:local-game:v1");
        const g = raw ? JSON.parse(raw).game : null;
        const text = document.body.textContent ?? "";
        return (
          text.includes("Game Over") ||
          (text.includes("White to Move") && (!g || g.sideToMove === "white"))
        );
      },
      undefined,
      { timeout: 60_000 },
    );
    await page.waitForTimeout(60);
    game = (await save(page)) ?? game;
    const seen = await screen(page);
    if (game) {
      const pub = publicState(game);
      row.plies = game.ply;
      // The DOM must agree with the saved state on every public channel.
      if (
        seen.cards.length !== (pub.encounters ?? []).length ||
        seen.repeat !== Boolean(game.pendingRefusal) ||
        seen.warning !== Boolean(game.warning)
      )
        row.mismatches++;
    }
    const rpg =
      seen.cards.length > 0 || seen.repeat || seen.unexpected || seen.warning;
    row.playerTurns++;
    if (rpg) row.turnsWithRpgOnScreen++;
    if (rpg && row.firstRpgPly === null) row.firstRpgPly = row.plies;
    if (seen.cards.length) (row.turnsWithCard++, await shot("request-card"));
    if (seen.repeat) (row.turnsWithRepeatOrder++, await shot("hesitation"));
    if (seen.unexpected)
      (row.turnsWithUnexpectedMark++, await shot("unexpected-move"));
    if (seen.warning) (row.turnsWithWarningMark++, await shot("warning"));
    for (const c of seen.cards) cardTexts.add(c);
    row.amberLogEntries = seen.amberLog;
    if (seen.over || (game && (game.status !== "active" || game.ply >= cap)))
      break;

    // Nothing is saved until the first move; the start position is standard.
    const view = game ?? createGameState(1);
    const before = game
      ? JSON.stringify([game.ply, game.pendingRefusal])
      : "none";
    if (seen.repeat && draw(rng) < 0.5)
      await page.getByRole("button", { name: "Repeat order" }).click();
    else {
      const m = awareChoice(publicState(view), rng);
      await page.locator(`[data-square="${squareName(m.from)}"]`).click();
      await page.locator(`[data-square="${squareName(m.to)}"]`).click();
      const promote = page.getByRole("button", { name: "Promote" });
      if (await promote.isVisible().catch(() => false)) await promote.click();
    }
    // The order registered once the ply advanced or a hesitation is pending.
    await page.waitForFunction(
      (prev) => {
        const raw = localStorage.getItem("chess:local-game:v1");
        const g = raw ? JSON.parse(raw).game : null;
        return g && JSON.stringify([g.ply, g.pendingRefusal]) !== prev;
      },
      before,
      { timeout: 60_000 },
    );
  }
  row.ending = game?.terminal?.reason ?? (row.plies >= cap ? "cap" : "open");
  row.distinctCardTexts = cardTexts.size;
  const counters = game?.simulation?.counters ?? {};
  for (const k of [
    "eligibleCommands",
    "encounterOffers",
    "encounter:fulfilled",
    "encounter:expired",
    "retreats",
    "extensions",
    "shakenWarnings",
    "plots",
  ])
    row.saved[k] = counters[k] ?? 0;
  row.saved.hesitations = Object.entries(counters)
    .filter(([k]) => k.startsWith("refused:"))
    .reduce((n, [, v]) => n + v, 0);
  return row;
}

async function main() {
  const browser = await chromium.launch();
  for (let i = first; i < first + games; i++) {
    // A fresh context per game, so no saved game carries over.
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    console.log(JSON.stringify(await playGame(await context.newPage(), i)));
    await context.close();
  }
  await browser.close();
}
void main();
