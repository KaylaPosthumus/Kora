/**
 * The Firestore plumbing every feature's API module sits on.
 *
 * Split out of the old `services/api.service.ts`, which held all of this plus the
 * eleven API groups in one 1,500-line file. Nothing here is domain logic: it is
 * the response envelope, the collection references, the document-to-DTO
 * converters, and the two-source subscription helper.
 *
 * Every function still returns `{ data, status }` — the shape the components
 * were already destructuring off axios, so call sites never had to change.
 */

import {
  collection,
  getDocs,
  query,
  where,
  documentId,
  onSnapshot,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Query,
  type QuerySnapshot,
  type FirestoreError,
} from "firebase/firestore";
import {
  GatheringType,
} from "@/shared/types/common";
import type { EmpUser } from "@/shared/types/empUser";
import type { Equipment } from "@/shared/types/equipment";
import type { LeaveBalance } from "@/shared/types/leaveBalance";
import type { LeaveRequest } from "@/shared/types/leaveRequest";
import type { Gathering } from "@/shared/types/gathering";
import type { MeetingDTO } from "@/shared/types/meetingDTO";
import type { PerformanceReview } from "@/shared/types/performanceReview";
import { db } from "@/services/firebase";

// Response envelope & helpers ---------------------------------------------------------------------

export interface ApiResponse<T = any> {
  data: T;
  status: number;
}

export const ok = <T,>(data: T, status = 200): ApiResponse<T> => ({ data, status });

/** Collection references, in one place so a rename is a single edit. */
export const usersCol = collection(db, "users");
export const employeesCol = collection(db, "employees");
export const adminsCol = collection(db, "admins");
export const equipmentCol = collection(db, "equipment");
export const equipmentCategoriesCol = collection(db, "equipmentCategories");
export const leaveTypesCol = collection(db, "leaveTypes");
export const leaveRequestsCol = collection(db, "leaveRequests");
export const meetingsCol = collection(db, "meetings");
export const performanceReviewsCol = collection(db, "performanceReviews");

/** Leave balances live under the employee they belong to. */
export const leaveBalancesCol = (employeeId: string) =>
  collection(db, "employees", employeeId, "leaveBalances");

/** Merges a document's id into its data. */
export const withId = <T,>(snapshot: QueryDocumentSnapshot<DocumentData>): T =>
  ({ id: snapshot.id, ...snapshot.data() } as T);

/**
 * Firestore rejects an `in` filter with more than 30 values, so chunk the ids and
 * run the reads in parallel.
 */
export const chunk = <T,>(items: T[], size = 30): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

/** Fetches documents by id from a collection, in parallel batches. */
export const getDocsByIds = async (
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
export const toEmpUser = (id: string, data: DocumentData): EmpUser => ({
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

export const toEquipment = (id: string, data: DocumentData): Equipment => ({
  equipmentId: id,
  employeeId: data.employeeId ?? null,
  equipmentCatId: data.equipmentCatId,
  equipmentCategoryName: data.equipmentCategoryName ?? "",
  equipmentName: data.equipmentName,
  assignedDate: data.assignedDate ?? null,
  condition: data.condition,
});

export const toLeaveBalance = (id: string, data: DocumentData): LeaveBalance => ({
  // The balance doc is keyed by leave type id, which is what makes the
  // approve-and-decrement transaction below possible (see approveLeaveRequestById).
  leaveBalanceId: id,
  remainingDays: data.remainingDays,
  leaveTypeName: data.leaveTypeName ?? "",
  description: data.description ?? "",
  defaultDays: data.defaultDays ?? 0,
});

export const toLeaveRequest = (id: string, data: DocumentData): LeaveRequest => ({
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

export const toMeeting = (id: string, data: DocumentData): MeetingDTO => ({
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

export const toPerformanceReview = (id: string, data: DocumentData): PerformanceReview => ({
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
export const meetingToGathering = (id: string, data: DocumentData): Gathering => ({
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

export const reviewToGathering = (id: string, data: DocumentData): Gathering => ({
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

export const byStartDate = (a: Gathering, b: Gathering) =>
  new Date(a.startDate ?? 0).getTime() - new Date(b.startDate ?? 0).getTime();

// LIVE READS ---------------------------------------------------------------------------------------

/**
 * Live equivalents of the fan-out reads above.
 *
 * The one-shot reads stay: pages that only render once still use them, and the
 * mutation helpers are unchanged. These exist for the employee screens, where a
 * request's status changes underneath the user — an admin approves leave or
 * schedules a meeting — and a manual refresh was the only way to see it.
 *
 * Each subscription spans two collections, mirroring the fan-out it replaces, so
 * they wait for both listeners to deliver before emitting. Emitting on the first
 * one would render an empty half for a frame.
 */

export type Unsubscribe = () => void;

export const subscribePair = <T>(
  first: Query<DocumentData>,
  second: Query<DocumentData>,
  merge: (a: QuerySnapshot<DocumentData>, b: QuerySnapshot<DocumentData>) => T,
  onData: (value: T) => void,
  onError?: (error: FirestoreError) => void
): Unsubscribe => {
  let firstSnapshot: QuerySnapshot<DocumentData> | null = null;
  let secondSnapshot: QuerySnapshot<DocumentData> | null = null;

  const emit = () => {
    if (firstSnapshot && secondSnapshot) onData(merge(firstSnapshot, secondSnapshot));
  };

  // A denied read or a missing index surfaces here rather than as a rejected
  // promise, so an error callback is the only way a caller hears about it.
  const handleError = (error: FirestoreError) => onError?.(error);

  const unsubscribeFirst = onSnapshot(
    first,
    (snapshot) => {
      firstSnapshot = snapshot;
      emit();
    },
    handleError
  );

  const unsubscribeSecond = onSnapshot(
    second,
    (snapshot) => {
      secondSnapshot = snapshot;
      emit();
    },
    handleError
  );

  return () => {
    unsubscribeFirst();
    unsubscribeSecond();
  };
};
