/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        /**
         * One vendor chunk, and only one.
         *
         * The instinct is to name every big dependency here. Measured, that made
         * first paint *worse*: naming a package forces all of it into one chunk,
         * which defeats the tree-shaking that would otherwise leave the unused
         * parts behind. Splitting out `antd` cost 189 kB gzipped on first paint
         * (583 kB against 394 kB) — the login screen uses four antd components
         * and was made to download all of them.
         *
         * `@mui/x-charts` was worse than useless. It depends on `@mui/material`,
         * which every `@mui/icons-material` icon also depends on, so naming it
         * pulled the chart chunk into the entry's static graph and Vite preloaded
         * 464 kB of charting on first paint — for a screen most users never open.
         * Left unnamed, the charts stay with the lazy dashboard route.
         *
         * Firebase stays named: it is a third-party runtime the app tree-shakes
         * little of anyway, and its own chunk means a deploy that changes only
         * app code leaves it cached.
         */
        manualChunks: {
          firebase: [
            "firebase/app",
            "firebase/auth",
            "firebase/firestore",
            "firebase/storage",
            "firebase/functions",
          ],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    // Registers the jest-dom matchers and the jsdom polyfills antd/MUI need.
    setupFiles: ["./src/test/setup.ts"],
    // dayjs parses and formats in the local zone, so a date assertion that
    // passes here would fail on CI (UTC) or for a colleague in another zone.
    // Pin the whole suite to one zone instead.
    env: { TZ: "UTC" },
    // Two tiers, told apart by filename: `*.flow.test.*` drives a whole
    // journey, everything else is a unit test. See `npm run test:unit` /
    // `npm run test:flows` and src/test/README.md.
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    restoreMocks: true,
  },
});
