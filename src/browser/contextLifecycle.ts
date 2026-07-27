import type { BrowserContext, Page } from "playwright";
import type { Policy } from "../types.js";
import { wirePageLifecycle } from "./pageLifecycle.js";

const wiredContexts = new WeakSet<BrowserContext>();

export interface ContextLifecycleOptions {
  adoptPopupPage: (page: Page) => void;
}

export function wireContextLifecycle(
  context: BrowserContext,
  policy: Policy,
  options: ContextLifecycleOptions,
): void {
  if (wiredContexts.has(context)) return;
  wiredContexts.add(context);

  const onNewPage = (page: Page) => {
    wirePageLifecycle(page, policy, {
      onPopupPage: policy.autoFocusPopupTabs
        ? (popup) => void adoptWithSettle(popup, options.adoptPopupPage)
        : undefined,
    });
  };

  for (const page of context.pages()) {
    onNewPage(page);
  }
  context.on("page", (page) => {
    onNewPage(page);
    if (policy.autoFocusPopupTabs) {
      void adoptWithSettle(page, options.adoptPopupPage);
    }
  });
}

async function adoptWithSettle(
  page: Page,
  adopt: (page: Page) => void,
): Promise<void> {
  await page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => undefined);
  adopt(page);
  await page.bringToFront().catch(() => undefined);
}
