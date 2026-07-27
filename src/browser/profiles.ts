import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Persistent profile used when an agent asks for profile="persistent".
 * This is a dedicated automation profile, not your daily Chrome profile
 * (locking/concurrency issues). For real logged-in Chrome, prefer cdpUrl.
 */
export function defaultPersistentProfileDir(
  dataDir = process.env.BER_DATA_DIR ?? "data",
): string {
  return join(dataDir, "chrome-profile");
}

/** Common system Chrome user-data locations (informational / advanced use). */
export function detectSystemChromeUserDataCandidates(): string[] {
  const home = homedir();
  return [
    join(home, ".config", "google-chrome"),
    join(home, ".config", "chromium"),
    join(home, "Library", "Application Support", "Google", "Chrome"),
    join(home, "AppData", "Local", "Google", "Chrome", "User Data"),
  ];
}
