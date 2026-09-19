import React, { useState, useEffect, useCallback } from "react";
import { Icons } from "@/constants/icons";
import KoraBtn from "@/shared/components/KoraBtn";
import { MeetRequestsBadge, MeetRequestsDrawer, AdminGatheringBox, CreatePRModal } from "@/features/gatherings/components";
import { gatheringAPI, meetingAPI } from "@/features/gatherings/api/gatheringsApi";
import { MeetingRequestCard } from "@/shared/types/meetingRequestCard";
import { Gathering } from "@/shared/types/gathering";
import { GatheringType } from "@/shared/types/common";
import { Spin } from "antd";

// Authentication
import { getFullCurrentUser } from "@/services/authService";

type TabOption = "All Upcoming" | "General Meetings" | "Performance Reviews" | "Completed";

const AdminMeetings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabOption>("All Upcoming");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allUpcomingGatherings, setAllUpcomingGatherings] = useState<Gathering[]>([]);
  const [completedGatherings, setCompletedGatherings] = useState<Gathering[]>([]);
  const [displayedGatherings, setDisplayedGatherings] = useState<Gathering[]>([]);
  const [meetRequests, setMeetRequests] = useState<MeetingRequestCard[]>([]);
  const [showCreatePRModal, setShowCreatePRModal] = useState(false);

  // State to track if any actions have been performed that require data refresh
  const [hasDataChanged, setHasDataChanged] = useState(false);

  const tabOptions: TabOption[] = [
    "All Upcoming",
    "General Meetings",
    "Performance Reviews",
    "Completed",
  ];

  const [adminId, setAdminId] = useState<string | null>(null);
  useEffect(() => {
    const fetchUserAndSetId = async () => {
      setLoading(true);
      const user = await getFullCurrentUser();
      if (user?.adminId) {
        setAdminId(user.adminId);
        setLoading(false);
      }
    };
    fetchUserAndSetId();
  }, []);

  useEffect(() => {
    console.log("adminId", adminId);
  }, [adminId]);

  // Fetch meeting requests (in drawer)
  const fetchMeetRequests = useCallback(async () => {
    if (!adminId) {
      console.log("No adminId available, skipping fetchMeetRequests");
      return;
    }
    try {
      const response = await meetingAPI.getAllPendingRequestsByAdminId(adminId);
      setMeetRequests(response.data || []);
    } catch (error) {
      console.error("Error fetching meet requests:", error);
      setMeetRequests([]);
    }
  }, [adminId]);

  // Fetch all upcoming gatherings
  const fetchUpcomingGatherings = useCallback(async () => {
    if (!adminId) {
      console.log("No adminId available, skipping fetchUpcomingGatherings");
      return;
    }
    try {
      setLoading(true);
      const response = await gatheringAPI.getAllUpcomingGatheringsByAdminId(adminId);
      setAllUpcomingGatherings(response.data || []);
    } catch (error) {
      console.error("Error fetching upcoming gatherings:", error);
      setAllUpcomingGatherings([]);
    } finally {
      setLoading(false);
    }
  }, [adminId]);

  // Fetch completed gatherings
  const fetchCompletedGatherings = useCallback(async () => {
    if (!adminId) {
      console.log("No adminId available, skipping fetchCompletedGatherings");
      return;
    }
    try {
      setLoading(true);
      const response = await gatheringAPI.getAllCompletedGatheringsByAdminId(adminId);
      setCompletedGatherings(response.data || []);
    } catch (error) {
      console.error("Error fetching completed gatherings:", error);
      setCompletedGatherings([]);
    } finally {
      setLoading(false);
    }
  }, [adminId]);

  // Filter gatherings based on active tab
  const filterGatheringsByTab = (tab: TabOption): Gathering[] => {
    switch (tab) {
      case "All Upcoming":
        return allUpcomingGatherings;
      case "General Meetings":
        return allUpcomingGatherings.filter(
          (gathering) => gathering.type === GatheringType.Meeting
        );
      case "Performance Reviews":
        return allUpcomingGatherings.filter(
          (gathering) => gathering.type === GatheringType.PerformanceReview
        );
      case "Completed":
        return completedGatherings;
      default:
        return [];
    }
  };

  // Update displayed gatherings when tab changes or data updates
  useEffect(() => {
    const filtered = filterGatheringsByTab(activeTab);
    setDisplayedGatherings(filtered);
  }, [activeTab, allUpcomingGatherings, completedGatherings]);

  // Initial data fetch
  useEffect(() => {
    if (adminId) {
      fetchMeetRequests();
      fetchUpcomingGatherings();
    }
  }, [adminId, fetchMeetRequests, fetchUpcomingGatherings]);

  // Fetch completed gatherings when Completed tab is first accessed
  useEffect(() => {
    if (activeTab === "Completed" && completedGatherings.length === 0 && adminId) {
      fetchCompletedGatherings();
    }
  }, [activeTab, completedGatherings.length, adminId, fetchCompletedGatherings]);

  // Handle tab change
  const handleTabChange = (tab: TabOption) => {
    setActiveTab(tab);

    // If data has changed due to actions, refresh the data for the new tab
    if (hasDataChanged) {
      if (tab === "Completed") {
        fetchCompletedGatherings();
      } else {
        fetchUpcomingGatherings();
      }
      setHasDataChanged(false);
    }
  };

  // Handle data refresh after operations
  const handleDataRefresh = useCallback(() => {
    if (!adminId) {
      console.log("No adminId available, skipping data refresh");
      return;
    }
    fetchMeetRequests();
    if (activeTab === "Completed") {
      fetchCompletedGatherings();
    } else {
      fetchUpcomingGatherings();
    }
    // Mark that data has changed so other tabs will refresh when opened
    setHasDataChanged(true);
  }, [adminId, activeTab, fetchMeetRequests, fetchCompletedGatherings, fetchUpcomingGatherings]);

  // Handle actions that affect gatherings (edit, delete, create)
  const handleGatheringAction = useCallback(() => {
    // Refresh current tab data immediately
    handleDataRefresh();
  }, [handleDataRefresh]);

  // Everything below needs the admin id — the drawer and the create-review modal both
  // take it as a required prop. Waiting for it here replaces handing them a null.
  if (!adminId)
    return (
      <div className="w-full h-full flex flex-col justify-center items-center">
        <Spin size="large" />
      </div>
    );

  return (
    <div className="max-w-7xl mx-auto m-4">
      {/* Page Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Icons.MeetingRoom fontSize="large" className="text-zinc-900" />
            <h1 className="text-3xl font-bold text-zinc-900">Meetings</h1>
          </div>
          <MeetRequestsBadge requests={meetRequests.length} onClick={() => setDrawerOpen(true)} />
        </div>
        <div className="flex items-center gap-2">
          <KoraBtn secondary onClick={() => setShowCreatePRModal(true)}>
            New Review Meet
          </KoraBtn>
          {meetRequests.length > 0 ? (
            <KoraBtn style="red" onClick={() => setDrawerOpen(true)}>
              {meetRequests.length} Request{meetRequests.length === 1 ? "" : "s"}
              <Icons.MarkChatUnread />
            </KoraBtn>
          ) : (
            <KoraBtn onClick={() => setDrawerOpen(true)}>
              No Requests
              <Icons.MarkChatUnread />
            </KoraBtn>
          )}
        </div>
      </div>

      {/* Tab Buttons */}
      <div className="flex gap-2 mb-4">
        {tabOptions.map((tab) => (
          <KoraBtn
            key={tab}
            onClick={() => handleTabChange(tab)}
            secondary
            className={`btn kora-btn ${
              activeTab === tab
                ? "bg-zinc-900 text-white border-none"
                : "border-zinc-900 text-zinc-900"
            }`}
          >
            {tab}
          </KoraBtn>
        ))}
      </div>

      {/* Page Content */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Spin size="large" />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {displayedGatherings.map((gathering) => (
            <AdminGatheringBox
              key={gathering.id}
              gathering={gathering}
              loggedInAdminId={adminId}
              onEditSuccess={handleGatheringAction}
              onDeleteSuccess={handleGatheringAction}
            />
          ))}
          {displayedGatherings.length === 0 && (
            <div className="col-span-3 text-center text-zinc-500 py-8">No meetings found.</div>
          )}
        </div>
      )}

      {/* Meeting Requests Drawer */}
      <MeetRequestsDrawer
        drawerOpen={drawerOpen}
        setDrawerOpen={setDrawerOpen}
        adminId={adminId}
        onApprove={handleDataRefresh}
      />

      {/* Create Performance Review Modal */}
      <CreatePRModal
        showModal={showCreatePRModal}
        setShowModal={setShowCreatePRModal}
        onCreateSuccess={handleGatheringAction}
        adminId={adminId}
      />
    </div>
  );
};

export default AdminMeetings;
