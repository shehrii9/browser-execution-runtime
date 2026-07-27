import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ExperienceStore } from "../src/experience/store.js";

const dir = mkdtempSync(join(tmpdir(), "ber-ci-exp-"));
const store = new ExperienceStore(join(dir, "experiences.db"));

try {
  const saved = await store.remember({
    site: "ci.test",
    goal: "smoke",
    stateHash: "fp",
    problem: "cookie_banner",
    fix: [{ type: "dismiss_overlays" }],
  });
  const found = await store.findBest({
    site: "ci.test",
    stateHash: "fp",
    problem: "cookie_banner",
    minConfidence: 0.8,
  });
  if (!found || found.id !== saved.id) {
    console.error("experience smoke failed");
    process.exit(1);
  }
  console.log("experience smoke ok");
} finally {
  store.close();
}
