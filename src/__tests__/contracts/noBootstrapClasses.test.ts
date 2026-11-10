/**
 * No Bootstrap utility classes in the markup.
 *
 * Bootstrap was dropped in commit 56. A class it provided and Tailwind does not
 * simply produces no CSS — nothing errors, nothing fails to build, and the
 * element silently loses that one property.
 *
 * That is not hypothetical. `flex-grow-1` survived the removal on the `<main>`
 * element in the router, so `<main>` stopped growing and EVERY page in the app
 * collapsed to the width of its own content. The tests passed, the build was
 * green, and it took a screenshot to notice.
 *
 * The list below is Bootstrap utilities with no Tailwind equivalent of the same
 * name. Tailwind's own `flex-shrink-0`, `col-span-*`, `sm:flex-row` and the like
 * are not here, and the word-boundary anchors keep them from matching.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/** Every className string literal in `src/`, with the file it came from. */
const classNames = (): { file: string; value: string }[] => {
  const out: { file: string; value: string }[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry !== "__tests__") walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(full)) continue;
      const text = readFileSync(full, "utf8");
      for (const m of text.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
        out.push({ file: full, value: m[1] ?? m[2] ?? "" });
      }
    }
  };
  walk(resolve(process.cwd(), "src"));
  return out;
};

/**
 * Bootstrap-only utilities. Each would have worked before commit 56 and does
 * nothing now.
 *
 * Every entry is checked against what Tailwind actually emits, not against
 * memory — the first draft of this list had `text-nowrap` and `flex-grow-0` in
 * it, and both are real Tailwind 3.4 classes (`flexGrow` is `{0, DEFAULT}`, so
 * `flex-grow-0` is Tailwind's and `flex-grow-1` is Bootstrap's). Before adding
 * one, confirm the built CSS has no rule for it.
 */
const BOOTSTRAP_ONLY = [
  "flex-grow-1",
  "d-flex",
  "d-none",
  "d-block",
  "d-inline",
  "w-100",
  "h-100",
  "w-50",
  "justify-content-center",
  "justify-content-between",
  "align-items-center",
  "align-self-end",
  "align-self-start",
  "form-control",
  "form-select",
];

describe("no Bootstrap utility classes survive", () => {
  const all = classNames();

  it("found className strings to check at all", () => {
    // Without this the assertions below would pass on an empty list.
    expect(all.length).toBeGreaterThan(100);
  });

  it.each(BOOTSTRAP_ONLY)("does not use %s", (cls) => {
    const pattern = new RegExp(`(^|[\\s:])${cls.replace(/-/g, "\\-")}(\\s|$)`);
    const offenders = all
      .filter((c) => pattern.test(c.value))
      .map((c) => `${c.file.split("/src/")[1]}: "${c.value}"`);
    expect(offenders).toEqual([]);
  });
});
