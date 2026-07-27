import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { wireContextLifecycle } from "./contextLifecycle.js";
import type { Policy } from "../types.js";

export interface AttachOptions {
  cdpUrl?: string;
  userDataDir?: string;
  headless?: boolean;
  startUrl?: string;
}

export interface TabInfo {
  index: number;
  url: string;
  title: string;
  active: boolean;
}

export class BrowserSession {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private ownsBrowser = false;

  constructor(private readonly policy: Policy) {}

  async attach(options: AttachOptions = {}): Promise<Page> {
    await this.close();

    const headless = options.headless ?? this.policy.headless;

    if (options.cdpUrl) {
      this.browser = await chromium.connectOverCDP(options.cdpUrl);
      this.ownsBrowser = false;
      const contexts = this.browser.contexts();
      this.context = contexts[0] ?? (await this.browser.newContext());
      this.page = this.context.pages()[0] ?? (await this.context.newPage());
    } else if (options.userDataDir) {
      this.context = await chromium.launchPersistentContext(options.userDataDir, {
        headless,
        args: ["--disable-blink-features=AutomationControlled"],
      });
      this.ownsBrowser = true;
      this.page = this.context.pages()[0] ?? (await this.context.newPage());
    } else {
      this.browser = await chromium.launch({
        headless,
        channel: process.env.BER_CHROME_CHANNEL,
        args: ["--disable-blink-features=AutomationControlled"],
      });
      this.ownsBrowser = true;
      this.context = await this.browser.newContext();
      this.page = await this.context.newPage();
    }

    if (options.startUrl) {
      await this.page.goto(options.startUrl, { waitUntil: "domcontentloaded" });
    }

    wireContextLifecycle(this.context, this.policy, {
      adoptPopupPage: (page) => {
        this.page = page;
      },
    });

    return this.page;
  }

  getPage(): Page {
    if (!this.page) {
      throw new Error("Browser session is not attached. Call attach() first.");
    }
    return this.page;
  }

  getContext(): BrowserContext {
    if (!this.context) {
      throw new Error("Browser session is not attached. Call attach() first.");
    }
    return this.context;
  }

  isAttached(): boolean {
    return this.page !== null;
  }

  async listTabs(): Promise<TabInfo[]> {
    const context = this.getContext();
    const pages = context.pages();
    const infos: TabInfo[] = [];
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i]!;
      infos.push({
        index: i,
        url: p.url(),
        title: await p.title().catch(() => ""),
        active: p === this.page,
      });
    }
    return infos;
  }

  async newTab(url?: string): Promise<TabInfo> {
    const context = this.getContext();
    const page = await context.newPage();
    this.page = page;
    if (url) {
      await page.goto(url, { waitUntil: "domcontentloaded" });
    }
    const tabs = await this.listTabs();
    return tabs.find((t) => t.active) ?? tabs[tabs.length - 1]!;
  }

  async switchTab(index: number): Promise<TabInfo> {
    const pages = this.getContext().pages();
    const page = pages[index];
    if (!page) throw new Error(`No tab at index ${index}`);
    this.page = page;
    await page.bringToFront().catch(() => undefined);
    const tabs = await this.listTabs();
    return tabs[index]!;
  }

  async closeTab(index?: number): Promise<TabInfo[]> {
    const pages = this.getContext().pages();
    const targetIndex = index ?? pages.findIndex((p) => p === this.page);
    const page = pages[targetIndex];
    if (!page) throw new Error(`No tab at index ${targetIndex}`);
    if (pages.length === 1) {
      throw new Error("Cannot close the last tab");
    }
    await page.close();
    const remaining = this.getContext().pages();
    this.page = remaining[Math.max(0, targetIndex - 1)] ?? remaining[0]!;
    return this.listTabs();
  }

  async close(): Promise<void> {
    if (this.ownsBrowser) {
      if (this.context && !this.browser) {
        await this.context.close().catch(() => undefined);
      }
      if (this.browser) {
        await this.browser.close().catch(() => undefined);
      }
    }
    this.browser = null;
    this.context = null;
    this.page = null;
    this.ownsBrowser = false;
  }
}
