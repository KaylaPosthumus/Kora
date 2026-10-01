import { describe, it, expect } from "vitest";

import {
  mirrorChanged,
  mirrorUpdate,
  mirroredFields,
  newBalance,
  planLeaveTypeSync,
  type LeaveTypeDoc,
} from "../leaveTypeSync";

const ANNUAL: LeaveTypeDoc = {
  leaveTypeName: "Annual",
  description: "Paid time off",
  defaultDays: 20,
};

const EMPLOYEES = ["emp1", "emp2", "emp3"];

describe("mirroredFields", () => {
  it("copies the three denormalised fields plus the id", () => {
    expect(mirroredFields("annual", ANNUAL)).toEqual({
      leaveTypeId: "annual",
      leaveTypeName: "Annual",
      description: "Paid time off",
      defaultDays: 20,
    });
  });

  it("substitutes nulls for missing text fields rather than undefined", () => {
    // Firestore rejects an explicit undefined; null is the storable absence.
    expect(mirroredFields("annual", {})).toEqual({
      leaveTypeId: "annual",
      leaveTypeName: null,
      description: null,
      defaultDays: 0,
    });
  });
});

describe("newBalance", () => {
  it("starts an employee on the full allowance", () => {
    expect(newBalance(mirroredFields("annual", ANNUAL))).toEqual({
      leaveTypeId: "annual",
      leaveTypeName: "Annual",
      description: "Paid time off",
      defaultDays: 20,
      remainingDays: 20,
    });
  });

  // Matching setupUserAsEmployee exactly is what makes a backfilled employee
  // indistinguishable from one created after the leave type existed.
  it("uses zero when the default is not a number", () => {
    const fields = mirroredFields("annual", { ...ANNUAL, defaultDays: "twenty" });
    expect(newBalance(fields).remainingDays).toBe(0);
  });
});

describe("mirrorChanged", () => {
  it("is false when nothing denormalised moved", () => {
    expect(mirrorChanged(ANNUAL, { ...ANNUAL })).toBe(false);
  });

  it.each([
    ["the name", { leaveTypeName: "Annual Leave" }],
    ["the description", { description: "Updated" }],
    ["the default days", { defaultDays: 25 }],
  ])("is true when %s changed", (_label, change) => {
    expect(mirrorChanged(ANNUAL, { ...ANNUAL, ...change })).toBe(true);
  });

  it("ignores fields balances do not copy", () => {
    expect(mirrorChanged(ANNUAL, { ...ANNUAL, colour: "green" } as LeaveTypeDoc)).toBe(false);
  });
});

describe("planLeaveTypeSync — a new leave type", () => {
  // The bug this closes: without a balance document, setLeaveRequestStatus
  // skips the decrement entirely and approved days are never deducted.
  it("backfills every employee that lacks a balance", () => {
    const plan = planLeaveTypeSync("study", undefined, ANNUAL, EMPLOYEES, new Set());

    expect(plan.toCreate).toEqual(EMPLOYEES);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.toDelete).toEqual([]);
  });

  it("skips employees that somehow already have one", () => {
    const plan = planLeaveTypeSync(
      "study",
      undefined,
      ANNUAL,
      EMPLOYEES,
      new Set(["emp2"])
    );

    expect(plan.toCreate).toEqual(["emp1", "emp3"]);
  });

  it("creates nothing when there are no employees yet", () => {
    const plan = planLeaveTypeSync("study", undefined, ANNUAL, [], new Set());

    expect(plan.toCreate).toEqual([]);
  });

  it("carries the fields to write", () => {
    const plan = planLeaveTypeSync("study", undefined, ANNUAL, EMPLOYEES, new Set());

    expect(plan.fields).toEqual(mirroredFields("study", ANNUAL));
  });
});

describe("planLeaveTypeSync — an edited leave type", () => {
  const withBalances = new Set(EMPLOYEES);

  it("refreshes every existing balance when the name changes", () => {
    const plan = planLeaveTypeSync(
      "annual",
      ANNUAL,
      { ...ANNUAL, leaveTypeName: "Annual Leave" },
      EMPLOYEES,
      withBalances
    );

    expect(plan.toUpdate).toEqual(EMPLOYEES);
    expect(plan.toDelete).toEqual([]);
  });

  it("does nothing when the write touched no denormalised field", () => {
    const plan = planLeaveTypeSync("annual", ANNUAL, { ...ANNUAL }, EMPLOYEES, withBalances);

    expect(plan.toCreate).toEqual([]);
    expect(plan.toUpdate).toEqual([]);
    expect(plan.toDelete).toEqual([]);
  });

  it("also backfills an employee that missed the original seeding", () => {
    const plan = planLeaveTypeSync(
      "annual",
      ANNUAL,
      { ...ANNUAL, defaultDays: 25 },
      EMPLOYEES,
      new Set(["emp1"])
    );

    expect(plan.toUpdate).toEqual(["emp1"]);
    expect(plan.toCreate).toEqual(["emp2", "emp3"]);
  });
});

describe("planLeaveTypeSync — a deleted leave type", () => {
  it("removes the balances that referenced it", () => {
    const plan = planLeaveTypeSync(
      "annual",
      ANNUAL,
      undefined,
      EMPLOYEES,
      new Set(["emp1", "emp3"])
    );

    expect(plan.toDelete).toEqual(["emp1", "emp3"]);
    expect(plan.toCreate).toEqual([]);
    expect(plan.toUpdate).toEqual([]);
  });

  it("writes no fields on a delete", () => {
    const plan = planLeaveTypeSync("annual", ANNUAL, undefined, EMPLOYEES, new Set(EMPLOYEES));

    expect(plan.fields).toBeNull();
  });

  it("does nothing when no employee held a balance", () => {
    const plan = planLeaveTypeSync("annual", ANNUAL, undefined, EMPLOYEES, new Set());

    expect(plan.toDelete).toEqual([]);
  });
});

describe("mirrorUpdate", () => {
  // The invariant that matters: a rename must not hand back spent days.
  it("never writes remainingDays", () => {
    const update = mirrorUpdate(mirroredFields("annual", ANNUAL));

    expect(update).not.toHaveProperty("remainingDays");
    expect(Object.keys(update).sort()).toEqual([
      "defaultDays",
      "description",
      "leaveTypeName",
    ]);
  });

  it("does not rewrite the leave type id", () => {
    // The document id already is the leave type id; rewriting the field is
    // noise at best and a chance to contradict the id at worst.
    expect(mirrorUpdate(mirroredFields("annual", ANNUAL))).not.toHaveProperty("leaveTypeId");
  });
});
