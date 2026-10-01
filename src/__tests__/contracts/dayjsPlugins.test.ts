/**
 * dayjs plugins are registered once, in the shell — not inside a screen.
 *
 * `dayjs.extend` mutates the one instance every module shares, so a plugin
 * registered anywhere appears to work everywhere *in the session that loaded
 * it*. The routes are lazy, so "everywhere" really means "every chunk loaded
 * after that one". `relativeTime` was extended inside
 * `AdminIndividualEmployee`, and the three other screens calling `.fromNow()`
 * threw `dayjs(...).fromNow is not a function` unless an admin had opened that
 * page first — which is why it looked intermittent rather than broken.
 *
 * Neither the type checker nor a render test catches this: `.fromNow()` is
 * typed off the plugin's declaration file, which is global the moment anything
 * imports the plugin, and the Vitest setup imports the shared module for every
 * test. So the invariant is pinned as source text.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import dayjs from "dayjs";

const SRC = resolve(process.cwd(), "src");
const SETUP_MODULE = join(SRC, "shared/lib/dayjs.ts");

/** Every `.ts`/`.tsx` file under `src/`, minus the tests — this file quotes the
 * call it is looking for, and a test double may register what it needs. */
const sources = (): string[] => {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry !== "__tests__") walk(full);
      } else if (/\.tsx?$/.test(full)) out.push(full);
    }
  };
  walk(SRC);
  return out;
};

describe("the dayjs setup module", () => {
  const setup = readFileSync(SETUP_MODULE, "utf8");

  it("is the only place that calls dayjs.extend", () => {
    const offenders = sources()
      .filter((f) => f !== SETUP_MODULE && /\bdayjs\.extend\(/.test(readFileSync(f, "utf8")))
      .map((f) => f.split("/src/")[1]);
    expect(offenders).toEqual([]);
  });

  it("registers every plugin a screen reaches for", () => {
    // `relativeTime` is the one this test exists for; the other three moved out
    // of `utils/dateUtils.ts` with it and would fail the same way.
    for (const plugin of ["relativeTime", "duration", "utc", "timezone"]) {
      expect(setup).toContain(`dayjs.extend(${plugin})`);
    }
  });

  it("is imported by the app shell, before any lazy chunk can run", () => {
    const app = readFileSync(join(SRC, "app/App.tsx"), "utf8");
    expect(app).toMatch(/import "@\/shared\/lib\/dayjs";/);
  });
});

describe("what the plugins give a screen", () => {
  // The Vitest setup imports the shared module, so this asserts the module's
  // contents do what the screens assume — not that any given screen imported it.
  it("has the relative-time methods the employee screens call", () => {
    expect(typeof dayjs().fromNow).toBe("function");
    expect(dayjs().subtract(2, "day").fromNow(true)).toBe("2 days");
  });

  it("has the duration and timezone helpers dateUtils calls", () => {
    expect(typeof dayjs.duration).toBe("function");
    expect(typeof dayjs.tz).toBe("function");
    expect(typeof dayjs().utc).toBe("function");
  });
});
