import { describe, expect, it } from "vitest";
import {
  fingerprintFromParts,
  pageHintFromUrl,
} from "../src/state/fingerprint.js";

describe("fingerprint helpers", () => {
  it("detects checkout page hints", () => {
    expect(pageHintFromUrl("https://shop.test/checkout", "Shop")).toBe("checkout");
    expect(pageHintFromUrl("https://shop.test/search?q=ssd", "Search")).toBe("search");
  });

  it("is stable for same semantic parts", () => {
    const a = fingerprintFromParts({
      domain: "amazon.com",
      pageHint: "checkout",
      signals: ["cookie_banner", "checkout_available"],
      buttons: ["Accept all", "Checkout"],
      dialogs: ["cookie"],
    });
    const b = fingerprintFromParts({
      domain: "amazon.com",
      pageHint: "checkout",
      signals: ["checkout_available", "cookie_banner"],
      buttons: ["Accept all", "Checkout"],
      dialogs: ["cookie"],
    });
    expect(a).toBe(b);
  });
});
