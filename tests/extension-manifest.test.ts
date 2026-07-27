import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const extensionDir = join(dirname(fileURLToPath(import.meta.url)), "../extension");

describe("BER debug extension manifest", () => {
  it("declares observe-tab command and local daemon hosts", () => {
    const manifest = JSON.parse(
      readFileSync(join(extensionDir, "manifest.json"), "utf8"),
    ) as {
      manifest_version: number;
      version: string;
      permissions: string[];
      host_permissions: string[];
      commands: Record<string, unknown>;
    };
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(manifest.permissions).toContain("tabs");
    expect(manifest.host_permissions.some((h) => h.includes("127.0.0.1"))).toBe(true);
    expect(manifest.commands["observe-tab"]).toBeTruthy();
  });
});
