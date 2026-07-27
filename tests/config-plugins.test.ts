import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadBerConfig } from "../src/config.js";
import { loadConfigSitePlugins, sitePluginFromConfig } from "../src/plugins/loadConfigPlugins.js";
import { createPluginRegistry } from "../src/plugins/registry.js";
import { BuiltinPlanner } from "../src/planner/engine.js";

describe("config-loaded site plugins", () => {
  it("materializes workflows and recovery from JSON", () => {
    const plugin = sitePluginFromConfig({
      id: "acme",
      domains: ["acme.test"],
      workflows: {
        greet: [{ type: "wait", text: "Hello" }],
      },
      recovery: {
        cookie_banner: [[{ type: "dismiss_overlays" }]],
      },
    });
    expect(plugin.workflows?.greet?.[0]?.type).toBe("wait");
    const fixes = plugin.recoveryFixes?.("cookie_banner", {} as never);
    expect(fixes?.[0]?.[0]?.type).toBe("dismiss_overlays");
  });

  it("loads plugins from ber.config.json and pluginsFile", () => {
    const dir = mkdtempSync(join(tmpdir(), "ber-plugins-"));
    const pluginsPath = join(dir, "my-plugins.json");
    writeFileSync(
      pluginsPath,
      JSON.stringify({
        plugins: [
          {
            id: "file-plugin",
            domains: ["file.test"],
            workflows: { ping: [{ type: "observe" }] },
          },
        ],
      }),
    );
    const configPath = join(dir, "ber.config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        plugins: [
          {
            id: "inline-plugin",
            domains: ["inline.test"],
            workflows: { go: [{ type: "dismiss_overlays" }] },
          },
        ],
        pluginsFile: "my-plugins.json",
      }),
    );

    const cfg = loadBerConfig({ configPath, env: {} });
    expect(cfg.configPlugins.map((p) => p.id)).toEqual(["inline-plugin", "file-plugin"]);

    const registry = createPluginRegistry(cfg.configPlugins);
    const steps = registry.workflowsFor("file.test").ping;
    expect(steps?.[0]?.type).toBe("observe");
  });

  it("wires config plugins into BuiltinPlanner workflows", async () => {
    const registry = createPluginRegistry([
      sitePluginFromConfig({
        id: "wf",
        domains: ["wf.test"],
        workflows: {
          hello: [{ type: "wait", text: "ok" }],
        },
      }),
    ]);
    const planner = new BuiltinPlanner(registry);
    const plan = await planner.plan("run hello on wf.test");
    expect(plan?.steps[0]?.action.type).toBe("wait");
  });

  it("rejects duplicate plugin ids", () => {
    expect(() =>
      loadConfigSitePlugins({
        inlinePlugins: [
          { id: "x", domains: [] },
          { id: "x", domains: [] },
        ],
      }),
    ).toThrow(/Duplicate config plugin id/);
  });
});
