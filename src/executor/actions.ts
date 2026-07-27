import type { Page } from "playwright";
import { settlePage } from "../browser/settle.js";
import { assertNavigationAllowed, looksLikePurchaseIntent } from "../policy.js";
import { SelectorEngine } from "../selectors/engine.js";
import type { Action, Policy } from "../types.js";

export interface ActionExecutionResult {
  ok: boolean;
  extracted?: Record<string, string>;
  error?: string;
}

export interface TabController {
  getPage(): Page;
  newTab(url?: string): Promise<unknown>;
  switchTab(index: number): Promise<unknown>;
  closeTab(index?: number): Promise<unknown>;
}

export class ActionExecutor {
  constructor(
    private readonly tabs: TabController,
    private readonly policy: Policy,
  ) {}

  private get page(): Page {
    return this.tabs.getPage();
  }

  private get selectors(): SelectorEngine {
    return new SelectorEngine(this.page);
  }

  async execute(action: Action): Promise<ActionExecutionResult> {
    try {
      switch (action.type) {
        case "navigate": {
          assertNavigationAllowed(action.url, this.policy);
          await this.page.goto(action.url, {
            waitUntil: action.waitUntil ?? "domcontentloaded",
          });
          // SPAs often paint after domcontentloaded — settle briefly by default.
          await settlePage(this.page, { timeoutMs: 3500, quietMs: 300 });
          return { ok: true };
        }
        case "click": {
          const label = action.target.name || action.target.text || "";
          if (!this.policy.allowPurchase && looksLikePurchaseIntent(label)) {
            throw new Error(`Purchase-like click blocked by policy: "${label}"`);
          }
          await this.selectors.locate(action.target).click({ timeout: 8000 });
          await settlePage(this.page, { timeoutMs: 2500, quietMs: 250 });
          return { ok: true };
        }
        case "type": {
          const locator = this.selectors.locate(action.target);
          if (action.clear !== false) {
            await locator.fill(action.text, { timeout: 8000 });
          } else {
            await locator.type(action.text, { timeout: 8000 });
          }
          if (action.pressEnter) {
            await locator.press("Enter");
          }
          return { ok: true };
        }
        case "select": {
          await this.selectors.locate(action.target).selectOption(action.value, {
            timeout: 8000,
          });
          return { ok: true };
        }
        case "wait": {
          const timeout = action.timeoutMs ?? 15000;
          if (action.ms) {
            await this.page.waitForTimeout(action.ms);
          }
          if (action.urlIncludes) {
            await this.page.waitForURL(
              (url) => url.toString().includes(action.urlIncludes!),
              { timeout },
            );
          }
          if (action.text) {
            await this.page.getByText(action.text).first().waitFor({
              state: "visible",
              timeout,
            });
          }
          if (action.target) {
            await this.selectors.locate(action.target).waitFor({
              state: "visible",
              timeout,
            });
          }
          if (action.settle || action.networkIdle) {
            await settlePage(this.page, {
              timeoutMs: action.timeoutMs ?? 5000,
              networkIdle: Boolean(action.networkIdle),
            });
          }
          // Empty wait with no conditions still settles briefly for dynamic pages.
          if (
            !action.ms &&
            !action.urlIncludes &&
            !action.text &&
            !action.target &&
            !action.settle &&
            !action.networkIdle
          ) {
            await settlePage(this.page, { timeoutMs: 2000, quietMs: 250 });
          }
          return { ok: true };
        }
        case "scroll": {
          const delta = action.direction === "up" ? -action.amount : action.amount;
          const until =
            Boolean(action.untilText) ||
            Boolean(action.untilCss) ||
            typeof action.untilCountAtLeast === "number";

          if (!until) {
            await this.page.mouse.wheel(0, delta);
            if (action.settle !== false) {
              await settlePage(this.page, { timeoutMs: 2500, quietMs: 300 });
            }
            return { ok: true };
          }

          const maxScrolls = action.maxScrolls ?? 8;
          const timeoutMs = action.timeoutMs ?? 20000;
          const deadline = Date.now() + timeoutMs;
          for (let i = 0; i < maxScrolls; i++) {
            if (await scrollUntilMet(this.page, action)) {
              if (action.settle !== false) {
                await settlePage(this.page, { timeoutMs: 2000, quietMs: 250 });
              }
              return { ok: true };
            }
            if (Date.now() > deadline) break;
            await this.page.mouse.wheel(0, delta);
            await settlePage(this.page, { timeoutMs: 2000, quietMs: 250 });
          }
          if (await scrollUntilMet(this.page, action)) {
            return { ok: true };
          }
          return {
            ok: false,
            error: `scroll until condition not met after ${maxScrolls} scrolls`,
          };
        }
        case "extract": {
          if (!action.target) {
            const text = await this.page.locator("body").innerText();
            return {
              ok: true,
              extracted: { [action.key]: text.slice(0, 4000) },
            };
          }
          const locator = this.selectors.locate(action.target);
          const value = action.attribute
            ? ((await locator.getAttribute(action.attribute)) ?? "")
            : await locator.innerText();
          return { ok: true, extracted: { [action.key]: value.trim() } };
        }
        case "press": {
          await this.page.keyboard.press(action.key);
          return { ok: true };
        }
        case "dismiss_overlays": {
          await dismissCommonOverlays(this.page);
          return { ok: true };
        }
        case "media": {
          return runMediaCommand(this.page, action.command);
        }
        case "observe": {
          // Runner always re-observes; settle so late SPA nodes are visible first.
          await settlePage(this.page, { timeoutMs: 3000, quietMs: 300 });
          return { ok: true };
        }
        case "new_tab": {
          await this.tabs.newTab(action.url);
          return { ok: true };
        }
        case "switch_tab": {
          await this.tabs.switchTab(action.index);
          return { ok: true };
        }
        case "close_tab": {
          await this.tabs.closeTab(action.index);
          return { ok: true };
        }
        default: {
          const _exhaustive: never = action;
          throw new Error(`Unsupported action: ${JSON.stringify(_exhaustive)}`);
        }
      }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

async function dismissCommonOverlays(page: Page): Promise<void> {
  const names = [
    /accept all/i,
    /accept/i,
    /agree/i,
    /got it/i,
    /close/i,
    /no thanks/i,
    /not now/i,
    /reject all/i,
    /skip ad/i,
    /skip intro/i,
    /^skip$/i,
  ];

  const scopes: Array<Page | ReturnType<Page["frameLocator"]> | import("playwright").Frame> = [
    page,
    page.frameLocator("iframe"),
    page.frameLocator("iframe[id*='consent' i]"),
    page.frameLocator("iframe[src*='consent' i]"),
    page.frameLocator("iframe[title*='consent' i]"),
  ];
  // Cross-origin consent frames: use Playwright frame tree (URL match).
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    const url = frame.url().toLowerCase();
    if (
      url.includes("consent") ||
      url.includes("cookie") ||
      url.includes("privacymanager") ||
      url.includes("cmp")
    ) {
      scopes.push(frame);
    }
  }

  for (const scope of scopes) {
    for (const name of names) {
      try {
        const candidate = scope.getByRole("button", { name });
        if (await candidate.first().isVisible({ timeout: 250 })) {
          await candidate.first().click({ timeout: 1000 });
          await page.waitForTimeout(150);
        }
      } catch {
        // keep trying
      }
    }
    try {
      const byText = scope.getByText(/skip ad|skip intro/i);
      if (await byText.first().isVisible({ timeout: 200 })) {
        await byText.first().click({ timeout: 1000 });
      }
    } catch {
      // ignore
    }
  }

  await page.keyboard.press("Escape").catch(() => undefined);
}

async function scrollUntilMet(
  page: Page,
  action: Extract<Action, { type: "scroll" }>,
): Promise<boolean> {
  if (action.untilText) {
    const visible = await page
      .getByText(action.untilText)
      .first()
      .isVisible()
      .catch(() => false);
    if (visible) return true;
  }
  if (action.untilCss) {
    const count = await page.locator(action.untilCss).count().catch(() => 0);
    const need = action.untilCountAtLeast ?? 1;
    if (count >= need) return true;
  } else if (typeof action.untilCountAtLeast === "number") {
    // Fallback: body child growth heuristic when only a count is requested.
    const nodes = await page
      .evaluate(`document.body ? document.body.querySelectorAll('*').length : 0`)
      .catch(() => 0);
    if (Number(nodes) >= action.untilCountAtLeast) return true;
  }
  // If only untilText was set and not found, keep going.
  if (!action.untilText && !action.untilCss && action.untilCountAtLeast === undefined) {
    return true;
  }
  return false;
}

async function runMediaCommand(
  page: Page,
  command: Extract<Action, { type: "media" }>["command"],
): Promise<ActionExecutionResult> {
  if (command === "skip_ad") {
    const candidates = [
      page.getByRole("button", { name: /skip ad/i }),
      page.getByRole("button", { name: /^skip$/i }),
      page.getByRole("button", { name: /skip intro/i }),
      page.getByText(/skip ad/i),
      page.getByText(/skip intro/i),
      page.locator(
        [
          ".ytp-ad-skip-button",
          ".ytp-skip-ad-button",
          "button.ytp-ad-skip-button-modern",
          "[class*='skip-ad' i]",
          "[class*='skipAd' i]",
          "[aria-label*='Skip' i]",
        ].join(", "),
      ),
    ];
    for (const candidate of candidates) {
      try {
        if (await candidate.first().isVisible({ timeout: 600 })) {
          await candidate.first().click({ timeout: 1500 });
          await settlePage(page, { timeoutMs: 1500, quietMs: 200 });
          return { ok: true, extracted: { media: "skip_ad" } };
        }
      } catch {
        // try next
      }
    }
    // No skip button usually means there is no skippable ad — treat as success.
    return { ok: true, extracted: { media: "skip_ad", skipped: "false" } };
  }

  if (command === "play" || command === "pause" || command === "toggle") {
    const desired =
      command === "play" ? true : command === "pause" ? false : null;
    const result = await page
      .evaluate(
        `(() => {
          const pick = () => {
            const nodes = Array.from(document.querySelectorAll("video, audio"));
            if (!nodes.length) return null;
            // Prefer the largest visible media element (main player, not a tiny preview).
            let best = null;
            let bestArea = -1;
            for (const el of nodes) {
              const r = el.getBoundingClientRect();
              const area = Math.max(0, r.width) * Math.max(0, r.height);
              const style = window.getComputedStyle(el);
              const visible =
                style.visibility !== "hidden" &&
                style.display !== "none" &&
                (area > 0 || el.tagName.toLowerCase() === "audio");
              if (!visible) continue;
              const score = el.tagName.toLowerCase() === "audio" ? Math.max(area, 1) : area;
              if (score > bestArea) {
                bestArea = score;
                best = el;
              }
            }
            return best || nodes[0];
          };
          const media = pick();
          if (!media) return { ok: false, reason: "no_media" };
          const want = ${desired === null ? "null" : desired ? "true" : "false"};
          if (want === null) {
            if (media.paused) media.play();
            else media.pause();
          } else if (want) {
            media.play();
          } else {
            media.pause();
          }
          return { ok: true, paused: media.paused, tag: media.tagName.toLowerCase() };
        })()`,
      )
      .catch(() => ({ ok: false, reason: "evaluate_failed" }));

    if (result && typeof result === "object" && (result as { ok?: boolean }).ok) {
      if (command === "toggle") {
        // evaluate already toggled; no extra key
      }
      await settlePage(page, { timeoutMs: 1200, quietMs: 150 });
      return {
        ok: true,
        extracted: {
          media: command,
          paused: String((result as { paused?: boolean }).paused ?? ""),
        },
      };
    }

    // Fallback: space/k shortcuts used by many players, then aria-labelled buttons.
    if (command === "toggle") {
      await page.keyboard.press("k").catch(() => undefined);
      await page.keyboard.press("Space").catch(() => undefined);
      await settlePage(page, { timeoutMs: 800, quietMs: 100 });
      return { ok: true, extracted: { media: "toggle" } };
    }
    const label =
      command === "play"
        ? /play/i
        : command === "pause"
          ? /pause/i
          : /play|pause/i;
    try {
      const btn = page.getByRole("button", { name: label });
      if (await btn.first().isVisible({ timeout: 800 })) {
        await btn.first().click({ timeout: 1500 });
        return { ok: true, extracted: { media: command } };
      }
    } catch {
      // fall through
    }
    return { ok: false, error: `media ${command} failed: no video control` };
  }

  if (command === "mute" || command === "unmute") {
    await page
      .evaluate(
        `(() => {
          const media = document.querySelector("video, audio");
          if (!media) return false;
          media.muted = ${command === "mute" ? "true" : "false"};
          return true;
        })()`,
      )
      .catch(() => false);
    await page.keyboard.press("m").catch(() => undefined);
    return { ok: true, extracted: { media: command } };
  }

  if (command === "fullscreen") {
    await page.keyboard.press("f").catch(() => undefined);
    try {
      const btn = page.getByRole("button", { name: /full ?screen/i });
      if (await btn.first().isVisible({ timeout: 500 })) {
        await btn.first().click({ timeout: 1000 });
      }
    } catch {
      // keyboard may be enough
    }
    return { ok: true, extracted: { media: "fullscreen" } };
  }

  return { ok: false, error: `unsupported media command: ${command}` };
}
