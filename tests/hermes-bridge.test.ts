import { describe, expect, it, vi } from "vitest";
import { HermesToolBridge } from "../src/hermes/bridge.js";
import { HermesRuntimeClient } from "../src/hermes/client.js";

describe("HermesToolBridge", () => {
  it("routes browser_execute to client.execute", async () => {
    const client = {
      execute: vi.fn(async () => ({ ok: true, goal: "x", steps: [], llmCallsAvoided: 0 })),
    } as unknown as HermesRuntimeClient;
    const bridge = new HermesToolBridge(client);
    const result = await bridge.handle({
      name: "browser_execute",
      arguments: { intent: "open https://example.com" },
    });
    expect(client.execute).toHaveBeenCalledWith("open https://example.com");
    expect(result).toMatchObject({ ok: true });
  });
});
