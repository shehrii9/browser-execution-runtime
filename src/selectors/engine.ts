import type { Locator, Page } from "playwright";
import type { TargetRef } from "../types.js";

export class SelectorEngine {
  constructor(private readonly page: Page) {}

  locate(target: TargetRef): Locator {
    let locator: Locator | undefined;

    if (target.css) {
      locator = this.page.locator(target.css);
    } else if (target.testId) {
      locator = this.page.getByTestId(target.testId);
    } else if (target.role && target.name) {
      locator = this.page.getByRole(target.role as Parameters<Page["getByRole"]>[0], {
        name: new RegExp(escapeRegExp(target.name), "i"),
      });
    } else if (target.role) {
      locator = this.page.getByRole(target.role as Parameters<Page["getByRole"]>[0]);
    } else if (target.placeholder) {
      locator = this.page.getByPlaceholder(new RegExp(escapeRegExp(target.placeholder), "i"));
    } else if (target.text) {
      locator = this.page.getByText(new RegExp(escapeRegExp(target.text), "i"));
    } else if (target.name) {
      locator = this.page
        .getByRole("button", { name: new RegExp(escapeRegExp(target.name), "i") })
        .or(this.page.getByRole("link", { name: new RegExp(escapeRegExp(target.name), "i") }))
        .or(this.page.getByLabel(new RegExp(escapeRegExp(target.name), "i")));
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
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
