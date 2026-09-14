import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Rules tests share one emulator and clear it between tests, so they must
    // not run concurrently — a parallel file would wipe another's fixtures.
    fileParallelism: false,
    // The emulator is a local Java process; a cold first request can be slow.
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
