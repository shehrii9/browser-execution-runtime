import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadBerConfig } from "../src/config.js";

describe("loadBerConfig", () => {
  it("loads config without requiring an API key", () => {
    const dir = mkdtempSync(join(tmpdir(), "ber-cfg-"));
    const path = join(dir, "ber.config.json");
    writeFileSync(
      path,
      JSON.stringify({
        runtime: { port: 9090, headless: true },
        llm: {
          apiBase: "http://127.0.0.1:11434/v1",
          apiKey: null,
          model: "llama3.2",
        },
      }),
    );

    const cfg = loadBerConfig({
      configPath: path,
      env: {},
    });

    expect(cfg.port).toBe(9090);
    expect(cfg.llm.apiBase).toBe("http://127.0.0.1:11434/v1");
    expect(cfg.llm.apiKey).toBeUndefined();
    expect(cfg.llm.model).toBe("llama3.2");
  });

  it("resolves env:SECRET references and lets env override file", () => {
    const dir = mkdtempSync(join(tmpdir(), "ber-cfg-"));
    const path = join(dir, "ber.config.json");
    writeFileSync(
      path,
      JSON.stringify({
        llm: {
          apiBase: "http://file.local/v1",
          apiKey: "env:MY_KEY",
          model: "file-model",
        },
      }),
    );

    const cfg = loadBerConfig({
      configPath: path,
      env: {
        MY_KEY: "abc123",
        BER_LLM_API_BASE: "http://env.local/v1",
        BER_LLM_MODEL: "env-model",
      },
    });

    expect(cfg.llm.apiBase).toBe("http://env.local/v1");
    expect(cfg.llm.model).toBe("env-model");
    expect(cfg.llm.apiKey).toBe("abc123");
  });
});
