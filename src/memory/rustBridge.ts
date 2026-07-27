import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

/**
 * Optional Rust-core bridge.
 * When BER_RUST_CORE=1 and `ber-core` is on PATH, fingerprint + L3 hashing
 * embeddings can be computed by the Rust binary. Default remains TypeScript.
 */
export function rustCoreEnabled(): boolean {
  return process.env.BER_RUST_CORE === "1" || process.env.BER_RUST_CORE === "true";
}

export function rustCoreAvailable(): boolean {
  const result = spawnSync("ber-core", ["--help"], { encoding: "utf8" });
  return result.status === 0;
}

function runBerCore(args: string[]): { ok: boolean; stdout: string } {
  const result = spawnSync("ber-core", args, {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  return { ok: result.status === 0, stdout: result.stdout ?? "" };
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
  const { ok, stdout } = runBerCore(args);
  if (!ok) return null;
  try {
    const parsed = JSON.parse(stdout) as { fingerprint?: string };
    return parsed.fingerprint ?? null;
  } catch {
    return null;
  }
}

/** L3 hashing embed via `ber-core embed`. Returns null when disabled or on failure. */
export function embedTextViaRust(text: string): Float32Array | null {
  if (!rustCoreEnabled()) return null;
  const { ok, stdout } = runBerCore(["embed", text]);
  if (!ok) return null;
  try {
    const parsed = JSON.parse(stdout) as { vector?: number[]; dim?: number };
    const values = parsed.vector;
    if (!values?.length) return null;
    return Float32Array.from(values);
  } catch {
    return null;
  }
}

/** Local TS fallback identical to state/fingerprint.ts hashing. */
export function fingerprintLocal(material: string): string {
  return createHash("sha256").update(material).digest("hex").slice(0, 16);
}
