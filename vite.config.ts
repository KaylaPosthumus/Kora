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
