import { describe, it, expect } from "vitest";

import {
  ADMIN_MIRRORS,
  EMPLOYEE_MIRRORS,
  USER_TO_ADMIN_FIELDS,
  USER_TO_EMPLOYEE_FIELDS,
  changedFields,
  mirrorUpdate,
  pendingMirrors,
  pickFields,
  type MirrorSpec,
} from "../denormalise";

describe("changedFields", () => {
  it("reports only the fields that moved", () => {
    expect(
      changedFields({ fullName: "A", email: "a@k.test" }, { fullName: "B", email: "a@k.test" }, [
        "fullName",
        "email",
      ])
    ).toEqual(["fullName"]);
  });

  it("reports nothing when the document is unchanged", () => {
    const doc = { fullName: "A", email: "a@k.test" };
    expect(changedFields(doc, { ...doc }, ["fullName", "email"])).toEqual([]);
  });

  // The gate on the whole fan-out: a salary change must not trigger three
  // queries looking for a name that did not move.
  it("ignores fields outside the watched list", () => {
    expect(
      changedFields({ fullName: "A", salaryAmount: 100 }, { fullName: "A", salaryAmount: 200 }, [
        "fullName",
      ])
    ).toEqual([]);
  });

  it("treats an added field as changed", () => {
    expect(changedFields({}, { fullName: "A" }, ["fullName"])).toEqual(["fullName"]);
  });

  it("treats a removed field as changed", () => {
    expect(changedFields({ fullName: "A" }, {}, ["fullName"])).toEqual(["fullName"]);
  });
});

describe("mirrorUpdate", () => {
  const spec: MirrorSpec = {
    collection: "leaveRequests",
    matchField: "employeeId",
    fields: { fullName: "employeeName" },
  };

  it("renames the field to its target name", () => {
    expect(mirrorUpdate(spec, { fullName: "B" }, ["fullName"])).toEqual({
      employeeName: "B",
    });
  });

  it("returns null when nothing it copies changed", () => {
    expect(mirrorUpdate(spec, { fullName: "B" }, ["email"])).toBeNull();
  });

  // Firestore rejects an explicit undefined; a cleared name must land as null.
  it("writes null for a cleared value rather than undefined", () => {
    expect(mirrorUpdate(spec, {}, ["fullName"])).toEqual({ employeeName: null });
  });

  it("copies only the mapped fields, never the whole document", () => {
    const update = mirrorUpdate(
      spec,
      { fullName: "B", salaryAmount: 999, email: "b@k.test" },
      ["fullName"]
    );

    expect(update).toEqual({ employeeName: "B" });
  });
});

describe("pendingMirrors", () => {
  it("returns every spec with something to write", () => {
    const pending = pendingMirrors(EMPLOYEE_MIRRORS, { fullName: "B" }, ["fullName"]);

    expect(pending.map((entry) => entry.spec.collection).sort()).toEqual([
      "leaveRequests",
      "meetings",
      "performanceReviews",
    ]);
    expect(pending.every((entry) => entry.update.employeeName === "B")).toBe(true);
  });

  it("returns nothing when no mapped field changed", () => {
    expect(pendingMirrors(EMPLOYEE_MIRRORS, { fullName: "B" }, ["salaryAmount"])).toEqual([]);
  });

  it("returns nothing for an empty change list", () => {
    expect(pendingMirrors(ADMIN_MIRRORS, { fullName: "B" }, [])).toEqual([]);
  });
});

describe("the mirror specs", () => {
  it("propagates an employee's name to all three collections that show it", () => {
    expect(EMPLOYEE_MIRRORS.map((spec) => spec.collection).sort()).toEqual([
      "leaveRequests",
      "meetings",
      "performanceReviews",
    ]);
    expect(EMPLOYEE_MIRRORS.every((spec) => spec.matchField === "employeeId")).toBe(true);
  });

  // Leave requests carry no adminName, so an admin rename must not look there.
  it("propagates an admin's name only to the two gathering collections", () => {
    expect(ADMIN_MIRRORS.map((spec) => spec.collection).sort()).toEqual([
      "meetings",
      "performanceReviews",
    ]);
    expect(ADMIN_MIRRORS.every((spec) => spec.matchField === "adminId")).toBe(true);
  });

  // An admin record has no profile picture field; copying one would invent it.
  it("hands admins a narrower field set than employees", () => {
    expect([...USER_TO_EMPLOYEE_FIELDS]).toContain("profilePicture");
    expect([...USER_TO_ADMIN_FIELDS]).not.toContain("profilePicture");
  });
});

describe("pickFields", () => {
  it("takes only the listed fields", () => {
    expect(
      pickFields({ fullName: "A", email: "a@k.test", role: "admin" }, ["fullName", "email"])
    ).toEqual({ fullName: "A", email: "a@k.test" });
  });

  it("normalises a missing field to null", () => {
    expect(pickFields({ fullName: "A" }, ["fullName", "profilePicture"])).toEqual({
      fullName: "A",
      profilePicture: null,
    });
  });
});
