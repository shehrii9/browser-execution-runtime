import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ExperienceStore } from "../src/experience/store.js";

const stores: ExperienceStore[] = [];
afterEach(() => {
  while (stores.length) stores.pop()?.close();
});

describe("experience soft match", () => {
  it("matches by signal overlap when fingerprint differs", () => {
    const dir = mkdtempSync(join(tmpdir(), "ber-soft-"));
    const store = new ExperienceStore(join(dir, "experiences.db"));
    stores.push(store);

    store.remember({
      site: "shop.test",
      goal: "checkout",
      stateHash: "fp-old",
      problem: "cookie_banner",
      pageHint: "checkout",
      signals: ["cookie_banner", "checkout_available", "page:checkout"],
      fix: [{ type: "dismiss_overlays" }],
    });

    const found = store.findBest({
      site: "shop.test",
      stateHash: "fp-new",
      problem: "cookie_banner",
      minConfidence: 0.8,
      pageHint: "checkout",
      signals: ["cookie_banner", "checkout_available", "page:checkout", "has_dialog"],
    });

    expect(found?.fix[0]?.type).toBe("dismiss_overlays");
    expect(found?.signals).toContain("cookie_banner");
  });
});
