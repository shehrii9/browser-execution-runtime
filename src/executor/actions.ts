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
          await this.page.mouse.wheel(0, delta);
          if (action.settle !== false) {
            await settlePage(this.page, { timeoutMs: 2500, quietMs: 300 });
          }
          return { ok: true };
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
    /reject all/i,
    /skip ad/i,
    /^skip$/i,
  ];

  const scopes = [page as Page | ReturnType<Page["frameLocator"]>, page.frameLocator("iframe")];
  // Also try common consent iframe patterns.
  scopes.push(page.frameLocator("iframe[id*='consent' i]"));
  scopes.push(page.frameLocator("iframe[src*='consent' i]"));
  scopes.push(page.frameLocator("iframe[title*='consent' i]"));

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
      const byText = scope.getByText(/skip ad/i);
      if (await byText.first().isVisible({ timeout: 200 })) {
        await byText.first().click({ timeout: 1000 });
      }
    } catch {
      // ignore
    }
  }

  await page.keyboard.press("Escape").catch(() => undefined);
}
