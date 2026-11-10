/**
 * Captures the `window.location.href` assignments `authService` uses to move
 * between screens.
 *
 * The auth service predates the router — it navigates by assigning to
 * `window.location.href`, which jsdom refuses to honour ("Not implemented:
 * navigation"). Replacing the location object with a recording setter turns
 * those redirects into something a test can assert on, which matters because
 * *where* a user lands is the observable half of the login contract: the numeric
 * code and the destination have to agree.
 *
 * ```ts
 * const navigation = captureNavigation();
 * beforeEach(() => navigation.reset());
 *
 * await fullEmailLogin("eli@kora.test", "pw");
 * expect(navigation.last()).toBe("/employee/home");
 * ```
 */

export interface NavigationCapture {
  /** Every destination assigned to `window.location.href`, in order. */
  visited: string[];
  /** The most recent destination, or null if nothing navigated. */
  last: () => string | null;
  reset: () => void;
}

export const captureNavigation = (): NavigationCapture => {
  const visited: string[] = [];
  let hash = "";

  // jsdom's location is not writable, so swap the whole object out.
  delete (window as { location?: unknown }).location;
  (window as { location: unknown }).location = {
    get href() {
      return visited[visited.length - 1] ?? "";
    },
    set href(value: string) {
      visited.push(value);
      const index = value.indexOf("#");
      hash = index === -1 ? "" : value.slice(index);
    },
    get hash() {
      return hash;
    },
    set hash(value: string) {
      hash = value;
    },
    assign: (value: string) => visited.push(value),
    replace: (value: string) => visited.push(value),
  };

  return {
    visited,
    last: () => visited[visited.length - 1] ?? null,
    reset: () => {
      visited.length = 0;
      hash = "";
    },
  };
};
