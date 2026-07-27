import { describe, expect, it } from "vitest";
import { fingerprintFromParts } from "../src/state/fingerprint.js";
import { rustCoreEnabled, fingerprintViaRust } from "../src/memory/rustBridge.js";
import { collectPiercedInteractiveNodes } from "../src/state/pierce.js";

describe("later-items: pierce + rust bridge", () => {
  it("keeps TS fingerprints stable", () => {
    const a = fingerprintFromParts({
      domain: "example.com",
      pageHint: "watch",
      signals: ["media_site", "cookie_banner"],
      buttons: ["Play"],
      dialogs: [],
    });
    const b = fingerprintFromParts({
      domain: "example.com",
      pageHint: "watch",
      signals: ["cookie_banner", "media_site"],
      buttons: ["Play"],
      dialogs: [],
    });
    expect(a).toBe(b);
    expect(a).toHaveLength(16);
  });

  it("rust bridge stays inert unless BER_RUST_CORE is set", () => {
    const prev = process.env.BER_RUST_CORE;
    delete process.env.BER_RUST_CORE;
    expect(rustCoreEnabled()).toBe(false);
    expect(
      fingerprintViaRust({
        domain: "x.com",
        pageHint: "page",
        signals: [],
        buttons: [],
        dialogs: [],
      }),
    ).toBeNull();
    if (prev === undefined) delete process.env.BER_RUST_CORE;
    else process.env.BER_RUST_CORE = prev;
  });

  it("pierce helper returns empty array when page CDP is unavailable", async () => {
    const fakePage = {
      context: () => ({
        newCDPSession: async () => {
          throw new Error("no cdp");
        },
      }),
    };
    await expect(collectPiercedInteractiveNodes(fakePage as never)).resolves.toEqual([]);
  });
});
