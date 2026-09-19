import { defineConfig } from "vitest/config";

/**
 * The functions package is a separate tree from the browser app: Node
 * environment, its own dependencies, its own runner. The root Vitest config
 * globs `src/**` from the repo root, which does not reach `functions/src`, so
 * the two suites never collide.
 */
export default defineConfig({
  // An inline, empty PostCSS config. Without it Vite searches upward for one,
  // finds the web app's postcss.config.js at the repo root, and fails to load
  // its tailwindcss plugin — which this package does not install. It only
  // passes locally because the root node_modules happens to be there; in CI,
  // where each job installs just its own package, every run failed on it.
  css: { postcss: {} },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    restoreMocks: true,
  },
});
