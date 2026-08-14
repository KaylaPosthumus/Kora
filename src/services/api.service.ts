import {
  collection,
  collectionGroup,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  runTransaction,
  documentId,
  serverTimestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  EmployType,
  GatheringType,
  LeaveStatus,
  MeetStatus,
  ReviewStatus,
} from "../types/common";
import { calculateDurationInDays } from "../utils/dateUtils";
import type { EmpUser } from "../interfaces/people/empUser";
import type { Equipment } from "../interfaces/equipment/equipment";
import type { LeaveBalance } from "../interfaces/leave/leaveBalance";
import type { LeaveRequest } from "../interfaces/leave/leaveRequest";
import type { Gathering } from "../interfaces/gathering/gathering";
import type { MeetingDTO } from "../interfaces/meetings/meetingDTO";
import type { MeetingRequestCard } from "../interfaces/meetings/meetingRequestCard";
import type { PerformanceReview } from "../interfaces/performance_reviews/performanceReview";
import type { AdminUser } from "../interfaces/people/adminUser";
import type { EmpUserRatingMetrics } from "../interfaces/people/empUserRatingMetrics";
import type { EmployeeListItem } from "../interfaces/people/employeeListItem";

/**
 * Data layer, rebuilt on Firestore.
 *
 * The old backend exposed page-shaped endpoints that ran SQL joins server-side.
 * Firestore has no joins, so the composite reads in `pageAPI` fan out — they read
 * the pieces in parallel with `Promise.all` and stitch them in JS. Data volumes
 * here are one company's worth of employees, so this stays cheap.
 *
 * Fields that show up in *lists* are denormalised onto the document being listed
 * (`employeeName` on a leave request, `fullName` on an employee) so a list render
 * is one query rather than one query plus N lookups.
 *
 * Every function returns `{ data, status }` — the same shape the components were
 * already destructuring off axios, so call sites did not have to change.
 */

// Response envelope & helpers ---------------------------------------------------------------------

export interface ApiResponse<T = any> {
  data: T;
  status: number;
}

const ok = <T,>(data: T, status = 200): ApiResponse<T> => ({ data, status });

/** Collection references, in one place so a rename is a single edit. */
const usersCol = collection(db, "users");
const employeesCol = collection(db, "employees");
const adminsCol = collection(db, "admins");
const equipmentCol = collection(db, "equipment");
const equipmentCategoriesCol = collection(db, "equipmentCategories");
const leaveTypesCol = collection(db, "leaveTypes");
const leaveRequestsCol = collection(db, "leaveRequests");
const meetingsCol = collection(db, "meetings");
const performanceReviewsCol = collection(db, "performanceReviews");

/** Leave balances live under the employee they belong to. */
const leaveBalancesCol = (employeeId: string) =>
  collection(db, "employees", employeeId, "leaveBalances");

/** Merges a document's id into its data. */
const withId = <T,>(snapshot: QueryDocumentSnapshot<DocumentData>): T =>
  ({ id: snapshot.id, ...snapshot.data() } as T);

/**
 * Firestore rejects an `in` filter with more than 30 values, so chunk the ids and
 * run the reads in parallel.
 */
const chunk = <T,>(items: T[], size = 30): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

/** Fetches documents by id from a collection, in parallel batches. */
const getDocsByIds = async (
  collectionName: string,
  ids: string[]
): Promise<Map<string, DocumentData>> => {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const result = new Map<string, DocumentData>();
  if (unique.length === 0) return result;

  const snapshots = await Promise.all(
    chunk(unique).map((batch) =>
      getDocs(query(collection(db, collectionName), where(documentId(), "in", batch)))
    )
  );

  snapshots.forEach((snapshot) =>
    snapshot.docs.forEach((document) => result.set(document.id, document.data()))
  );

  return result;
};

// Document -> DTO mappers -------------------------------------------------------------------------

/**
 * An employee document carries a copy of its user's name/email/picture so lists
 * don't need a second read. `updateEmpUserById` keeps the two in step.
 */
const toEmpUser = (id: string, data: DocumentData): EmpUser => ({
  userId: data.userId,
  fullName: data.fullName ?? "",
  email: data.email ?? "",
  googleId: null,
  profilePicture: data.profilePicture ?? null,
  role: data.role,

  employeeId: id,
  gender: data.gender,
  dateOfBirth: data.dateOfBirth,
  phoneNumber: data.phoneNumber,
  jobTitle: data.jobTitle,
  department: data.department,
  salaryAmount: data.salaryAmount,
  payCycle: data.payCycle,
  lastPaidDate: data.lastPaidDate ?? null,
  employType: data.employType,
  employDate: data.employDate,
  isSuspended: data.isSuspended ?? false,
});

const toEquipment = (id: string, data: DocumentData): Equipment => ({
  equipmentId: id,
  employeeId: data.employeeId ?? null,
  equipmentCatId: data.equipmentCatId,
  equipmentCategoryName: data.equipmentCategoryName ?? "",
  equipmentName: data.equipmentName,
  assignedDate: data.assignedDate ?? null,
  condition: data.condition,
});

const toLeaveBalance = (id: string, data: DocumentData): LeaveBalance => ({
  // The balance doc is keyed by leave type id, which is what makes the
  // approve-and-decrement transaction below possible (see approveLeaveRequestById).
  leaveBalanceId: id,
  remainingDays: data.remainingDays,
  leaveTypeName: data.leaveTypeName ?? "",
  description: data.description ?? "",
  defaultDays: data.defaultDays ?? 0,
});

const toLeaveRequest = (id: string, data: DocumentData): LeaveRequest => ({
  leaveRequestId: id,
  employeeId: data.employeeId,
  employeeName: data.employeeName ?? "",
  // Some cards read `fullName`, others `employeeName` — carry both.
  fullName: data.employeeName ?? "",
  leaveType: data.leaveTypeName ?? "",
  leaveTypeId: data.leaveTypeId,
  startDate: data.startDate,
  endDate: data.endDate,
  comment: data.comment ?? "",
  status: data.status,
  createdAt: data.createdAt ?? "",
  leaveTypeName: data.leaveTypeName ?? "",
  description: data.description ?? "",
  defaultDays: data.defaultDays ?? 0,
});

const toMeeting = (id: string, data: DocumentData): MeetingDTO => ({
  meetingId: id,
  adminId: data.adminId,
  adminName: data.adminName ?? "",
  employeeId: data.employeeId,
  employeeName: data.employeeName ?? "",
  isOnline: data.isOnline ?? false,
  meetLocation: data.meetLocation ?? "",
  meetLink: data.meetLink ?? "",
  startDate: data.startDate,
  endDate: data.endDate,
  purpose: data.purpose ?? "",
  status: data.status,
});

const toPerformanceReview = (id: string, data: DocumentData): PerformanceReview => ({
  reviewId: id,
  adminId: data.adminId,
  adminName: data.adminName ?? "",
  employeeId: data.employeeId,
  employeeName: data.employeeName ?? "",
  isOnline: data.isOnline ?? false,
  meetLocation: data.meetLocation ?? null,
  meetLink: data.meetLink ?? null,
  startDate: data.startDate,
  endDate: data.endDate,
  rating: data.rating ?? null,
  comment: data.comment ?? null,
  docUrl: data.docUrl ?? null,
  status: data.status,
});

/**
 * The UI shows meetings and performance reviews in one list. The old backend
 * merged them into a `Gathering`; these two mappers do the same client-side.
 */
const meetingToGathering = (id: string, data: DocumentData): Gathering => ({
  id,
  type: GatheringType.Meeting,
  adminId: data.adminId,
  adminName: data.adminName ?? "",
  employeeId: data.employeeId,
  employeeName: data.employeeName ?? "",
  isOnline: data.isOnline ?? false,
  meetLocation: data.meetLocation ?? "",
  meetLink: data.meetLink ?? "",
  startDate: data.startDate,
  endDate: data.endDate,
  purpose: data.purpose ?? "",
  requestedAt: data.requestedAt,
  meetingStatus: data.status,
});

const reviewToGathering = (id: string, data: DocumentData): Gathering => ({
  id,
  type: GatheringType.PerformanceReview,
  adminId: data.adminId,
  adminName: data.adminName ?? "",
  employeeId: data.employeeId,
  employeeName: data.employeeName ?? "",
  isOnline: data.isOnline ?? false,
  meetLocation: data.meetLocation ?? "",
  meetLink: data.meetLink ?? "",
  startDate: data.startDate,
  endDate: data.endDate,
  rating: data.rating ?? undefined,
  comment: data.comment ?? undefined,
  docUrl: data.docUrl ?? undefined,
  reviewStatus: data.status,
});

const byStartDate = (a: Gathering, b: Gathering) =>
  new Date(a.startDate ?? 0).getTime() - new Date(b.startDate ?? 0).getTime();

// EMPUSER API (EMPLOYEE + USER) -------------------------------------------------------------------

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

// EMPLOYEE API ------------------------------------------------------------------------------------

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

// USER API ----------------------------------------------------------------------------------------

export const userAPI = {
  /** Users who have signed up but aren't linked to an employee/admin record yet. */
  getUnlinkedUsers: async (): Promise<ApiResponse<any[]>> => {
    const snapshot = await getDocs(query(usersCol, where("isLinked", "==", false)));
    return ok(snapshot.docs.map((d) => withId<any>(d)).map((u) => ({ ...u, userId: u.id })));
  },
};

// ADMIN API ---------------------------------------------------------------------------------------

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

// EQUIPMENT API -----------------------------------------------------------------------------------

export const equipmentAPI = {
  /**
   * All equipment, each item paired with the employee holding it. The management
   * table reads `item.equipment.*` alongside the holder's name and picture, so the
   * employees are fetched once and joined in memory rather than per row.
   */
  getAllEquipItems: async (): Promise<ApiResponse<any[]>> => {
    const [equipmentSnapshot, employeesSnapshot] = await Promise.all([
      getDocs(query(equipmentCol, orderBy("equipmentName"))),
      getDocs(employeesCol),
    ]);

    const employees = new Map(employeesSnapshot.docs.map((d) => [d.id, d.data()]));

    // How many items each employee currently holds.
    const itemCounts = new Map<string, number>();
    equipmentSnapshot.docs.forEach((d) => {
      const employeeId = d.data().employeeId;
      if (employeeId) itemCounts.set(employeeId, (itemCounts.get(employeeId) ?? 0) + 1);
    });

    return ok(
      equipmentSnapshot.docs.map((d) => {
        const equipment = toEquipment(d.id, d.data());
        const employee = equipment.employeeId ? employees.get(equipment.employeeId) : undefined;

        return {
          equipment,
          fullName: employee?.fullName ?? null,
          profilePicture: employee?.profilePicture ?? null,
          employDate: employee?.employDate ?? null,
          isSuspended: employee?.isSuspended ?? null,
          numberOfItems: equipment.employeeId
            ? itemCounts.get(equipment.employeeId) ?? 0
            : null,
        };
      })
    );
  },

  getAllUnassignedEquipItems: async (): Promise<ApiResponse<Equipment[]>> => {
    const snapshot = await getDocs(query(equipmentCol, where("employeeId", "==", null)));
    return ok(snapshot.docs.map((d) => toEquipment(d.id, d.data())));
  },

  /**
   * Creates one or many equipment items. The category name is denormalised onto
   * each item so the equipment table doesn't need a category lookup per row.
   */
  createEquipItemOrItems: async (
    data: Record<string, any> | Record<string, any>[]
  ): Promise<ApiResponse<{ ids: string[] }>> => {
    const items = Array.isArray(data) ? data : [data];
    if (items.length === 0) return ok({ ids: [] }, 201);

    const categories = await getDocsByIds(
      "equipmentCategories",
      items.map((item) => item.equipmentCatId)
    );

    const batch = writeBatch(db);
    const ids: string[] = [];

    items.forEach((item) => {
      const ref = doc(equipmentCol);
      ids.push(ref.id);
      batch.set(ref, {
        equipmentName: item.equipmentName,
        equipmentCatId: item.equipmentCatId,
        equipmentCategoryName:
          item.equipmentCategoryName ??
          categories.get(item.equipmentCatId)?.equipmentCatName ??
          "",
        condition: item.condition,
        employeeId: item.employeeId ?? null,
        assignedDate: item.assignedDate ?? null,
        createdAt: serverTimestamp(),
      });
    });

    await batch.commit();
    return ok({ ids }, 201);
  },

  editEquipItemById: async (
    id: string,
    data: Record<string, any>
  ): Promise<ApiResponse<null>> => {
    const update = { ...data };

    // Keep the denormalised category name in step when the category changes.
    if (data.equipmentCatId && !data.equipmentCategoryName) {
      const category = await getDoc(doc(equipmentCategoriesCol, data.equipmentCatId));
      if (category.exists()) update.equipmentCategoryName = category.data().equipmentCatName;
    }

    await updateDoc(doc(equipmentCol, id), update);
    return ok(null);
  },

  assignEquipItemOrItemsToEmp: async (
    empId: string,
    equipIds: string[]
  ): Promise<ApiResponse<null>> => {
    const assignedDate = new Date().toISOString();
    const batch = writeBatch(db);

    equipIds.forEach((equipmentId) =>
      batch.update(doc(equipmentCol, equipmentId), { employeeId: empId, assignedDate })
    );

    await batch.commit();
    return ok(null);
  },

  /**
   * Unlinks an item from its holder. Despite the old DELETE verb this never
   * deleted the item — only the link.
   */
  unlinkEquipItemFromEmp: async (id: string): Promise<ApiResponse<null>> => {
    await updateDoc(doc(equipmentCol, id), { employeeId: null, assignedDate: null });
    return ok(null);
  },

  massUnlinkEquipItemsFromEmp: async (id: string): Promise<ApiResponse<null>> => {
    const snapshot = await getDocs(query(equipmentCol, where("employeeId", "==", id)));

    const batch = writeBatch(db);
    snapshot.docs.forEach((item) =>
      batch.update(item.ref, { employeeId: null, assignedDate: null })
    );

    await batch.commit();
    return ok(null);
  },

  deleteEquipItemById: async (id: string): Promise<ApiResponse<null>> => {
    await deleteDoc(doc(equipmentCol, id));
    return ok(null);
  },

  getAllEquipCategories: async (): Promise<ApiResponse<any[]>> => {
    const snapshot = await getDocs(query(equipmentCategoriesCol, orderBy("equipmentCatName")));
    return ok(
      snapshot.docs.map((d) => ({ equipmentCatId: d.id, ...d.data() }))
    );
  },
};

// LEAVE TYPES -------------------------------------------------------------------------------------

export const leaveTypesAPI = {
  getAllLeaveTypes: async (): Promise<ApiResponse<any[]>> => {
    const snapshot = await getDocs(query(leaveTypesCol, orderBy("leaveTypeName")));
    return ok(snapshot.docs.map((d) => ({ leaveTypeId: d.id, ...d.data() })));
  },
};

// LEAVE REQUESTS ----------------------------------------------------------------------------------

/** Reads leave requests with a given status, newest first. */
const getLeaveRequestsByStatus = async (
  status: LeaveStatus
): Promise<ApiResponse<LeaveRequest[]>> => {
  const snapshot = await getDocs(
    query(leaveRequestsCol, where("status", "==", status), orderBy("createdAt", "desc"))
  );
  return ok(snapshot.docs.map((d) => toLeaveRequest(d.id, d.data())));
};

/**
 * Moves a leave request between statuses, keeping the employee's balance correct.
 *
 * On the old backend approve-and-decrement was one server-side endpoint and so was
 * atomic for free. Here it is two writes, which is exactly why this runs inside a
 * `runTransaction` — shipping it as two `updateDoc` calls would let a failure
 * between them leave a request approved with the days never deducted.
 *
 * This works because a balance document is keyed by its leave type id: the client
 * SDK can't run queries inside a transaction, only direct document reads.
 */
const setLeaveRequestStatus = async (
  id: string,
  nextStatus: LeaveStatus
): Promise<ApiResponse<null>> => {
  await runTransaction(db, async (transaction) => {
    const requestRef = doc(leaveRequestsCol, id);
    const requestSnapshot = await transaction.get(requestRef);

    if (!requestSnapshot.exists()) {
      throw new Error(`No leave request found with id ${id}`);
    }

    const request = requestSnapshot.data();
    const previousStatus: LeaveStatus = request.status;

    if (previousStatus === nextStatus) return;

    const days = calculateDurationInDays(request.startDate, request.endDate);
    const balanceRef = doc(
      db,
      "employees",
      request.employeeId,
      "leaveBalances",
      request.leaveTypeId
    );
    const balanceSnapshot = await transaction.get(balanceRef);

    // Approving spends the days; moving *off* approved (rejected, or back to
    // pending) gives them back.
    let delta = 0;
    if (nextStatus === LeaveStatus.Approved) delta = -days;
    else if (previousStatus === LeaveStatus.Approved) delta = days;

    if (delta !== 0 && balanceSnapshot.exists()) {
      transaction.update(balanceRef, {
        remainingDays: balanceSnapshot.data().remainingDays + delta,
      });
    }

    transaction.update(requestRef, { status: nextStatus });
  });

  return ok(null);
};

export const empLeaveRequestsAPI = {
  getPendingLeaveRequests: () => getLeaveRequestsByStatus(LeaveStatus.Pending),
  getApprovedLeaveRequests: () => getLeaveRequestsByStatus(LeaveStatus.Approved),
  getRejectedLeaveRequests: () => getLeaveRequestsByStatus(LeaveStatus.Rejected),

  approveLeaveRequestById: (id: string) => setLeaveRequestStatus(id, LeaveStatus.Approved),
  rejectLeaveRequestById: (id: string) => setLeaveRequestStatus(id, LeaveStatus.Rejected),
  setLeaveRequestToPendingById: (id: string) => setLeaveRequestStatus(id, LeaveStatus.Pending),

  /**
   * Submits a leave request. The employee and leave type names are copied onto the
   * request so the admin list renders without a lookup per row.
   */
  createLeaveRequest: async (data: {
    employeeId: string;
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    comment: string;
  }): Promise<ApiResponse<{ id: string }>> => {
    const [employeeSnapshot, leaveTypeSnapshot] = await Promise.all([
      getDoc(doc(employeesCol, data.employeeId)),
      getDoc(doc(leaveTypesCol, data.leaveTypeId)),
    ]);

    const created = await addDoc(leaveRequestsCol, {
      employeeId: data.employeeId,
      employeeName: employeeSnapshot.data()?.fullName ?? "",
      leaveTypeId: data.leaveTypeId,
      leaveTypeName: leaveTypeSnapshot.data()?.leaveTypeName ?? "",
      description: leaveTypeSnapshot.data()?.description ?? "",
      defaultDays: leaveTypeSnapshot.data()?.defaultDays ?? 0,
      startDate: data.startDate,
      endDate: data.endDate,
      comment: data.comment,
      status: LeaveStatus.Pending,
      createdAt: new Date().toISOString(),
    });

    return ok({ id: created.id }, 201);
  },
};

// PERFORMANCE REVIEWS -----------------------------------------------------------------------------

export const performanceReviewsAPI = {
  CreatePerformanceReview: async (
    data: Record<string, any>
  ): Promise<ApiResponse<{ id: string }>> => {
    const [adminSnapshot, employeeSnapshot] = await Promise.all([
      getDoc(doc(adminsCol, data.adminId)),
      getDoc(doc(employeesCol, data.employeeId)),
    ]);

    const created = await addDoc(performanceReviewsCol, {
      ...data,
      adminName: adminSnapshot.data()?.fullName ?? "",
      employeeName: employeeSnapshot.data()?.fullName ?? "",
      rating: data.rating ?? null,
      comment: data.comment ?? null,
      docUrl: data.docUrl ?? null,
      status: data.status ?? ReviewStatus.Upcoming,
      createdAt: serverTimestamp(),
    });

    return ok({ id: created.id }, 201);
  },

  GetAllUpcomingPrm: async (): Promise<ApiResponse<PerformanceReview[]>> => {
    const snapshot = await getDocs(
      query(
        performanceReviewsCol,
        where("status", "==", ReviewStatus.Upcoming),
        orderBy("startDate")
      )
    );
    return ok(snapshot.docs.map((d) => toPerformanceReview(d.id, d.data())));
  },

  getAllUpcomingPrmByAdminId: async (
    adminId: string
  ): Promise<ApiResponse<PerformanceReview[]>> => {
    const snapshot = await getDocs(
      query(
        performanceReviewsCol,
        where("adminId", "==", adminId),
        where("status", "==", ReviewStatus.Upcoming),
        orderBy("startDate")
      )
    );
    return ok(snapshot.docs.map((d) => toPerformanceReview(d.id, d.data())));
  },

  UpdatePerformanceReview: async (
    id: string,
    data: Record<string, any>
  ): Promise<ApiResponse<null>> => {
    await updateDoc(doc(performanceReviewsCol, id), data);
    return ok(null);
  },

  UpdatePerformanceReviewStatus: async (
    id: string,
    status: ReviewStatus
  ): Promise<ApiResponse<null>> => {
    await updateDoc(doc(performanceReviewsCol, id), { status });
    return ok(null);
  },

  deletePerformanceReview: async (id: string): Promise<ApiResponse<null>> => {
    await deleteDoc(doc(performanceReviewsCol, id));
    return ok(null);
  },
};

// MEETINGS ----------------------------------------------------------------------------------------

export const meetingAPI = {
  /** An employee's own requests — the ones still pending or turned down. */
  getAllRequestsByEmpId: async (employeeId: string): Promise<ApiResponse<MeetingDTO[]>> => {
    const snapshot = await getDocs(
      query(
        meetingsCol,
        where("employeeId", "==", employeeId),
        where("status", "in", [MeetStatus.Requested, MeetStatus.Rejected])
      )
    );
    return ok(snapshot.docs.map((d) => toMeeting(d.id, d.data())));
  },

  getAllUpcomingByAdminId: async (adminId: string): Promise<ApiResponse<MeetingDTO[]>> => {
    const snapshot = await getDocs(
      query(
        meetingsCol,
        where("adminId", "==", adminId),
        where("status", "==", MeetStatus.Upcoming),
        orderBy("startDate")
      )
    );
    return ok(snapshot.docs.map((d) => toMeeting(d.id, d.data())));
  },

  /** Pending requests for an admin — rendered as cards in the requests drawer. */
  getAllPendingRequestsByAdminId: async (
    adminId: string
  ): Promise<ApiResponse<MeetingRequestCard[]>> => {
    const snapshot = await getDocs(
      query(
        meetingsCol,
        where("adminId", "==", adminId),
        where("status", "==", MeetStatus.Requested)
      )
    );

    const employees = await getDocsByIds(
      "employees",
      snapshot.docs.map((d) => d.data().employeeId)
    );

    return ok(
      snapshot.docs.map((d) => {
        const data = d.data();
        return {
          meetingId: d.id,
          employeeId: data.employeeId,
          employeeName: data.employeeName ?? "",
          profilePicture: employees.get(data.employeeId)?.profilePicture ?? "",
          purpose: data.purpose ?? "",
          requestedAt: data.requestedAt,
          status: data.status,
        };
      })
    );
  },

  createMeetingRequest: async (
    data: Record<string, any>
  ): Promise<ApiResponse<{ id: string }>> => {
    const [adminSnapshot, employeeSnapshot] = await Promise.all([
      getDoc(doc(adminsCol, data.adminId)),
      getDoc(doc(employeesCol, data.employeeId)),
    ]);

    const created = await addDoc(meetingsCol, {
      ...data,
      adminName: adminSnapshot.data()?.fullName ?? "",
      employeeName: employeeSnapshot.data()?.fullName ?? "",
      isOnline: data.isOnline ?? false,
      meetLocation: data.meetLocation ?? "",
      meetLink: data.meetLink ?? "",
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      status: MeetStatus.Requested,
      requestedAt: new Date().toISOString(),
    });

    return ok({ id: created.id }, 201);
  },

  /** Admin accepts a request and puts a time to it. */
  confirmAndScheduleMeeting: async (
    meetingId: string,
    data: Record<string, any>
  ): Promise<ApiResponse<null>> => {
    await updateDoc(doc(meetingsCol, meetingId), {
      ...data,
      status: MeetStatus.Upcoming,
    });
    return ok(null);
  },

  updateMeeting: async (
    meetingId: string,
    data: Record<string, any>
  ): Promise<ApiResponse<null>> => {
    await updateDoc(doc(meetingsCol, meetingId), data);
    return ok(null);
  },

  updateMeetingRequest: async (
    meetingId: string,
    data: Record<string, any>
  ): Promise<ApiResponse<null>> => {
    const update: Record<string, any> = { ...data };

    // An employee can reassign the request to a different admin.
    if (data.adminId) {
      const adminSnapshot = await getDoc(doc(adminsCol, data.adminId));
      update.adminName = adminSnapshot.data()?.fullName ?? "";
    }

    await updateDoc(doc(meetingsCol, meetingId), update);
    return ok(null);
  },

  rejectMeetingRequest: async (meetingId: string): Promise<ApiResponse<null>> => {
    await updateDoc(doc(meetingsCol, meetingId), { status: MeetStatus.Rejected });
    return ok(null);
  },

  markAsCompletedMeeting: async (meetingId: string): Promise<ApiResponse<null>> => {
    await updateDoc(doc(meetingsCol, meetingId), { status: MeetStatus.Completed });
    return ok(null);
  },

  markAsUpcomingMeeting: async (meetingId: string): Promise<ApiResponse<null>> => {
    await updateDoc(doc(meetingsCol, meetingId), { status: MeetStatus.Upcoming });
    return ok(null);
  },

  deleteMeetingRequest: async (meetingId: string): Promise<ApiResponse<null>> => {
    await deleteDoc(doc(meetingsCol, meetingId));
    return ok(null);
  },

  deleteMeeting: async (meetingId: string): Promise<ApiResponse<null>> => {
    await deleteDoc(doc(meetingsCol, meetingId));
    return ok(null);
  },
};

// GATHERINGS (meetings + performance reviews, merged) ----------------------------------------------

/**
 * Reads meetings and performance reviews for one person and merges them.
 * The two collections are queried in parallel — this is the fan-out pattern the
 * whole read layer leans on.
 */
const getGatherings = async (options: {
  field: "employeeId" | "adminId";
  id: string;
  meetStatuses?: MeetStatus[];
  reviewStatuses?: ReviewStatus[];
}): Promise<Gathering[]> => {
  const { field, id, meetStatuses, reviewStatuses } = options;

  const meetingConstraints = [where(field, "==", id)];
  if (meetStatuses) meetingConstraints.push(where("status", "in", meetStatuses));

  const reviewConstraints = [where(field, "==", id)];
  if (reviewStatuses) reviewConstraints.push(where("status", "in", reviewStatuses));

  const [meetingsSnapshot, reviewsSnapshot] = await Promise.all([
    getDocs(query(meetingsCol, ...meetingConstraints)),
    getDocs(query(performanceReviewsCol, ...reviewConstraints)),
  ]);

  return [
    ...meetingsSnapshot.docs.map((d) => meetingToGathering(d.id, d.data())),
    ...reviewsSnapshot.docs.map((d) => reviewToGathering(d.id, d.data())),
  ].sort(byStartDate);
};

const UPCOMING_AND_COMPLETED = {
  meetStatuses: [MeetStatus.Upcoming, MeetStatus.Completed],
  reviewStatuses: [ReviewStatus.Upcoming, ReviewStatus.Completed],
};

export const gatheringAPI = {
  getUpcomingAndCompletedGatheringsByEmpId: async (
    employeeId: string
  ): Promise<ApiResponse<Gathering[]>> =>
    ok(
      (
        await getGatherings({ field: "employeeId", id: employeeId, ...UPCOMING_AND_COMPLETED })
      ).reverse()
    ),

  getAllGatheringsByEmpId: async (employeeId: string): Promise<ApiResponse<Gathering[]>> =>
    ok(await getGatherings({ field: "employeeId", id: employeeId })),

  getAllUpcomingGatheringsByEmpId: async (
    employeeId: string
  ): Promise<ApiResponse<Gathering[]>> =>
    ok(
      await getGatherings({
        field: "employeeId",
        id: employeeId,
        meetStatuses: [MeetStatus.Upcoming],
        reviewStatuses: [ReviewStatus.Upcoming],
      })
    ),

  getAllCompletedGatheringsByEmpId: async (
    employeeId: string
  ): Promise<ApiResponse<Gathering[]>> =>
    ok(
      await getGatherings({
        field: "employeeId",
        id: employeeId,
        meetStatuses: [MeetStatus.Completed],
        reviewStatuses: [ReviewStatus.Completed],
      })
    ),

  getAllUpcomingGatheringsByAdminId: async (adminId: string): Promise<ApiResponse<Gathering[]>> =>
    ok(
      await getGatherings({
        field: "adminId",
        id: adminId,
        meetStatuses: [MeetStatus.Upcoming],
        reviewStatuses: [ReviewStatus.Upcoming],
      })
    ),

  getAllCompletedGatheringsByAdminId: async (
    adminId: string
  ): Promise<ApiResponse<Gathering[]>> =>
    ok(
      await getGatherings({
        field: "adminId",
        id: adminId,
        meetStatuses: [MeetStatus.Completed],
        reviewStatuses: [ReviewStatus.Completed],
      })
    ),

  /**
   * Everything on an admin's calendar for one month.
   *
   * Firestore can't filter on "month of a date string" server-side, so this reads
   * the admin's upcoming + completed gatherings and filters by month in JS. Fine at
   * this scale; if it ever isn't, store a `yearMonth` field and query it directly.
   */
  getUpcomingAndCompletedGatheringsByAdminIdAndMonth: async (
    adminId: string,
    month: number
  ): Promise<ApiResponse<Gathering[]>> => {
    const gatherings = await getGatherings({
      field: "adminId",
      id: adminId,
      ...UPCOMING_AND_COMPLETED,
    });

    return ok(
      gatherings.filter((gathering) => {
        if (!gathering.startDate) return false;
        return new Date(gathering.startDate).getMonth() + 1 === month;
      })
    );
  },
};

// PAGE READS (client-side fan-out) ----------------------------------------------------------------

/** Average / count / most recent rating from an employee's completed reviews. */
const ratingMetricsFor = (
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

export const pageAPI = {
  /**
   * Everything the admin's employee-detail screen needs. Replaces the old
   * `/Page/admin-emp-details/{id}` SQL join with five parallel reads.
   */
  getAdminEmpDetails: async (id: string): Promise<ApiResponse<any>> => {
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
  },

  /**
   * The admin employee table: every employee with their rating summary and total
   * leave balance.
   *
   * Leave balances are subcollections, so they're read with one collection-group
   * query rather than one query per employee — this is the read that would blow up
   * first if it were done naively.
   */
  getAdminEmpManagement: async (): Promise<ApiResponse<EmployeeListItem[]>> => {
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
  },

  /** The employee's own profile screen. */
  getEmployeeProfile: async (id: string): Promise<ApiResponse<any>> => {
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
  },

  /**
   * The admin dashboard aggregates.
   *
   * These were SQL `GROUP BY`s on the old backend; here they're computed in JS over
   * the employee and review collections. That means reading every employee and
   * every completed review on each dashboard load — acceptable for one company,
   * and the first thing to move into a Cloud Function or a precomputed aggregate
   * doc if the numbers ever grow.
   */
  getAdminDashboardData: async (adminId: string): Promise<ApiResponse<any>> => {
    const [adminSnapshot, employeesSnapshot, reviewsSnapshot, leaveSnapshot] = await Promise.all([
      getDoc(doc(adminsCol, adminId)),
      getDocs(employeesCol),
      getDocs(query(performanceReviewsCol, where("status", "==", ReviewStatus.Completed))),
      getDocs(
        query(
          leaveRequestsCol,
          where("status", "==", LeaveStatus.Pending),
          orderBy("createdAt", "desc"),
          limit(20)
        )
      ),
    ]);

    const employees = employeesSnapshot.docs.map((d) => toEmpUser(d.id, d.data()));

    const employeeStatusTotals = {
      totalEmployees: employees.length,
      totalFullTimeEmployees: employees.filter((e) => e.employType === EmployType.FullTime).length,
      totalPartTimeEmployees: employees.filter((e) => e.employType === EmployType.PartTime).length,
      totalInternEmployees: employees.filter((e) => e.employType === EmployType.Intern).length,
      totalContractEmployees: employees.filter((e) => e.employType === EmployType.Contract).length,
      totalSuspendedEmployees: employees.filter((e) => e.isSuspended).length,
    };

    const reviewsByEmployee = new Map<string, { rating: number | null; startDate: string }[]>();
    reviewsSnapshot.docs.forEach((d) => {
      const data = d.data();
      const existing = reviewsByEmployee.get(data.employeeId) ?? [];
      existing.push({ rating: data.rating ?? null, startDate: data.startDate });
      reviewsByEmployee.set(data.employeeId, existing);
    });

    const allMetrics = employees
      .map((employee) =>
        ratingMetricsFor(
          employee.employeeId,
          employee.fullName,
          reviewsByEmployee.get(employee.employeeId) ?? []
        )
      )
      .filter((metrics) => metrics.numberOfRatings > 0)
      .sort((a, b) => b.averageRating - a.averageRating);

    const employeesById = new Map(employees.map((employee) => [employee.employeeId, employee]));

    return ok({
      adminUser: adminSnapshot.exists()
        ? {
            adminId: adminSnapshot.id,
            userId: adminSnapshot.data().userId,
            fullName: adminSnapshot.data().fullName ?? null,
            email: adminSnapshot.data().email ?? null,
          }
        : null,
      // Bar chart: best five.
      empUserRatingMetrics: allMetrics.slice(0, 5),
      employeeStatusTotals,
      leaveRequests: leaveSnapshot.docs.map((d) => toLeaveRequest(d.id, d.data())),
      // Card list: best three, each paired with the employee it belongs to.
      topRatedEmployees: allMetrics.slice(0, 3).map((metrics) => ({
        employee: employeesById.get(metrics.employeeId) ?? null,
        rating: metrics,
      })),
    });
  },

  /** The employee's leave screen: their balances plus their own requests. */
  getEmployeeLeaveData: async (id: string): Promise<ApiResponse<any>> => {
    const [balancesSnapshot, requestsSnapshot] = await Promise.all([
      getDocs(leaveBalancesCol(id)),
      getDocs(
        query(
          leaveRequestsCol,
          where("employeeId", "==", id),
          orderBy("createdAt", "desc")
        )
      ),
    ]);

    return ok({
      leaveBalances: balancesSnapshot.docs.map((d) => toLeaveBalance(d.id, d.data())),
      leaveRequests: requestsSnapshot.docs.map((d) => toLeaveRequest(d.id, d.data())),
    });
  },
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

export default { empUserAPI, employeeAPI, userAPI, adminAPI, pageAPI, equipmentAPI };
