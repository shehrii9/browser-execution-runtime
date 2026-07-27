import type { Page } from "playwright";

export interface SettleOptions {
  /** Max time to wait for quiet. Default 4000ms. */
  timeoutMs?: number;
  /** How long the DOM signature must stay unchanged. Default 350ms. */
  quietMs?: number;
  /** Also wait for networkidle (best-effort, short). Default false. */
  networkIdle?: boolean;
}

/**
 * Wait until a dynamic/SPA page stops thrashing for a short quiet window.
 * Uses a light DOM signature (node count + text length), not full HTML dumps.
 */
export async function settlePage(
  page: Page,
  options: SettleOptions = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 4000;
  const quietMs = options.quietMs ?? 350;
  const deadline = Date.now() + timeoutMs;

  if (options.networkIdle) {
    await page
      .waitForLoadState("networkidle", {
        timeout: Math.min(2500, timeoutMs),
      })
      .catch(() => undefined);
  }

  let lastSig = "";
  let stableSince = Date.now();

  while (Date.now() < deadline) {
    const sig = await page
      .evaluate(`(() => {
        const body = document.body;
        if (!body) return "0:0";
        const nodes = body.querySelectorAll("*").length;
        const textLen = (body.innerText || "").length;
        return nodes + ":" + textLen;
      })()`)
      .catch(() => "err");

    if (sig === lastSig) {
      if (Date.now() - stableSince >= quietMs) return;
    } else {
      lastSig = String(sig);
      stableSince = Date.now();
    }
    await page.waitForTimeout(80);
  }
}
