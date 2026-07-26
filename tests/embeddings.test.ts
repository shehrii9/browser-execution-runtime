import { describe, expect, it } from "vitest";
import {
  cosineSimilarity,
  embedExperience,
  embedText,
} from "../src/memory/embeddings.js";

describe("local embeddings", () => {
  it("is similar for related experience contexts", () => {
    const a = embedExperience({
      site: "shop.test",
      problem: "cookie_banner",
      pageHint: "checkout",
      signals: ["cookie_banner", "checkout_available"],
    });
    const b = embedExperience({
      site: "shop.test",
      problem: "cookie_banner",
      pageHint: "checkout",
      signals: ["cookie_banner", "has_dialog"],
    });
    const c = embedExperience({
      site: "news.test",
      problem: "navigation_timeout",
      pageHint: "home",
      signals: ["page:home"],
    });

    expect(cosineSimilarity(a, b)).toBeGreaterThan(cosineSimilarity(a, c));
    expect(embedText("cookie banner checkout").length).toBe(128);
  });
});
