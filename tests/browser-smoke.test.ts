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
    "login fixture: modal:login and plan can sign in",
    async () => {
      const server = await startFixtureServer({ "/login": "login-local.html" });
      const runtime = new BrowserRuntime({
        dataDir: tempDataDir(),
        policy: { headless: smokeHeadless(), maxRecoveries: 2 },
      });
      const url = server.url("/login");
      const plan = {
        goal: "sign in on demo app",
        steps: [
          { action: { type: "navigate" as const, url } },
          {
            action: {
              type: "type" as const,
              target: { placeholder: "Email" },
              text: "agent@example.com",
            },
          },
          {
            action: {
              type: "type" as const,
              target: { placeholder: "Password" },
              text: "secret",
            },
          },
          {
            action: {
              type: "click" as const,
              target: { role: "button", name: "Continue" },
            },
          },
          { action: { type: "wait" as const, text: "Signed in" } },
        ],
      };
      try {
        const state = await runtime.attach({ startUrl: url });
        expect(state.signals).toContain("modal:login");
        expect(state.signals).toContain("password_field");
        const result = await runtime.run(plan);
        expect(result.ok).toBe(true);
      } finally {
        await runtime.close();
        await server.close();
      }
    },
    90_000,
  );

  it(
    "otp fixture: modal:otp and agent-supplied code",
    async () => {
      const server = await startFixtureServer({ "/verify": "otp-local.html" });
      const runtime = new BrowserRuntime({
        dataDir: tempDataDir(),
        policy: { headless: smokeHeadless(), maxRecoveries: 2 },
      });
      const url = server.url("/verify");
      const code = process.env.BER_TEST_OTP ?? "123456";
      const plan = {
        goal: "complete otp",
        steps: [
          { action: { type: "navigate" as const, url } },
          {
            action: {
              type: "type" as const,
              target: { placeholder: "Enter verification code" },
              text: code,
            },
          },
          {
            action: {
              type: "click" as const,
              target: { role: "button", name: "Verify" },
            },
          },
          { action: { type: "wait" as const, text: "Verified" } },
        ],
      };
      try {
        const state = await runtime.attach({ startUrl: url });
        expect(state.signals).toContain("modal:otp");
        const result = await runtime.run(plan);
        expect(result.ok).toBe(true);
      } finally {
        await runtime.close();
        await server.close();
      }
    },
    90_000,
  );

  it(
    "payment confirm fixture: detects modal:payment without auto pay",
    async () => {
      const server = await startFixtureServer({ "/cart": "payment-confirm-local.html" });
      const runtime = new BrowserRuntime({
        dataDir: tempDataDir(),
        policy: { headless: smokeHeadless(), maxRecoveries: 1, allowPurchase: false },
      });
      try {
        const state = await runtime.attach({ startUrl: server.url("/cart") });
        expect(state.signals).toContain("modal:payment");
        const blocked = await runtime.act({
          type: "click",
          target: { role: "button", name: "Pay now" },
        });
        expect(blocked.ok).toBe(false);
        expect(blocked.error).toMatch(/blocked by policy/i);
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

  it(
    "dom-mutate fixture: emits dom_change on SSE bus after SPA injection",
    async () => {
      const server = await startFixtureServer({ "/": "dom-mutate.html" });
      const runtime = new BrowserRuntime({
        dataDir: tempDataDir(),
        policy: { headless: smokeHeadless() },
      });

      try {
        await runtime.attach({ startUrl: server.url("/") });
        const deadline = Date.now() + 5000;
        let domChange: { mutations?: number } | undefined;
        while (Date.now() < deadline) {
          const hit = runtime
            .listEvents({ type: "dom_change" })
            .find((e) => (e.data?.mutations as number) > 0);
          if (hit) {
            domChange = hit.data;
            break;
          }
          await new Promise((r) => setTimeout(r, 100));
        }
        expect(domChange?.mutations).toBeGreaterThan(0);
      } finally {
        await runtime.close();
        await server.close();
      }
    },
    30_000,
  );
});
