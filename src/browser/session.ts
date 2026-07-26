import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { Policy } from "../types.js";

export interface AttachOptions {
  cdpUrl?: string;
  userDataDir?: string;
  headless?: boolean;
  startUrl?: string;
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

    return this.page;
  }

  getPage(): Page {
    if (!this.page) {
      throw new Error("Browser session is not attached. Call attach() first.");
    }
    return this.page;
  }

  isAttached(): boolean {
    return this.page !== null;
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
