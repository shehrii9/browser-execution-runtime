import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ExperienceStore } from "../src/experience/store.js";

const stores: ExperienceStore[] = [];

afterEach(() => {
  while (stores.length) {
    stores.pop()?.close();
  }
});

describe("ExperienceStore", () => {
  it("remembers and retrieves high-confidence fixes", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ber-exp-"));
    const store = new ExperienceStore(join(dir, "experiences.db"));
    stores.push(store);

    const saved = await store.remember({
      site: "shop.test",
      goal: "checkout",
      stateHash: "fp1",
      problem: "cookie_banner",
      fix: [{ type: "dismiss_overlays" }],
    });

    expect(saved.confidence).toBe(1);
    expect(store.count()).toBe(1);

    const found = await store.findBest({
      site: "shop.test",
      stateHash: "fp1",
      problem: "cookie_banner",
      minConfidence: 0.8,
    });
    expect(found?.id).toBe(saved.id);
    expect(found?.fix[0]?.type).toBe("dismiss_overlays");
  });
});
