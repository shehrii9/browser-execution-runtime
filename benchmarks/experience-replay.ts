import { runReplayScenario } from "./replay-runner.js";

/**
 * @deprecated Use `npm run bench:replay` (all scenarios) or `bench:replay -- --only cookie-shop`
 */
async function main(): Promise<void> {
  const report = await runReplayScenario("cookie-shop");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
