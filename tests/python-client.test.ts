import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Python client parity", () => {
  const src = readFileSync(
    resolve("sdk/python/browser_execution_runtime/client.py"),
    "utf8",
  );

  it("exposes daemon HTTP methods", () => {
    for (const name of [
      "def health",
      "def status",
      "def observe",
      "def diff",
      "def experiences",
      "def metrics",
      "def tabs",
      "def plugins",
      "def events",
      "def attach",
      "def act",
      "def execute",
      "def run",
      "def resume",
      "def new_tab",
      "def switch_tab",
      "def close_tab",
      "def set_policy",
      "def remember",
      "def close",
      "def call_tool",
    ]) {
      expect(src).toContain(name);
    }
  });

  it("maps browser_diff and browser_events tools", () => {
    expect(src).toContain('name == "browser_diff"');
    expect(src).toContain('name == "browser_events"');
  });
});
