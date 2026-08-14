import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Table, Dropdown, Tooltip, Button, message } from "antd";
import type { TableProps, MenuProps } from "antd";
import { Icons } from "../../constants/icons";
import CoriBtn from "../../components/buttons/CoriBtn";
import { gatheringAPI, meetingAPI } from "../../services/api.service";
import { GatheringType, MeetStatus, ReviewStatus } from "../../types/common";
import GatheringStatusBadge from "../../components/badges/GatheringStatusBadge";
import { formatTimestampToDate, formatTimestampToTime } from "../../utils/dateUtils";
import { downloadFileFromUrl } from "../../utils/fileUtils";
import dayjs from "dayjs";
import { Gathering } from "../../interfaces/gathering/gathering";
import MeetRequestsBadge from "../../components/badges/MeetRequestsBadge";
import RequestMeetingModal from "../../components/modals/RequestMeetingModal";
import EditMeetingRequestModal from "../../components/modals/EditMeetingRequestModal";
import { getFullCurrentUser } from "../../services/authService";

// Types for table
type ColumnsType<T extends object = object> = TableProps<T>["columns"];

// State for data
const EmployeeMeetings: React.FC = () => {
  type TabOption = "All" | "Upcoming" | "Completed" | "Requests";
  const [activeTab, setActiveTab] = useState<TabOption>("All");
  const tabOptions: TabOption[] = ["All", "Upcoming", "Completed", "Requests"];

  const [allData, setAllData] = useState<Gathering[]>([]);
  const [filteredData, setFilteredData] = useState<Gathering[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedGathering, setSelectedGathering] = useState<Gathering | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  // Modals
  const [showRequestMeetingModal, setShowRequestMeetingModal] = useState(false);
  const [showEditMeetingRequestModal, setShowEditMeetingRequestModal] = useState(false);

  const [employeeId, setEmployeeId] = useState<string | null>(null);

  const fetchUserAndSetId = async () => {
    const user = await getFullCurrentUser();
    if (user?.employeeId) {
      setEmployeeId(user.employeeId);
    }
  };

  useEffect(() => {
    fetchUserAndSetId();
  }, []);

  useEffect(() => {
    if (employeeId) {
      fetchAndUpdateData();
    }
  }, [employeeId]);

  useEffect(() => {
    console.log("employeeId", employeeId);
  }, [employeeId]);

  // Function to fetch and update data
  const fetchAndUpdateData = async () => {
    console.log("EmployeeId right now is: ", employeeId);

    let currentEmployeeId = employeeId;

    // If employeeId is null, fetch it directly
    if (!currentEmployeeId) {
      console.log("EmployeeId is null, fetching from current user");
      const user = await getFullCurrentUser();
      currentEmployeeId = user?.employeeId || null;

      if (!currentEmployeeId) {
        console.log("Unable to get employeeId, skipping fetch");
        return;
      }
    }

    setLoading(true);

    try {
      console.log("Current employeeId", currentEmployeeId);
      const response = await gatheringAPI.getAllGatheringsByEmpId(currentEmployeeId);
      const gatherings = response.data;

      // Sort the gatherings: null dates first, then most recent to oldest
      const sortedGatherings = [...gatherings].sort((a, b) => {
        // If both have start dates, sort by start date (newest first)
        if (a.startDate && b.startDate) {
          return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
        }

        // If neither have start dates, sort by requestedAt (newest first)
        if (!a.startDate && !b.startDate) {
          if (!a.requestedAt || !b.requestedAt) return 0;
          return new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime();
        }

        // If only one has a start date, the one without goes first
        if (!a.startDate) return -1;
        if (!b.startDate) return 1;

        return 0;
      });

      setAllData(sortedGatherings);
      setFilteredData(sortedGatherings);
    } catch (error) {
      console.error("Error fetching gatherings:", error);
      messageApi.error("Failed to refresh data. Please try again.");
      throw error; // Re-throw so calling functions know the refresh failed
    } finally {
      setLoading(false);
    }
  };

  // Filter data when tab changes
  useEffect(() => {
    let filtered;
    switch (activeTab) {
      case "All":
        filtered = allData;
        break;
      case "Upcoming":
        filtered = allData.filter(
          (item) =>
            (item.type === GatheringType.Meeting && item.meetingStatus === MeetStatus.Upcoming) ||
            (item.type === GatheringType.PerformanceReview &&
              item.reviewStatus === ReviewStatus.Upcoming)
        );
        break;
      case "Completed":
        filtered = allData.filter(
          (item) =>
            (item.type === GatheringType.Meeting && item.meetingStatus === MeetStatus.Completed) ||
            (item.type === GatheringType.PerformanceReview &&
              item.reviewStatus === ReviewStatus.Completed)
        );
        break;
      case "Requests":
        filtered = allData.filter(
          (item) =>
            item.type === GatheringType.Meeting &&
            item.meetingStatus &&
            [MeetStatus.Requested, MeetStatus.Rejected].includes(item.meetingStatus)
        );
        break;
      default:
        filtered = allData;
    }
    setFilteredData(filtered);
  }, [activeTab, allData]);

  // Handle the selection of a meeting
  const handleEditMeetingRequest = (gathering: Gathering) => {
    setSelectedGathering(gathering);
    setShowEditMeetingRequestModal(true);
  };

  // Handle the deletion of a meeting request
  const handleDeleteMeetingRequest = async (meetingId: string) => {
    try {
      console.log("deleting meeting request", meetingId);
      await meetingAPI.deleteMeetingRequest(meetingId);
      messageApi.success("Meeting request deleted successfully");

      // Add a small delay to ensure backend has processed the deletion
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Ensure data refresh completes
      try {
        console.log("refreshing data");
        await fetchAndUpdateData();
      } catch (refreshError) {
        // If refresh fails, show a warning but don't override the success message
        console.error("Failed to refresh data after deletion:", refreshError);
        messageApi.warning("Request deleted but failed to refresh data. Please refresh the page.");
      }
    } catch (error) {
      messageApi.error("Error deleting meeting request");
      console.error("Error deleting meeting request:", error);
    }
  };

  // Handle the joining of a meeting (btn press)
  const handleJoinMeeting = (gathering: Gathering) => {
    if (gathering.meetLink) {
      if (gathering.meetLink.includes("https://")) {
        window.open(`${gathering.meetLink}`, "_blank");
      } else {
        window.open(`https://${gathering.meetLink}`, "_blank");
      }
    }
  };

  // Table columns
  const columns = useMemo<ColumnsType<Gathering>>(
    () => [
      {
        title: "Meeting Name & Date",
        dataIndex: "startDate",
        key: "startDate",
        width: "30%",
        render: (_, record) => (
          <div className="flex items-center gap-3">
            {record.type === GatheringType.Meeting ? (
              record.meetingStatus === MeetStatus.Requested ||
              record.meetingStatus === MeetStatus.Rejected ? (
                // Meeting Request
                <Tooltip title="Meeting Request">
                  <div className="bg-zinc-200 rounded-full h-12 w-12 flex items-center justify-center">
                    <Icons.LiveHelp className="text-zinc-400" />
                  </div>
                </Tooltip>
              ) : (
                // Standard Meeting
                <Tooltip title="Standard Meeting">
                  <div className="bg-sakura-100 rounded-full h-12 w-12 flex items-center justify-center">
                    <Icons.Chat className="text-sakura-400" />
                  </div>
                </Tooltip>
              )
            ) : (
              // Performance Review
              <Tooltip title="Performance Review">
                <div className="bg-corigreen-100 rounded-full h-12 w-12 flex items-center justify-center">
                  <Icons.StarRounded className="text-corigreen-400" />
                </div>
              </Tooltip>
            )}
            <div className="flex flex-col">
              <p className="font-medium">
                {record.type === GatheringType.Meeting ? "Meet with" : "Review with"}{" "}
                {record.adminName}
              </p>
              {record.startDate && record.endDate ? (
                <div className="text-sm text-zinc-500">
                  {formatTimestampToTime(record.startDate.toString())} -{" "}
                  {formatTimestampToTime(record.endDate.toString())} •{" "}
                  {formatTimestampToDate(record.startDate.toString())}
                </div>
              ) : record.requestedAt ? (
                <div className="text-sm text-zinc-500">
                  Requested: {dayjs(record.requestedAt).format("DD MMM YYYY")}
                </div>
              ) : (
                <div className="text-sm text-zinc-500">Date not set</div>
              )}
            </div>
          </div>
        ),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        align: "center",
        render: (_, record) => {
          if (record.type === GatheringType.Meeting) {
            // Requested Status
            if (record.meetingStatus === MeetStatus.Requested) {
              return (
                <div className="flex items-center justify-center">
                  <GatheringStatusBadge status={MeetStatus.Requested} />
                </div>
              );
            }
            // Upcoming Status
            else if (record.meetingStatus === MeetStatus.Upcoming) {
              return (
                <div className="flex items-center justify-center">
                  <GatheringStatusBadge status={record.isOnline ? "Online" : MeetStatus.Upcoming} />
                </div>
              );
            }
            // Completed Status
            else if (record.meetingStatus === MeetStatus.Completed) {
              return (
                <div className="flex items-center justify-center">
                  <GatheringStatusBadge status={MeetStatus.Completed} />
                </div>
              );
            }
            // Rejected Status
            else if (record.meetingStatus === MeetStatus.Rejected) {
              return (
                <div className="flex items-center justify-center">
                  <GatheringStatusBadge status={MeetStatus.Rejected} />
                </div>
              );
            }
            return null;
          } else {
            // Performance Review
            if (record.reviewStatus === ReviewStatus.Upcoming) {
              return (
                <div className="flex items-center justify-center">
                  <GatheringStatusBadge status={record.isOnline ? "Online" : MeetStatus.Upcoming} />
                </div>
              );
            }
            // Completed Status
            else if (record.reviewStatus === ReviewStatus.Completed) {
              return (
                <div className="flex items-center justify-center">
                  <GatheringStatusBadge status={MeetStatus.Completed} />
                </div>
              );
            }
            return null;
          }
        },
      },
      {
        title: "Location",
        key: "location",
        render: (_, record) => {
          if (
            record.type === GatheringType.Meeting &&
            record.meetingStatus === MeetStatus.Requested
          ) {
            return <p className="text-zinc-500 text-sm">TBD</p>;
          } else if (
            record.type === GatheringType.Meeting &&
            record.meetingStatus === MeetStatus.Rejected
          ) {
            return <p className="text-zinc-500">-</p>;
          } else {
            return record.isOnline ? (
              <a
                href={record.meetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-600 hover:underline text-sm"
              >
                {record.meetLink}
              </a>
            ) : (
              <p className="text-zinc-700 text-sm">{record.meetLocation || "-"}</p>
            );
          }
        },
      },
      {
        title: "Rating",
        dataIndex: "rating",
        key: "rating",
        align: "center",
        render: (_, record) => {
          if (record.type === GatheringType.Meeting) {
            return <p className="text-zinc-500 text-sm">N/A</p>;
          } else {
            // Performance Review
            return record.rating || record.docUrl ? (
              <div className="flex items-center gap-2 justify-center">
                {record.rating && (
                  <div className="flex items-center">
                    <Icons.StarRounded className="text-yellow-500" />
                    <span>{record.rating}</span>
                  </div>
                )}
                {record.docUrl && (
                  <Tooltip title="Document Attached">
                    <Icons.TextSnippet className="text-zinc-500" />
                  </Tooltip>
                )}
              </div>
            ) : (
              <p className="text-zinc-500 text-sm">No rating</p>
            );
          }
        },
      },
      {
        title: "Comment / Purpose",
        dataIndex: "comment",
        key: "comment",
        render: (_, record) => {
          if (record.type === GatheringType.Meeting) {
            return (
              <p className="text-zinc-700 text-sm">{record.purpose || "No Purpose Specified"}</p>
            );
          } else {
            // Performance Review
            return <p className="text-zinc-700 text-sm">{record.comment || "No Comment"}</p>;
          }
        },
      },
      {
        title: "",
        key: "action",
        render: (_, record) => {
          let menuItems: MenuProps["items"] = [];

          if (record.type === GatheringType.Meeting) {
            // Standard Meeting - Requested Status
            if (record.meetingStatus === MeetStatus.Requested) {
              menuItems = [
                {
                  key: "1",
                  label: "Edit Request",
                  icon: <Icons.Edit />,
                  onClick: () => handleEditMeetingRequest(record),
                },
                {
                  key: "2",
                  label: "Retract Request",
                  icon: <Icons.Delete />,
                  danger: true,
                  onClick: () => {
                    handleDeleteMeetingRequest(record.id);
                  },
                },
              ];
              // Standard Meeting - Rejected Status
            } else if (record.meetingStatus === MeetStatus.Rejected) {
              menuItems = [
                {
                  key: "1",
                  label: "Delete Request",
                  icon: <Icons.Delete />,
                  danger: true,
                  onClick: () => {
                    handleDeleteMeetingRequest(record.id);
                  },
                },
              ];
              // Standard Meeting - Upcoming Status & Online
            } else if (record.meetingStatus === MeetStatus.Upcoming && record.isOnline) {
              menuItems = [
                {
                  key: "1",
                  label: "Join Meeting",
                  icon: <Icons.MeetingRoom />,
                  onClick: () => handleJoinMeeting(record),
                },
              ];
            }
          } else {
            // Performance Review - Upcoming Status & Online
            if (record.isOnline) {
              menuItems = [
                {
                  key: "1",
                  label: "Join Meeting",
                  icon: <Icons.MeetingRoom />,
                  onClick: () => window.open(record.meetLink, "_blank"),
                },
              ];
            }
            // Performance Review - Document Attached
            if (record.docUrl) {
              menuItems.push({
                key: "2",
                label: "Download Doc",
                icon: <Icons.Download />,
                onClick: () => downloadFileFromUrl(record.docUrl || "", messageApi),
              });
            }
          }

          return (
            <Dropdown
              menu={{ items: menuItems }}
              trigger={["click"]}
              disabled={menuItems.length === 0}
              placement="bottomRight"
              dropdownRender={(menu) => (
                <div className="border-2 border-zinc-100 rounded-2xl">{menu}</div>
              )}
            >
              <Button className="border-none bg-transparent">
                <Icons.MoreVertRounded className="text-zinc-500" />
              </Button>
            </Dropdown>
          );
        },
      },
    ],
    []
  );

  return (
    <>
      {contextHolder}
      <div className="max-w-7xl mx-auto m-4">
        {/* Page Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Icons.MeetingRoom fontSize="large" className="text-zinc-900" />
              <h1 className="text-3xl font-bold text-zinc-900">My Meetings</h1>
            </div>
            <MeetRequestsBadge
              requests={
                filteredData.filter(
                  (item) =>
                    item.type === GatheringType.Meeting &&
                    item.meetingStatus === MeetStatus.Requested
                ).length
              }
              employee
            />
          </div>
          <div className="flex items-center gap-2">
            <CoriBtn onClick={() => setShowRequestMeetingModal(true)}>
              <Icons.Add />
              Request a Meeting
            </CoriBtn>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex gap-2 mb-4">
          {tabOptions.map((tab) => (
            <CoriBtn
              key={tab}
              onClick={() => setActiveTab(tab)}
              secondary
              className={`btn cori-btn ${
                activeTab === tab
                  ? "bg-zinc-900 text-white border-none"
                  : "border-zinc-900 text-zinc-900"
              }`}
            >
              {tab}
            </CoriBtn>
          ))}
        </div>

        {/* Table */}
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey={(record) => `${record.type}-${record.id}`}
          loading={loading}
          className="mt-4"
          pagination={{ pageSize: 10 }}
        />

        <RequestMeetingModal
          showModal={showRequestMeetingModal}
          setShowModal={setShowRequestMeetingModal}
          employeeId={employeeId || ""}
          onSubmitSuccess={() => {
            setShowRequestMeetingModal(false);
            fetchAndUpdateData();
          }}
        />

        <EditMeetingRequestModal
          showModal={showEditMeetingRequestModal}
          setShowModal={setShowEditMeetingRequestModal}
          gathering={selectedGathering}
          onSubmitSuccess={() => {
            setShowEditMeetingRequestModal(false);
            setSelectedGathering(null);
            fetchAndUpdateData();
          }}
        />
      </div>
    </>
  );
};

export default EmployeeMeetings;
