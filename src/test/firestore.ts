/**
 * An in-memory stand-in for `firebase/firestore`.
 *
 * The unit tests under `src/services/__tests__` each hand-roll their own mock,
 * which is fine when a test only needs one or two SDK calls. A flow test drives
 * several service functions in sequence — submit a leave request, list it, then
 * approve it — and needs the second call to see what the first one wrote. That
 * needs a store, not a set of stubs, so this file provides one.
 *
 * ## Using it
 *
 * `vi.mock` is hoisted above the imports, so the factory cannot close over a
 * value defined in the test file. Import the module inside the factory instead:
 *
 * ```ts
 * vi.mock("firebase/firestore", async () => (await import("@/test/firestore")).firestoreModule());
 * vi.mock("@/test/firebaseApp");
 * vi.mock("@/services/firebase", async () => (await import("@/test/firebaseApp")).firebaseAppModule());
 *
 * import { firestoreMock } from "@/test/firestore";
 *
 * beforeEach(() => firestoreMock.reset());
 * ```
 *
 * The store lives on `globalThis`, not in this module's scope, so a test that
 * calls `vi.resetModules()` (as the authService tests do) keeps talking to the
 * same data instead of silently getting a fresh empty one.
 *
 * ## What it models, and what it does not
 *
 * Documents are a flat map from slash-separated path to data, which is what
 * makes subcollections work for free: `employees/emp1/leaveBalances/annual` is
 * just a key, and its collection is everything sharing the `…/leaveBalances`
 * prefix. `collectionGroup` matches on the second-to-last segment.
 *
 * Queries support the operators the feature API modules actually use — `==` and `in`,
 * plus `orderBy` and `limit` — and `where(documentId(), "in", …)` filters on the
 * key rather than a field. Anything else throws rather than quietly returning
 * every document, so a query the double cannot honour fails loudly.
 *
 * `onSnapshot` emits **synchronously**: once on subscribe and again after any
 * write that changes the query's results. Real Firestore emits on a microtask.
 * Synchronous emission means a flow test can assert straight after the write
 * with no `await` dance, and the production code is indifferent — `subscribePair`
 * only emits once both of its listeners have delivered either way.
 *
 * Auto-generated ids are sequential (`auto-1`, `auto-2`, …) and reset with the
 * store, so a test can assert on the id of a document it just created.
 */

// Types ----------------------------------------------------------------------

export type DocData = Record<string, any>;

type WhereOp = "==" | "in";

interface DocRef {
  __kind: "doc";
  path: string;
  id: string;
}

interface CollectionRef {
  __kind: "collection";
  path: string;
  id: string;
}

interface CollectionGroupRef {
  __kind: "collectionGroup";
  id: string;
}

interface WhereConstraint {
  __kind: "where";
  field: string;
  op: WhereOp;
  value: any;
}

interface OrderByConstraint {
  __kind: "orderBy";
  field: string;
  direction: "asc" | "desc";
}

interface LimitConstraint {
  __kind: "limit";
  count: number;
}

type Constraint = WhereConstraint | OrderByConstraint | LimitConstraint;

interface QueryRef {
  __kind: "query";
  source: Source;
  constraints: Constraint[];
}

type Source = CollectionRef | CollectionGroupRef | QueryRef;

/** What a test sees when it inspects a document snapshot. */
interface DocSnapshot {
  id: string;
  ref: DocRef;
  exists: () => boolean;
  data: () => DocData | undefined;
}

interface QuerySnapshot {
  docs: DocSnapshot[];
  size: number;
  empty: boolean;
  forEach: (fn: (doc: DocSnapshot) => void) => void;
}

interface Listener {
  source: DocRef | Source;
  onNext: (snapshot: any) => void;
  onError?: (error: any) => void;
  /** Serialised last emission, so an unrelated write does not re-emit. */
  last: string | null;
  live: boolean;
}

// The store ------------------------------------------------------------------

/** Every write the code under test performed, in order. Useful for assertions. */
export interface WriteRecord {
  op: "set" | "update" | "delete";
  path: string;
  data?: DocData;
}

interface Store {
  docs: Map<string, DocData>;
  listeners: Listener[];
  writes: WriteRecord[];
  autoId: number;
  clock: number;
}

const GLOBAL_KEY = "__koraFirestoreMock__";

const store = (): Store => {
  const host = globalThis as Record<string, any>;
  if (!host[GLOBAL_KEY]) {
    host[GLOBAL_KEY] = {
      docs: new Map<string, DocData>(),
      listeners: [],
      writes: [],
      autoId: 0,
      clock: 0,
    } satisfies Store;
  }
  return host[GLOBAL_KEY] as Store;
};

// Path helpers ---------------------------------------------------------------

const idOf = (path: string) => path.slice(path.lastIndexOf("/") + 1);
const parentOf = (path: string) => path.slice(0, path.lastIndexOf("/"));

const docRef = (path: string): DocRef => ({ __kind: "doc", path, id: idOf(path) });

/** Deep clone on the way in and out, so a caller cannot mutate the store by reference. */
const clone = <T>(value: T): T =>
  value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);

// Query evaluation -----------------------------------------------------------

const DOCUMENT_ID = "__name__";

const fieldValue = (path: string, data: DocData, field: string) =>
  field === DOCUMENT_ID ? idOf(path) : data[field];

const matches = (path: string, data: DocData, constraint: WhereConstraint) => {
  const actual = fieldValue(path, data, constraint.field);

  switch (constraint.op) {
    case "==":
      return actual === constraint.value;
    case "in":
      return Array.isArray(constraint.value) && constraint.value.includes(actual);
    default:
      // Loudly, rather than returning everything and making a test pass for the
      // wrong reason. Add the operator here when a feature API module starts using it.
      throw new Error(`firestore mock: unsupported where operator "${constraint.op}"`);
  }
};

const compare = (a: any, b: any) => {
  if (a === b) return 0;
  if (a === undefined || a === null) return -1;
  if (b === undefined || b === null) return 1;
  return a < b ? -1 : 1;
};

/** All `[path, data]` pairs a collection / collection-group / query resolves to. */
const resolve = (source: DocRef | Source): Array<[string, DocData]> => {
  const { docs } = store();

  if (source.__kind === "doc") {
    const data = docs.get(source.path);
    return data === undefined ? [] : [[source.path, data]];
  }

  if (source.__kind === "collection") {
    return [...docs.entries()].filter(([path]) => parentOf(path) === source.path);
  }

  if (source.__kind === "collectionGroup") {
    // The subcollection name sits directly above the document id.
    return [...docs.entries()].filter(([path]) => idOf(parentOf(path)) === source.id);
  }

  let results = resolve(source.source);

  for (const constraint of source.constraints) {
    if (constraint.__kind === "where") {
      results = results.filter(([path, data]) => matches(path, data, constraint));
    } else if (constraint.__kind === "orderBy") {
      const direction = constraint.direction === "desc" ? -1 : 1;
      results = [...results].sort(
        ([pathA, a], [pathB, b]) =>
          direction *
          compare(
            fieldValue(pathA, a, constraint.field),
            fieldValue(pathB, b, constraint.field)
          )
      );
    } else {
      results = results.slice(0, constraint.count);
    }
  }

  return results;
};

const toDocSnapshot = ([path, data]: [string, DocData]): DocSnapshot => ({
  id: idOf(path),
  ref: docRef(path),
  exists: () => true,
  data: () => clone(data),
});

const toQuerySnapshot = (entries: Array<[string, DocData]>): QuerySnapshot => {
  const docs = entries.map(toDocSnapshot);
  return {
    docs,
    size: docs.length,
    empty: docs.length === 0,
    forEach: (fn) => docs.forEach(fn),
  };
};

// Writes ---------------------------------------------------------------------

const SERVER_TIMESTAMP = { __serverTimestamp: true } as const;

/** Replaces serverTimestamp() sentinels with an advancing ISO string. */
const materialise = (value: any): any => {
  if (value === SERVER_TIMESTAMP || value?.__serverTimestamp === true) {
    const state = store();
    state.clock += 1000;
    return new Date(Date.UTC(2026, 0, 1) + state.clock).toISOString();
  }
  if (Array.isArray(value)) return value.map(materialise);
  if (value && typeof value === "object" && value.constructor === Object) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, materialise(v)]));
  }
  return value;
};

const applySet = (path: string, data: DocData) => {
  const state = store();
  const written = materialise(clone(data));
  state.docs.set(path, written);
  state.writes.push({ op: "set", path, data: written });
};

const applyUpdate = (path: string, data: DocData) => {
  const state = store();
  const existing = state.docs.get(path);
  if (existing === undefined) {
    // Firestore rejects an update to a missing document; a mock that silently
    // created it would hide a real bug.
    throw new Error(`firestore mock: cannot update missing document "${path}"`);
  }
  const written = materialise(clone(data));
  state.docs.set(path, { ...existing, ...written });
  state.writes.push({ op: "update", path, data: written });
};

const applyDelete = (path: string) => {
  const state = store();
  state.docs.delete(path);
  state.writes.push({ op: "delete", path });
};

/** Re-runs every live listener and emits the ones whose results changed. */
const notify = () => {
  for (const listener of [...store().listeners]) {
    if (!listener.live) continue;

    if (listener.source.__kind === "doc") {
      const data = store().docs.get(listener.source.path);
      const serialised = JSON.stringify(data ?? null);
      if (serialised === listener.last) continue;
      listener.last = serialised;
      const path = listener.source.path;
      listener.onNext({
        id: idOf(path),
        ref: docRef(path),
        exists: () => data !== undefined,
        data: () => clone(data),
      });
      continue;
    }

    const entries = resolve(listener.source);
    const serialised = JSON.stringify(entries);
    if (serialised === listener.last) continue;
    listener.last = serialised;
    listener.onNext(toQuerySnapshot(entries));
  }
};

// The module double ----------------------------------------------------------

/**
 * The object to hand back from `vi.mock("firebase/firestore", …)`. Every export
 * the feature API modules import is present; the type-only imports they also pull in
 * are erased at compile time and need no counterpart here.
 */
export const firestoreModule = () => ({
  getFirestore: () => ({ __fake: "db" }),

  collection: (_db: unknown, ...segments: string[]): CollectionRef => {
    const path = segments.join("/");
    return { __kind: "collection", path, id: idOf(path) };
  },

  collectionGroup: (_db: unknown, id: string): CollectionGroupRef => ({
    __kind: "collectionGroup",
    id,
  }),

  doc: (parent: any, ...segments: string[]): DocRef => {
    // doc(colRef)            → a new auto-id inside that collection
    // doc(colRef, "id")      → that document
    // doc(db, "users", "u1") → by full path
    if (parent?.__kind === "collection") {
      const state = store();
      const id = segments.length > 0 ? segments.join("/") : `auto-${(state.autoId += 1)}`;
      return docRef(`${parent.path}/${id}`);
    }
    return docRef(segments.join("/"));
  },

  documentId: () => DOCUMENT_ID,

  where: (field: string, op: WhereOp, value: any): WhereConstraint => ({
    __kind: "where",
    field,
    op,
    value,
  }),

  orderBy: (field: string, direction: "asc" | "desc" = "asc"): OrderByConstraint => ({
    __kind: "orderBy",
    field,
    direction,
  }),

  limit: (count: number): LimitConstraint => ({ __kind: "limit", count }),

  query: (source: Source, ...constraints: Constraint[]): QueryRef => ({
    __kind: "query",
    source,
    constraints,
  }),

  serverTimestamp: () => SERVER_TIMESTAMP,

  getDoc: async (ref: DocRef) => {
    const data = store().docs.get(ref.path);
    return {
      id: ref.id,
      ref,
      exists: () => data !== undefined,
      data: () => clone(data),
    };
  },

  getDocs: async (source: Source) => toQuerySnapshot(resolve(source)),

  setDoc: async (ref: DocRef, data: DocData, options?: { merge?: boolean }) => {
    // `{ merge: true }` keeps the fields the payload does not mention —
    // authService creates the users/{uid} doc that way.
    if (options?.merge && store().docs.has(ref.path)) {
      applyUpdate(ref.path, data);
    } else {
      applySet(ref.path, data);
    }
    notify();
  },

  addDoc: async (col: CollectionRef, data: DocData) => {
    const state = store();
    const ref = docRef(`${col.path}/auto-${(state.autoId += 1)}`);
    applySet(ref.path, data);
    notify();
    return ref;
  },

  updateDoc: async (ref: DocRef, data: DocData) => {
    applyUpdate(ref.path, data);
    notify();
  },

  deleteDoc: async (ref: DocRef) => {
    applyDelete(ref.path);
    notify();
  },

  writeBatch: () => {
    const operations: Array<() => void> = [];
    const batch = {
      set: (ref: DocRef, data: DocData) => {
        operations.push(() => applySet(ref.path, data));
        return batch;
      },
      update: (ref: DocRef, data: DocData) => {
        operations.push(() => applyUpdate(ref.path, data));
        return batch;
      },
      delete: (ref: DocRef) => {
        operations.push(() => applyDelete(ref.path));
        return batch;
      },
      commit: async () => {
        // All or nothing: stage against a copy so a failing op leaves the store
        // untouched, the way a rejected batch does.
        const snapshot = new Map(store().docs);
        try {
          operations.forEach((run) => run());
        } catch (error) {
          store().docs = snapshot;
          throw error;
        }
        notify();
      },
    };
    return batch;
  },

  runTransaction: async <T>(
    _db: unknown,
    callback: (transaction: any) => Promise<T>
  ): Promise<T> => {
    const operations: Array<() => void> = [];
    const transaction = {
      get: async (ref: DocRef) => {
        const data = store().docs.get(ref.path);
        return {
          id: ref.id,
          ref,
          exists: () => data !== undefined,
          data: () => clone(data),
        };
      },
      set: (ref: DocRef, data: DocData) => {
        operations.push(() => applySet(ref.path, data));
        return transaction;
      },
      update: (ref: DocRef, data: DocData) => {
        operations.push(() => applyUpdate(ref.path, data));
        return transaction;
      },
      delete: (ref: DocRef) => {
        operations.push(() => applyDelete(ref.path));
        return transaction;
      },
    };

    // The callback may throw (a missing document, a failed precondition), in
    // which case nothing is written — same as a real aborted transaction.
    const result = await callback(transaction);
    operations.forEach((run) => run());
    notify();
    return result;
  },

  onSnapshot: (
    source: DocRef | Source,
    onNext: (snapshot: any) => void,
    onError?: (error: any) => void
  ) => {
    const listener: Listener = { source, onNext, onError, last: null, live: true };
    store().listeners.push(listener);

    // Emit the current state immediately, as Firestore does from cache.
    notify();

    return () => {
      listener.live = false;
      const state = store();
      state.listeners = state.listeners.filter((candidate) => candidate !== listener);
    };
  },
});

// The test-facing handle -----------------------------------------------------

/**
 * Seeding and inspection helpers. Everything here talks to the same store the
 * mocked SDK does, so `firestoreMock.seed(...)` is visible to the next
 * `getDocs`, and `firestoreMock.get(...)` sees what the code under test wrote.
 */
export const firestoreMock = {
  /** Clears documents, listeners, recorded writes and the auto-id counter. */
  reset(): void {
    const state = store();
    state.docs.clear();
    state.listeners = [];
    state.writes = [];
    state.autoId = 0;
    state.clock = 0;
  },

  /** Seeds documents by full path: `seed({ "users/u1": { role: "admin" } })`. */
  seed(documents: Record<string, DocData>): void {
    for (const [path, data] of Object.entries(documents)) {
      if (path.split("/").length % 2 !== 0) {
        throw new Error(`firestore mock: "${path}" is a collection path, not a document path`);
      }
      store().docs.set(path, clone(data));
    }
    notify();
  },

  /** One document's current data, or undefined. */
  get(path: string): DocData | undefined {
    return clone(store().docs.get(path));
  },

  /** Every document path currently in the store, sorted. */
  paths(): string[] {
    return [...store().docs.keys()].sort();
  },

  /** Paths of the documents directly inside a collection, sorted. */
  pathsIn(collectionPath: string): string[] {
    return this.paths().filter((path) => parentOf(path) === collectionPath);
  },

  /** Every write performed since the last reset, in order. */
  writes(): WriteRecord[] {
    return store().writes.map((write) => ({ ...write }));
  },

  /** How many `onSnapshot` listeners are still attached — 0 after a clean unmount. */
  listenerCount(): number {
    return store().listeners.filter((listener) => listener.live).length;
  },
};
