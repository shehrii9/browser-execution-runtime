import type { Frame, FrameLocator, Locator, Page } from "playwright";
import type { TargetRef } from "../types.js";

type Scope = Page | Frame | FrameLocator;

export class SelectorEngine {
  constructor(private readonly page: Page) {}

  locate(target: TargetRef): Locator {
    const scope = this.resolveScope(target);
    let locator: Locator | undefined;

    // Prefer role/text (a11y tree) — often reaches into shadow trees better than raw CSS.
    if (target.css) {
      locator = scope.locator(target.css);
    } else if (target.testId) {
      locator = scope.getByTestId(target.testId);
    } else if (target.role && target.name) {
      locator = scope.getByRole(target.role as Parameters<Page["getByRole"]>[0], {
        name: new RegExp(escapeRegExp(target.name), "i"),
      });
    } else if (target.role) {
      locator = scope.getByRole(target.role as Parameters<Page["getByRole"]>[0]);
    } else if (target.placeholder) {
      locator = scope.getByPlaceholder(new RegExp(escapeRegExp(target.placeholder), "i"));
    } else if (target.text) {
      locator = scope.getByText(new RegExp(escapeRegExp(target.text), "i"));
    } else if (target.name) {
      locator = scope
        .getByRole("button", { name: new RegExp(escapeRegExp(target.name), "i") })
        .or(scope.getByRole("link", { name: new RegExp(escapeRegExp(target.name), "i") }))
        .or(scope.getByLabel(new RegExp(escapeRegExp(target.name), "i")));
    }

    if (!locator) {
      throw new Error(`Target is under-specified: ${JSON.stringify(target)}`);
    }

    if (typeof target.nth === "number") {
      locator = locator.nth(target.nth);
    } else {
      locator = locator.first();
    }
    return locator;
  }

  async exists(target: TargetRef, timeoutMs = 1500): Promise<boolean> {
    try {
      await this.locate(target).waitFor({ state: "visible", timeout: timeoutMs });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Resolve action scope.
   * Prefer Playwright Frame objects (works for cross-origin) when frameUrl/name/index set.
   * Fall back to frameLocator CSS for same-document iframe selectors.
   */
  private resolveScope(target: TargetRef): Scope {
    if (typeof target.frameIndex === "number") {
      const frames = this.page.frames();
      const frame = frames[target.frameIndex];
      if (!frame) {
        throw new Error(
          `frameIndex ${target.frameIndex} out of range (frames=${frames.length})`,
        );
      }
      return frame;
    }

    if (target.frameName) {
      const frame =
        this.page.frame({ name: target.frameName }) ??
        this.page.frames().find((f) => f.name() === target.frameName);
      if (frame) return frame;
    }

    if (target.frameUrl) {
      const needle = target.frameUrl.toLowerCase();
      const frame = this.page
        .frames()
        .find(
          (f) =>
            f !== this.page.mainFrame() &&
            f.url().toLowerCase().includes(needle),
        );
      if (frame) return frame;
      // Fallback: iframe src attribute locator (same-origin / src-visible cases).
      return this.page.frameLocator(`iframe[src*="${cssAttrEscape(target.frameUrl)}"]`);
    }

    if (target.frame) {
      return this.page.frameLocator(target.frame);
    }

    return this.page;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cssAttrEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
