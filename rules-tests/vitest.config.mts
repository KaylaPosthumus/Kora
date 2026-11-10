import { defineConfig } from "vitest/config";

export default defineConfig({
  // An inline, empty PostCSS config. Without it Vite searches upward for one,
  // finds the web app's postcss.config.js at the repo root, and fails to load
  // its tailwindcss plugin — which this package does not install. It only
  // passes locally because the root node_modules happens to be there; in CI,
  // where each job installs just its own package, every run failed on it.
  css: { postcss: {} },
  test: {
    // Rules tests share one emulator and clear it between tests, so they must
    // not run concurrently — a parallel file would wipe another's fixtures.
    fileParallelism: false,
    // The emulator is a local Java process; a cold first request can be slow.
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
