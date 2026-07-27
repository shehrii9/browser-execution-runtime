import { runAllReplayScenarios } from "./replay-runner.js";

async function main(): Promise<void> {
  const onlyIdx = process.argv.indexOf("--only");
  const filter =
    onlyIdx >= 0 ? process.argv.slice(onlyIdx + 1).filter((a) => !a.startsWith("-")) : undefined;
  await runAllReplayScenarios(filter);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
