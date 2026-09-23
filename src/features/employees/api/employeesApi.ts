/**
 * Employees, the users behind them, and the admins who manage them.
 *
 * The page-shaped reads at the bottom replace what the old backend served as
 * single SQL-joined endpoints; Firestore has no joins, so they fan out with
 * `Promise.all` and stitch the pieces in JS.
 */

import {
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import {
  GatheringType,
  ReviewStatus,
} from "@/shared/types/common";
import type { EmpUser } from "@/shared/types/empUser";
import type { AdminUser } from "@/shared/types/adminUser";
import type { EmpUserRatingMetrics } from "@/shared/types/empUserRatingMetrics";
import type { EmployeeListItem } from "@/shared/types/employeeListItem";
import {
  ok,
  usersCol,
  employeesCol,
  adminsCol,
  equipmentCol,
  leaveTypesCol,
  performanceReviewsCol,
  leaveBalancesCol,
  withId,
  toEmpUser,
  toEquipment,
  toLeaveBalance,
} from "@/shared/lib/firestore";
import type {
  ApiResponse,
} from "@/shared/lib/firestore";
import { db } from "@/services/firebase";
import { getGatherings } from "@/features/gatherings/api/gatheringsApi";

export const empUserAPI = {
  /** All employees, with their user fields merged in. */
  getAllEmpUsers: async (): Promise<ApiResponse<EmpUser[]>> => {
    const snapshot = await getDocs(query(employeesCol, orderBy("fullName")));
    return ok(snapshot.docs.map((d) => toEmpUser(d.id, d.data())));
  },

  getEmpUserById: async (id: string): Promise<ApiResponse<EmpUser | null>> => {
    const snapshot = await getDoc(doc(employeesCol, id));
    return snapshot.exists() ? ok(toEmpUser(snapshot.id, snapshot.data())) : ok(null, 404);
  },

  /**
   * Updates an employee. User-owned fields (name, email, picture) are written to
   * both `users/{uid}` and the denormalised copy on `employees/{id}` in one batch,
   * so a list never shows a stale name.
   */
  updateEmpUserById: async (id: string, data: Record<string, any>): Promise<ApiResponse<null>> => {
    const employeeRef = doc(employeesCol, id);
    const snapshot = await getDoc(employeeRef);

    if (!snapshot.exists()) return ok(null, 404);

    const batch = writeBatch(db);
    batch.update(employeeRef, data);

    const mirrored: Record<string, any> = {};
    for (const field of ["fullName", "email", "profilePicture"] as const) {
      if (field in data) mirrored[field] = data[field];
    }

    const userId = snapshot.data().userId;
    if (userId && Object.keys(mirrored).length > 0) {
      batch.update(doc(usersCol, userId), mirrored);
    }

    await batch.commit();
    return ok(null);
  },

  /**
   * Employees plus a flag for whether they already hold an item in the same
   * category as `comparedEquipId` — drives the "already has a laptop" hint in the
   * assign-equipment dropdown.
   */
  getAllEmpUsersAndEquipStats: async (comparedEquipId: string): Promise<ApiResponse<any[]>> => {
    const comparedSnapshot = await getDoc(doc(equipmentCol, comparedEquipId));
    const comparedCatId = comparedSnapshot.exists()
      ? comparedSnapshot.data().equipmentCatId
      : null;

    const [employeesSnapshot, sameCategorySnapshot] = await Promise.all([
      getDocs(query(employeesCol, orderBy("fullName"))),
      comparedCatId
        ? getDocs(query(equipmentCol, where("equipmentCatId", "==", comparedCatId)))
        : Promise.resolve(null),
    ]);

    const employeesWithSameCat = new Set<string>();
    sameCategorySnapshot?.docs.forEach((d) => {
      const employeeId = d.data().employeeId;
      if (employeeId) employeesWithSameCat.add(employeeId);
    });

    return ok(
      employeesSnapshot.docs.map((d) => ({
        ...toEmpUser(d.id, d.data()),
        hasItemOfSameEquipCat: employeesWithSameCat.has(d.id),
      }))
    );
  },
};

export const employeeAPI = {
  toggleEmpSuspension: async (id: string): Promise<ApiResponse<null>> => {
    const employeeRef = doc(employeesCol, id);
    const snapshot = await getDoc(employeeRef);

    if (!snapshot.exists()) return ok(null, 404);

    await updateDoc(employeeRef, { isSuspended: !snapshot.data().isSuspended });
    return ok(null);
  },

  /**
   * Terminates an employee: unlinks their equipment, clears the link on their user
   * doc, and removes the employee record (with its leave balances).
   */
  terminateEmpById: async (id: string): Promise<ApiResponse<null>> => {
    const employeeRef = doc(employeesCol, id);
    const snapshot = await getDoc(employeeRef);

    if (!snapshot.exists()) return ok(null, 404);

    const [equipmentSnapshot, balancesSnapshot] = await Promise.all([
      getDocs(query(equipmentCol, where("employeeId", "==", id))),
      getDocs(leaveBalancesCol(id)),
    ]);

    const batch = writeBatch(db);

    equipmentSnapshot.docs.forEach((item) =>
      batch.update(item.ref, { employeeId: null, assignedDate: null })
    );
    balancesSnapshot.docs.forEach((balance) => batch.delete(balance.ref));

    const userId = snapshot.data().userId;
    if (userId) {
      batch.update(doc(usersCol, userId), {
        isLinked: false,
        employeeId: null,
      });
    }

    batch.delete(employeeRef);

    await batch.commit();
    return ok(null);
  },

  /**
   * Links an existing signed-up user to a new employee record. This is the action
   * that flips a user from "unassigned" to "employee": it writes the employee doc,
   * seeds a leave balance per leave type, assigns any chosen equipment, and marks
   * the user linked.
   */
  setupUserAsEmployee: async (data: {
    userId: string;
    gender: string;
    dateOfBirth: string;
    phoneNumber: string;
    jobTitle: string;
    department: string;
    salaryAmount: number;
    payCycle: string;
    lastPaidDate?: string;
    employType: string;
    employDate: string;
    isSuspended?: boolean;
    equipmentIds?: string[];
  }): Promise<ApiResponse<{ employeeId: string }>> => {
    const userSnapshot = await getDoc(doc(usersCol, data.userId));
    if (!userSnapshot.exists()) {
      throw new Error(`No user found with id ${data.userId}`);
    }

    const user = userSnapshot.data();
    const { equipmentIds = [], ...employeeFields } = data;

    const employeeRef = doc(employeesCol);
    const batch = writeBatch(db);

    batch.set(employeeRef, {
      ...employeeFields,
      lastPaidDate: data.lastPaidDate ?? null,
      isSuspended: data.isSuspended ?? false,
      // Denormalised from the user doc for list reads.
      fullName: user.fullName,
      email: user.email,
      profilePicture: user.profilePicture ?? null,
      createdAt: serverTimestamp(),
    });

    // Every employee starts with a full allowance of each leave type. The balance
    // doc id *is* the leave type id — see approveLeaveRequestById.
    const leaveTypesSnapshot = await getDocs(leaveTypesCol);
    leaveTypesSnapshot.docs.forEach((leaveType) => {
      const { leaveTypeName, description, defaultDays } = leaveType.data();
      batch.set(doc(db, "employees", employeeRef.id, "leaveBalances", leaveType.id), {
        leaveTypeId: leaveType.id,
        leaveTypeName,
        description,
        defaultDays,
        remainingDays: defaultDays,
      });
    });

    const assignedDate = new Date().toISOString();
    equipmentIds.forEach((equipmentId) =>
      batch.update(doc(equipmentCol, equipmentId), {
        employeeId: employeeRef.id,
        assignedDate,
      })
    );

    batch.update(doc(usersCol, data.userId), {
      role: "employee",
      isLinked: true,
      employeeId: employeeRef.id,
    });

    await batch.commit();
    return ok({ employeeId: employeeRef.id }, 201);
  },
};

export const userAPI = {
  /** Users who have signed up but aren't linked to an employee/admin record yet. */
  getUnlinkedUsers: async (): Promise<ApiResponse<any[]>> => {
    const snapshot = await getDocs(query(usersCol, where("isLinked", "==", false)));
    return ok(snapshot.docs.map((d) => withId<any>(d)).map((u) => ({ ...u, userId: u.id })));
  },
};

export const adminAPI = {
  getAllAdmins: async (): Promise<ApiResponse<AdminUser[]>> => {
    const snapshot = await getDocs(query(adminsCol, orderBy("fullName")));
    return ok(
      snapshot.docs.map((d) => ({
        adminId: d.id,
        userId: d.data().userId,
        email: d.data().email ?? null,
        fullName: d.data().fullName ?? null,
      }))
    );
  },

  getAdminById: async (adminId: string): Promise<ApiResponse<AdminUser | null>> => {
    const snapshot = await getDoc(doc(adminsCol, adminId));
    if (!snapshot.exists()) return ok(null, 404);

    return ok({
      adminId: snapshot.id,
      userId: snapshot.data().userId,
      email: snapshot.data().email ?? null,
      fullName: snapshot.data().fullName ?? null,
    });
  },
};

/** Average / count / most recent rating from an employee's completed reviews. */
export const ratingMetricsFor = (
  employeeId: string,
  fullName: string,
  reviews: { rating: number | null; startDate: string }[]
): EmpUserRatingMetrics => {
  const rated = reviews
    .filter((review) => typeof review.rating === "number")
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  const total = rated.reduce((sum, review) => sum + (review.rating as number), 0);

  return {
    employeeId,
    fullName,
    averageRating: rated.length > 0 ? total / rated.length : 0,
    numberOfRatings: rated.length,
    mostRecentRating: rated.length > 0 ? (rated[0].rating as number) : 0,
  };
};

// Page-shaped reads ------------------------------------------------------------------------------

/**
 * Everything the admin's employee-detail screen needs. Replaces the old
 * `/Page/admin-emp-details/{id}` SQL join with five parallel reads.
 */
export const getAdminEmpDetails = async (id: string): Promise<ApiResponse<any>> => {
  const [employeeSnapshot, equipmentSnapshot, balancesSnapshot, gatherings] = await Promise.all([
    getDoc(doc(employeesCol, id)),
    getDocs(query(equipmentCol, where("employeeId", "==", id))),
    getDocs(leaveBalancesCol(id)),
    getGatherings({ field: "employeeId", id }),
  ]);

  if (!employeeSnapshot.exists()) {
    throw new Error(`No employee found with id ${id}`);
  }

  const empUser = toEmpUser(employeeSnapshot.id, employeeSnapshot.data());

  const reviews = gatherings
    .filter((gathering) => gathering.type === GatheringType.PerformanceReview)
    .map((review) => ({
      rating: review.rating ?? null,
      startDate: String(review.startDate ?? ""),
    }));

  return ok({
    empUser,
    equipment: equipmentSnapshot.docs.map((d) => toEquipment(d.id, d.data())),
    leaveBalances: balancesSnapshot.docs.map((d) => toLeaveBalance(d.id, d.data())),
    empUserRatingMetrics: ratingMetricsFor(id, empUser.fullName, reviews),
    gatherings,
  });
};

/**
 * The admin employee table: every employee with their rating summary and total
 * leave balance.
 *
 * Leave balances are subcollections, so they're read with one collection-group
 * query rather than one query per employee — this is the read that would blow up
 * first if it were done naively.
 */
export const getAdminEmpManagement = async (): Promise<ApiResponse<EmployeeListItem[]>> => {
  const [employeesSnapshot, reviewsSnapshot, balancesSnapshot] = await Promise.all([
    getDocs(query(employeesCol, orderBy("fullName"))),
    getDocs(query(performanceReviewsCol, where("status", "==", ReviewStatus.Completed))),
    getDocs(collectionGroup(db, "leaveBalances")),
  ]);

  // Group reviews by employee for the rating summary.
  const reviewsByEmployee = new Map<string, { rating: number | null; startDate: string }[]>();
  reviewsSnapshot.docs.forEach((d) => {
    const data = d.data();
    const existing = reviewsByEmployee.get(data.employeeId) ?? [];
    existing.push({ rating: data.rating ?? null, startDate: data.startDate });
    reviewsByEmployee.set(data.employeeId, existing);
  });

  // A leave balance's parent document is the employee it belongs to.
  const balancesByEmployee = new Map<string, { remaining: number; total: number }>();
  balancesSnapshot.docs.forEach((d) => {
    const employeeId = d.ref.parent.parent?.id;
    if (!employeeId) return;

    const data = d.data();
    const existing = balancesByEmployee.get(employeeId) ?? { remaining: 0, total: 0 };
    existing.remaining += data.remainingDays ?? 0;
    existing.total += data.defaultDays ?? 0;
    balancesByEmployee.set(employeeId, existing);
  });

  return ok(
    employeesSnapshot.docs.map((d) => {
      const empUser = toEmpUser(d.id, d.data());
      const metrics = ratingMetricsFor(
        d.id,
        empUser.fullName,
        reviewsByEmployee.get(d.id) ?? []
      );
      const balances = balancesByEmployee.get(d.id) ?? { remaining: 0, total: 0 };

      return {
        empUser,
        empUserRatingMetrics: {
          averageRating: metrics.averageRating,
          numberOfRatings: metrics.numberOfRatings,
        },
        totalLeaveBalanceSum: {
          totalRemainingDays: balances.remaining,
          totalLeaveDays: balances.total,
        },
      } as unknown as EmployeeListItem;
    })
  );
};

/** The employee's own profile screen. */
export const getEmployeeProfile = async (id: string): Promise<ApiResponse<any>> => {
  const [employeeSnapshot, equipmentSnapshot, reviewsSnapshot] = await Promise.all([
    getDoc(doc(employeesCol, id)),
    getDocs(query(equipmentCol, where("employeeId", "==", id))),
    getDocs(
      query(
        performanceReviewsCol,
        where("employeeId", "==", id),
        where("status", "==", ReviewStatus.Completed)
      )
    ),
  ]);

  if (!employeeSnapshot.exists()) {
    throw new Error(`No employee found with id ${id}`);
  }

  const empUser = toEmpUser(employeeSnapshot.id, employeeSnapshot.data());

  return ok({
    empUser,
    equipment: equipmentSnapshot.docs.map((d) => toEquipment(d.id, d.data())),
    empUserRatingMetrics: ratingMetricsFor(
      id,
      empUser.fullName,
      reviewsSnapshot.docs.map((d) => ({
        rating: d.data().rating ?? null,
        startDate: d.data().startDate,
      }))
    ),
  });
};

/** Creates the admin record for a user and marks them linked. */
export const linkUserAsAdmin = async (userId: string): Promise<ApiResponse<{ adminId: string }>> => {
  const userSnapshot = await getDoc(doc(usersCol, userId));
  if (!userSnapshot.exists()) {
    throw new Error(`No user found with id ${userId}`);
  }

  const user = userSnapshot.data();
  const adminRef = doc(adminsCol);
  const batch = writeBatch(db);

  batch.set(adminRef, {
    userId,
    fullName: user.fullName,
    email: user.email,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(usersCol, userId), {
    role: "admin",
    isLinked: true,
    adminId: adminRef.id,
  });

  await batch.commit();
  return ok({ adminId: adminRef.id }, 201);
};
