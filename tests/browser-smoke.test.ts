import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BrowserRuntime } from "../src/runtime.js";
import { observePage } from "../src/state/observe.js";
import { chromium } from "playwright";
import { startFixtureServer } from "./helpers/fixtureServer.js";

function tempDataDir(): string {
  return mkdtempSync(join(tmpdir(), "ber-smoke-"));
}

/** CI uses headless; set BER_HEADLESS=0 + DISPLAY=:1 for headed desktop runs. */
function smokeHeadless(): boolean {
  return process.env.BER_HEADLESS !== "0";
}

describe.sequential("browser smoke (Playwright)", () => {
  beforeAll(async () => {
    const browser = await chromium.launch({ headless: smokeHeadless() });
    await browser.close();
  }, 120_000);

  it(
    "observe example.com returns two named nodes (no pierce duplicates)",
    async () => {
      const browser = await chromium.launch({ headless: smokeHeadless() });
      const page = await browser.newPage();
      await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
      const state = await observePage(page);
      await browser.close();

      expect(state.nodes).toHaveLength(2);
      expect(state.nodes.every((n) => Boolean(n.name?.trim()))).toBe(true);
      expect(state.links).toContain("Learn more");
    },
    60_000,
  );

  it(
    "cookie-shop fixture: recovery completes checkout after overlay",
    async () => {
      const server = await startFixtureServer({ "/": "cookie-shop.html" });
      const runtime = new BrowserRuntime({
        dataDir: tempDataDir(),
        policy: { headless: smokeHeadless(), maxRecoveries: 4, allowPurchase: true },
      });

      const url = server.url("/");
      const plan = {
        goal: "checkout on cookie shop",
        steps: [
          { action: { type: "navigate" as const, url } },
          {
            action: {
              type: "click" as const,
              target: { role: "button", name: "Checkout" },
            },
          },
          { action: { type: "wait" as const, text: "Done" } },
        ],
      };

      try {
        await runtime.attach({ startUrl: url });
        const result = await runtime.run(plan);
        expect(result.ok).toBe(true);
        expect(result.steps.every((s) => s.ok)).toBe(true);
      } finally {
        await runtime.close();
        await server.close();
      }
    },
    90_000,
  );

  it(
    "article fixture: page hint and cookie signals",
    async () => {
      const server = await startFixtureServer({
        "/news/world-demo": "article-local.html",
      });
      const runtime = new BrowserRuntime({
        dataDir: tempDataDir(),
        policy: { headless: smokeHeadless(), maxRecoveries: 2 },
      });

      try {
        const state = await runtime.attach({
          startUrl: server.url("/news/world-demo"),
        });
        expect(state.pageHint).toBe("article");
        expect(state.signals).toContain("hint:article");
        expect(state.signals).toContain("cookie_banner");
        expect(state.buttons).toContain("Accept all");
      } finally {
        await runtime.close();
        await server.close();
      }
    },
    60_000,
  );

  it(
    "media fixture: watch hint and video_player signal",
    async () => {
      const server = await startFixtureServer({
        "/watch/demo": "media-local.html",
      });
      const runtime = new BrowserRuntime({
        dataDir: tempDataDir(),
        policy: { headless: smokeHeadless(), maxRecoveries: 2 },
      });

      try {
        const state = await runtime.attach({
          startUrl: server.url("/watch/demo"),
        });
        expect(state.pageHint).toBe("watch");
        expect(state.signals).toContain("video_player");
        expect(state.signals).toContain("skip_ad");
        expect(state.nodes.some((n) => n.tag === "video")).toBe(true);
      } finally {
        await runtime.close();
        await server.close();
      }
    },
    60_000,
  );
});
