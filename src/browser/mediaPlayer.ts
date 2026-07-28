import type { Page } from "playwright";

/**
 * Locators for media players. Avoid `[class*='player']` — it matches hidden
 * script tags on sites like YouTube (`miniplayer.js` class names).
 */
export const MEDIA_PLAYER_TARGET_CSS =
  "video, audio, .html5-video-player, #movie_player, ytd-player, .vp-video-wrapper, iframe[src*='player'], iframe[src*='embed']";

/**
 * Wait until a video/audio element has meaningful layout (not Playwright
 * "visible", which fails when players use opacity/stacking tricks).
 */
export async function waitForPlayableMedia(
  page: Page,
  timeoutMs: number,
): Promise<void> {
  await page.waitForFunction(
    () => {
      const nodes = Array.from(document.querySelectorAll("video, audio"));
      for (const el of nodes) {
        const rect = el.getBoundingClientRect();
        const area = Math.max(0, rect.width) * Math.max(0, rect.height);
        if (area < 100) continue;
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") continue;
        return true;
      }
      return false;
    },
    undefined,
    { timeout: timeoutMs },
  );
}

/** True when a wait target uses the legacy broad player CSS selector. */
export function isLegacyBroadPlayerCss(css: string): boolean {
  return /\[class\*=['"]player['"]\]/i.test(css);
}
