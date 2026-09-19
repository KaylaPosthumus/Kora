/**
 * Meetings and performance reviews — "gatherings" when the two are read together.
 *
 * The old backend had a Gathering endpoint that UNION-ed the two tables. Here the
 * two collections are queried in parallel and merged in JS, which is the fan-out
 * pattern the whole read layer leans on.
 */

import {
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  type FirestoreError,
} from "firebase/firestore";
import {
  MeetStatus,
  ReviewStatus,
} from "@/shared/types/common";
import type { Gathering } from "@/shared/types/gathering";
import type { MeetingDTO } from "@/shared/types/meetingDTO";
import type { MeetingRequestCard } from "@/shared/types/meetingRequestCard";
import type { PerformanceReview } from "@/shared/types/performanceReview";
import {
  ok,
  employeesCol,
  adminsCol,
  meetingsCol,
  performanceReviewsCol,
  getDocsByIds,
  toMeeting,
  toPerformanceReview,
  meetingToGathering,
  reviewToGathering,
  byStartDate,
  subscribePair,
} from "@/shared/lib/firestore";
import type {
  ApiResponse,
  Unsubscribe,
} from "@/shared/lib/firestore";

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

/**
 * Reads meetings and performance reviews for one person and merges them.
 * The two collections are queried in parallel — this is the fan-out pattern the
 * whole read layer leans on.
 */
export const getGatherings = async (options: {
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

export const UPCOMING_AND_COMPLETED = {
  meetStatuses: [MeetStatus.Upcoming, MeetStatus.Completed],
  reviewStatuses: [ReviewStatus.Upcoming, ReviewStatus.Completed],
};

/** Live version of `getGatherings` — same constraints, same merge and sort. */
export const subscribeToGatherings = (
  options: {
    field: "employeeId" | "adminId";
    id: string;
    meetStatuses?: MeetStatus[];
    reviewStatuses?: ReviewStatus[];
  },
  onData: (gatherings: Gathering[]) => void,
  onError?: (error: FirestoreError) => void
): Unsubscribe => {
  const { field, id, meetStatuses, reviewStatuses } = options;

  const meetingConstraints = [where(field, "==", id)];
  if (meetStatuses) meetingConstraints.push(where("status", "in", meetStatuses));

  const reviewConstraints = [where(field, "==", id)];
  if (reviewStatuses) reviewConstraints.push(where("status", "in", reviewStatuses));

  return subscribePair(
    query(meetingsCol, ...meetingConstraints),
    query(performanceReviewsCol, ...reviewConstraints),
    (meetings, reviews) =>
      [
        ...meetings.docs.map((d) => meetingToGathering(d.id, d.data())),
        ...reviews.docs.map((d) => reviewToGathering(d.id, d.data())),
      ].sort(byStartDate),
    onData,
    onError
  );
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
