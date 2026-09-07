import { defineConfig } from "vitest/config";

/**
 * The functions package is a separate tree from the browser app: Node
 * environment, its own dependencies, its own runner. The root Vitest config
 * globs `src/**` from the repo root, which does not reach `functions/src`, so
 * the two suites never collide.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    restoreMocks: true,
  },
});
