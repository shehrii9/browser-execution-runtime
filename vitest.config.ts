import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/browser-smoke.test.ts"],
<<<<<<< Updated upstream
    fileParallelism: false,
    maxWorkers: 1,
=======
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    fileParallelism: false,
>>>>>>> Stashed changes
  },
});
