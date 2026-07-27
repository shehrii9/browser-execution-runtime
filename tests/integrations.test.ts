import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AGENT_TOOLS } from "../src/agent/tools.js";
import {
  TOOL_HTTP_ROUTES,
  getToolRoute,
  listRoutedToolNames,
} from "../src/agent/toolRoutes.js";

const root = resolve(process.cwd());

describe("agent tool routes", () => {
  it("covers every AGENT_TOOLS entry", () => {
    const toolNames = AGENT_TOOLS.map((t) => t.function.name).sort();
    const routeNames = listRoutedToolNames().sort();
    expect(routeNames).toEqual(toolNames);
  });

  it("maps tools to expected HTTP methods/paths", () => {
    expect(getToolRoute("browser_attach")).toEqual({
      method: "POST",
      path: "/attach",
    });
    expect(getToolRoute("browser_observe")).toEqual({
      method: "GET",
      path: "/observe",
    });
    expect(() => getToolRoute("browser_nope")).toThrow(/Unknown browser tool route/);
  });
});

describe("examples/agent-tools.json sync", () => {
  it("matches AGENT_TOOLS names and stays non-empty", () => {
    const file = JSON.parse(
      readFileSync(resolve(root, "examples/agent-tools.json"), "utf8"),
    ) as { tools: Array<{ function: { name: string } }> };
    const fileNames = file.tools.map((t) => t.function.name).sort();
    const codeNames = AGENT_TOOLS.map((t) => t.function.name).sort();
    expect(fileNames).toEqual(codeNames);
    expect(fileNames.length).toBeGreaterThanOrEqual(7);
  });
});

describe("Cursor + Codex integration templates", () => {
  const cursorRule = resolve(root, ".cursor/rules/ber-runtime.mdc");
  const cursorSnippet = resolve(root, "examples/integrations/cursor-rules.md");
  const codexPrompt = resolve(root, "examples/integrations/codex-prompt.md");
  const toolHttp = resolve(root, "examples/integrations/toolHttp.mjs");
  const modalPlaybook = resolve(root, "examples/integrations/modal-playbook.md");

  it("ships Cursor rules and Codex prompt files", () => {
    expect(existsSync(cursorRule)).toBe(true);
    expect(existsSync(cursorSnippet)).toBe(true);
    expect(existsSync(codexPrompt)).toBe(true);
    expect(existsSync(toolHttp)).toBe(true);
    expect(existsSync(modalPlaybook)).toBe(true);
  });

  it("documents BER daemon URL and anti-computer-use preference", () => {
    const rule = readFileSync(cursorRule, "utf8");
    const snippet = readFileSync(cursorSnippet, "utf8");
    const prompt = readFileSync(codexPrompt, "utf8");

    for (const text of [rule, snippet, prompt]) {
      expect(text).toContain("127.0.0.1:8787");
      expect(text).toMatch(/computer-use/i);
      expect(text).toContain("browser_attach");
      expect(text).toContain("browser_run_plan");
      expect(text).toContain("browser_observe");
      expect(text).toMatch(/modal:(cookie|login)/);
      expect(text).toMatch(/No API key/i);
    }
  });

  it("documents the same tool→HTTP routes as TOOL_HTTP_ROUTES", () => {
    const rule = readFileSync(cursorRule, "utf8");
    const prompt = readFileSync(codexPrompt, "utf8");
    for (const [name, route] of Object.entries(TOOL_HTTP_ROUTES)) {
      expect(rule).toContain(name);
      expect(rule).toContain(route.path);
      expect(prompt).toContain(name);
      expect(prompt).toContain(route.path);
    }
  });

  it("keeps example JS route table aligned with source routes", async () => {
    const mod = await import("../examples/integrations/toolHttp.mjs");
    expect(Object.keys(mod.TOOL_HTTP_ROUTES).sort()).toEqual(
      listRoutedToolNames().sort(),
    );
    for (const name of listRoutedToolNames()) {
      expect(mod.TOOL_HTTP_ROUTES[name]).toEqual(TOOL_HTTP_ROUTES[name]);
    }
  });
});

describe("callBerTool helper", () => {
  it("issues the correct HTTP call for POST and GET tools", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ ok: true, url, method: init?.method ?? "GET" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const mod = await import("../examples/integrations/toolHttp.mjs");
    await mod.callBerTool("http://127.0.0.1:8787", "browser_attach", {
      startUrl: "https://example.com",
    }, fetchImpl);
    await mod.callBerTool("http://127.0.0.1:8787/", "browser_observe", {}, fetchImpl);

    expect(calls[0]?.url).toBe("http://127.0.0.1:8787/attach");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      startUrl: "https://example.com",
    });
    expect(calls[1]?.url).toBe("http://127.0.0.1:8787/observe");
    expect(calls[1]?.init?.method ?? "GET").toBe("GET");
  });
});
