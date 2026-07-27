import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AGENT_TOOLS } from "../src/agent/tools.js";
import { createBerMcpServer } from "../src/mcp/server.js";
import { openAiParametersToZodShape } from "../src/mcp/schema.js";

describe("MCP schema helpers", () => {
  it("parses browser_execute parameters with required intent", () => {
    const tool = AGENT_TOOLS.find((t) => t.function.name === "browser_execute")!;
    const schema = openAiParametersToZodShape(tool.function.parameters);
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ intent: "open https://example.com" }).success).toBe(true);
  });

  it("allows optional browser_events filters", () => {
    const tool = AGENT_TOOLS.find((t) => t.function.name === "browser_events")!;
    const schema = openAiParametersToZodShape(tool.function.parameters);
    expect(schema.safeParse({}).success).toBe(true);
    expect(schema.safeParse({ afterId: 1, limit: 10, type: "dom_change" }).success).toBe(
      true,
    );
  });
});

describe("createBerMcpServer", () => {
  it("registers one MCP tool per AGENT_TOOLS entry", () => {
    const server = createBerMcpServer({ baseUrl: "http://127.0.0.1:9" });
    expect(server).toBeTruthy();
    expect(AGENT_TOOLS.length).toBe(9);
    expect(z).toBeDefined();
  });
});
