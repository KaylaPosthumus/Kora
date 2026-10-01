/**
 * Global Vitest setup — loaded via `setupFiles` in vite.config.ts, so it runs
 * once per test file before any test does.
 *
 * Three jobs: register the jest-dom matchers (`toBeInTheDocument`,
 * `toBeDisabled`, …), unmount rendered components between tests, and fill in the
 * browser APIs jsdom does not implement. Ant Design and MUI both call
 * `matchMedia` on their first render and `ResizeObserver` inside responsive
 * components, and jsdom defines neither — without these stubs a flow test fails
 * on the render call rather than on anything it meant to assert.
 */

import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// The app shell registers the dayjs plugins; a test renders a page without it,
// so a screen calling `.fromNow()` would throw where the running app does not.
import "@/shared/lib/dayjs";

// Testing Library only registers this itself when Vitest runs with `globals`,
// which this project does not — tests import `describe`/`it` explicitly. Without
// it every render stacks up in the same document and `getByRole` starts finding
// the previous test's markup.
afterEach(cleanup);

if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe(): void {
      return undefined;
    }
    unobserve(): void {
      return undefined;
    }
    disconnect(): void {
      return undefined;
    }
  } as unknown as typeof ResizeObserver;
}

// react-bootstrap and antd both scroll things into view on interaction.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => undefined;
}
