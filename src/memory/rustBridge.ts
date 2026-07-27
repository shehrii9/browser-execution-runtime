import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

/**
 * Optional Rust-core bridge.
 * When BER_RUST_CORE=1 and `ber-core` is on PATH, fingerprint can be computed
 * by the Rust binary. Default remains the TypeScript implementation.
 */
export function rustCoreEnabled(): boolean {
  return process.env.BER_RUST_CORE === "1" || process.env.BER_RUST_CORE === "true";
}

export function rustCoreAvailable(): boolean {
  const result = spawnSync("ber-core", ["--help"], { encoding: "utf8" });
  return result.status === 0;
}

export function fingerprintViaRust(parts: {
  domain: string;
  pageHint: string;
  signals: string[];
  buttons: string[];
  dialogs: string[];
}): string | null {
  if (!rustCoreEnabled()) return null;
  const args = [
    "fingerprint",
    "--domain",
    parts.domain,
    "--page-hint",
    parts.pageHint,
  ];
  if (parts.signals.length) args.push("--signals", parts.signals.join(","));
  if (parts.buttons.length) args.push("--buttons", parts.buttons.join(","));
  if (parts.dialogs.length) args.push("--dialogs", parts.dialogs.join(","));
  const result = spawnSync("ber-core", args, { encoding: "utf8" });
  if (result.status !== 0) return null;
  try {
    const parsed = JSON.parse(result.stdout) as { fingerprint?: string };
    return parsed.fingerprint ?? null;
  } catch {
    return null;
  }
}

/** Local TS fallback identical to state/fingerprint.ts hashing. */
export function fingerprintLocal(material: string): string {
  return createHash("sha256").update(material).digest("hex").slice(0, 16);
}
