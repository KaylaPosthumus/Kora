import { describe, it, expect, beforeEach } from "vitest";

import { applyRoleClaims, type ClaimsBackend } from "../applyRoleClaims";

/**
 * A stand-in for the Admin SDK: an account list plus a record of every call, so
 * a test can assert both the resulting claims and that a no-op really wrote
 * nothing.
 */
const fakeBackend = () => {
  const accounts = new Map<string, Record<string, unknown>>();
  const writes: Array<{ uid: string; claims: Record<string, unknown> }> = [];
  const refreshes: string[] = [];
  /** Records call order across both writes, to pin that claims land first. */
  const calls: string[] = [];

  const backend: ClaimsBackend = {
    readClaims: async (uid) => accounts.get(uid),
    writeClaims: async (uid, claims) => {
      accounts.set(uid, claims);
      writes.push({ uid, claims });
      calls.push("writeClaims");
    },
    recordRefresh: async (uid) => {
      refreshes.push(uid);
      calls.push("recordRefresh");
    },
  };

  return {
    backend,
    accounts,
    writes,
    refreshes,
    calls,
    /** Registers an auth account with the given starting claims. */
    addAccount: (uid: string, claims: Record<string, unknown> = {}) =>
      accounts.set(uid, claims),
  };
};

describe("applyRoleClaims", () => {
  let fake: ReturnType<typeof fakeBackend>;

  beforeEach(() => {
    fake = fakeBackend();
  });

  it("mints the claim for a user linked to an employee record", async () => {
    fake.addAccount("uid1", { role: "unassigned" });

    const outcome = await applyRoleClaims(
      "uid1",
      { role: "employee", employeeId: "emp1" },
      fake.backend
    );

    expect(outcome).toEqual({
      status: "updated",
      claims: { role: "employee", employeeId: "emp1" },
    });
    expect(fake.accounts.get("uid1")).toEqual({ role: "employee", employeeId: "emp1" });
  });

  it("mints the claim for a user linked as an admin", async () => {
    fake.addAccount("uid1", { role: "unassigned" });

    await applyRoleClaims("uid1", { role: "admin", adminId: "adm1" }, fake.backend);

    expect(fake.accounts.get("uid1")).toEqual({ role: "admin", adminId: "adm1" });
  });

  it("signals a token refresh after a claim change", async () => {
    fake.addAccount("uid1", { role: "unassigned" });

    await applyRoleClaims("uid1", { role: "employee", employeeId: "emp1" }, fake.backend);

    expect(fake.refreshes).toEqual(["uid1"]);
  });

  // A client woken by the refresh signal immediately calls getIdToken(true). If
  // the signal landed first, that refresh could still mint the old claims.
  it("writes the claims before signalling the refresh", async () => {
    fake.addAccount("uid1", {});

    await applyRoleClaims("uid1", { role: "admin", adminId: "adm1" }, fake.backend);

    expect(fake.calls).toEqual(["writeClaims", "recordRefresh"]);
  });

  it("does nothing when the write left every managed claim alone", async () => {
    fake.addAccount("uid1", { role: "employee", employeeId: "emp1" });

    const outcome = await applyRoleClaims(
      "uid1",
      { role: "employee", employeeId: "emp1", profilePicture: "https://example.test/a.png" },
      fake.backend
    );

    expect(outcome).toEqual({ status: "unchanged" });
    expect(fake.writes).toEqual([]);
    expect(fake.refreshes).toEqual([]);
  });

  it("clears the claims when a user is unlinked back to unassigned", async () => {
    fake.addAccount("uid1", { role: "admin", adminId: "adm1" });

    await applyRoleClaims("uid1", { role: "unassigned" }, fake.backend);

    expect(fake.accounts.get("uid1")).toEqual({ role: "unassigned" });
  });

  it("clears the managed claims when the user document is deleted", async () => {
    fake.addAccount("uid1", { role: "employee", employeeId: "emp1" });

    const outcome = await applyRoleClaims("uid1", undefined, fake.backend);

    expect(outcome.status).toBe("updated");
    expect(fake.accounts.get("uid1")).toEqual({});
  });

  // A users/{uid} document can outlive its auth account — seeded data, or a
  // deletion that removed the account first. Neither is an error, and throwing
  // would retry against input that will never improve.
  it("reports no-auth-user instead of throwing when the account is gone", async () => {
    const outcome = await applyRoleClaims(
      "ghost",
      { role: "employee", employeeId: "emp1" },
      fake.backend
    );

    expect(outcome).toEqual({ status: "no-auth-user" });
    expect(fake.writes).toEqual([]);
    expect(fake.refreshes).toEqual([]);
  });

  it("degrades a malformed role to unassigned rather than failing", async () => {
    fake.addAccount("uid1", { role: "admin", adminId: "adm1" });

    const outcome = await applyRoleClaims("uid1", { role: 2 }, fake.backend);

    expect(outcome.status).toBe("updated");
    expect(fake.accounts.get("uid1")).toEqual({ role: "unassigned" });
  });

  it("leaves claims it does not manage untouched", async () => {
    fake.addAccount("uid1", { role: "unassigned", tenant: "acme" });

    await applyRoleClaims("uid1", { role: "employee", employeeId: "emp1" }, fake.backend);

    expect(fake.accounts.get("uid1")).toEqual({
      role: "employee",
      employeeId: "emp1",
      tenant: "acme",
    });
  });

  // Running the same event twice is normal: Cloud Functions delivers at least
  // once. The second delivery must not re-signal a refresh.
  it("is idempotent across a redelivered event", async () => {
    fake.addAccount("uid1", { role: "unassigned" });
    const user = { role: "employee", employeeId: "emp1" };

    const first = await applyRoleClaims("uid1", user, fake.backend);
    const second = await applyRoleClaims("uid1", user, fake.backend);

    expect(first.status).toBe("updated");
    expect(second.status).toBe("unchanged");
    expect(fake.writes).toHaveLength(1);
    expect(fake.refreshes).toEqual(["uid1"]);
  });

  it("re-mints the claim when an employee is promoted to admin", async () => {
    fake.addAccount("uid1", { role: "employee", employeeId: "emp1" });

    await applyRoleClaims("uid1", { role: "admin", adminId: "adm1" }, fake.backend);

    // The stale employeeId must not survive the promotion — the rules read it
    // to decide which employee record the caller may touch.
    expect(fake.accounts.get("uid1")).toEqual({ role: "admin", adminId: "adm1" });
  });
});
