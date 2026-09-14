import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Table, Dropdown, Tooltip, Button, message, Spin, Empty } from "antd";
import type { TableProps, MenuProps } from "antd";
import { Icons } from "../../constants/icons";
import KoraBtn from "../../components/buttons/KoraBtn";
import { meetingAPI, subscribeToGatherings } from "../../services/api.service";
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

/**
 * Newest first, with anything undated ahead of the rest — a meeting request that
 * has not been scheduled yet has no start date and is the row the employee most
 * likely wants to see.
 */
const sortGatherings = (gatherings: Gathering[]): Gathering[] =>
  [...gatherings].sort((a, b) => {
    if (a.startDate && b.startDate) {
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    }

    if (!a.startDate && !b.startDate) {
      if (!a.requestedAt || !b.requestedAt) return 0;
      return new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime();
    }

    if (!a.startDate) return -1;
    if (!b.startDate) return 1;

    return 0;
  });

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

  // Live data. An admin scheduling, rejecting or completing one of these changes
  // it underneath the employee, and a manual refresh used to be the only way to
  // see that. The filter effect below derives everything from `allData`, so the
  // whole page follows from this one subscription.
  useEffect(() => {
    if (!employeeId) return;

    setLoading(true);

    const unsubscribe = subscribeToGatherings(
      { field: "employeeId", id: employeeId },
      (gatherings) => {
        setAllData(sortGatherings(gatherings));
        setLoading(false);
      },
      (error) => {
        console.error("Error subscribing to gatherings:", error);
        messageApi.error("Failed to load meetings. Please refresh the page.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [employeeId]);

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
      await meetingAPI.deleteMeetingRequest(meetingId);
      // Firestore applies the delete to the local cache before the server
      // confirms it, so the subscription drops the row immediately. There is
      // nothing left to refresh, and no window in which the row lingers.
      messageApi.success("Meeting request deleted successfully");
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

  /**
   * Renders one table column's cell for a record, found by its key. The card
   * view reuses the table's renderers this way rather than restating the status,
   * location and action logic a second time.
   */
  const renderCell = (key: string, record: Gathering, index: number): React.ReactNode => {
    const column = columns?.find((candidate) => "key" in candidate && candidate.key === key);
    if (!column || !("render" in column) || typeof column.render !== "function") return null;
    return column.render(undefined, record, index) as React.ReactNode;
  };

  return (
    <>
      {contextHolder}
      <div className="max-w-7xl mx-auto m-4">
        {/* Page Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Icons.MeetingRoom fontSize="large" className="text-zinc-900" />
              <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900">My Meetings</h1>
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
            <KoraBtn onClick={() => setShowRequestMeetingModal(true)}>
              <Icons.Add />
              Request a Meeting
            </KoraBtn>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex gap-2 mb-4 overflow-x-auto -mx-1 px-1 pb-1">
          {tabOptions.map((tab) => (
            <KoraBtn
              key={tab}
              onClick={() => setActiveTab(tab)}
              secondary
              className={`btn kora-btn flex-shrink-0 ${
                activeTab === tab
                  ? "bg-zinc-900 text-white border-none"
                  : "border-zinc-900 text-zinc-900"
              }`}
            >
              {tab}
            </KoraBtn>
          ))}
        </div>

        {/* Table — lg and up. A six-column table is the main mobile pain point,
            so below lg the same rows render as cards instead. */}
        <div className="hidden lg:block">
          <Table
            columns={columns}
            dataSource={filteredData}
            rowKey={(record) => `${record.type}-${record.id}`}
            loading={loading}
            className="mt-4"
            pagination={{ pageSize: 10 }}
          />
        </div>

        {/* Cards — below lg. These call the same column renderers as the table
            above, looked up by key, so the two views cannot drift apart. */}
        <div className="lg:hidden mt-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Spin />
            </div>
          ) : filteredData.length === 0 ? (
            <Empty description="No meetings" className="py-8" />
          ) : (
            <div className="flex flex-col gap-3">
              {filteredData.map((record, index) => (
                <div
                  key={`${record.type}-${record.id}`}
                  className="rounded-2xl border-2 border-zinc-100 p-4"
                >
                  {/* Title carries its own icon, date and time; the action menu
                      sits beside it exactly as it does in the table row. */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">{renderCell("startDate", record, index)}</div>
                    <div className="flex-shrink-0 -mr-2">
                      {renderCell("action", record, index)}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {renderCell("status", record, index)}
                  </div>

                  <dl className="mt-3 grid grid-cols-[auto,1fr] gap-x-3 gap-y-2 text-sm">
                    <dt className="text-zinc-500">Location</dt>
                    <dd className="min-w-0 break-words">{renderCell("location", record, index)}</dd>

                    {record.type !== GatheringType.Meeting && (
                      <>
                        <dt className="text-zinc-500">Rating</dt>
                        <dd>{renderCell("rating", record, index)}</dd>
                      </>
                    )}

                    <dt className="text-zinc-500">
                      {record.type === GatheringType.Meeting ? "Purpose" : "Comment"}
                    </dt>
                    <dd className="min-w-0 break-words">{renderCell("comment", record, index)}</dd>
                  </dl>
                </div>
              ))}
            </div>
          )}
        </div>

        <RequestMeetingModal
          showModal={showRequestMeetingModal}
          setShowModal={setShowRequestMeetingModal}
          employeeId={employeeId || ""}
          onSubmitSuccess={() => setShowRequestMeetingModal(false)}
        />

        <EditMeetingRequestModal
          showModal={showEditMeetingRequestModal}
          setShowModal={setShowEditMeetingRequestModal}
          gathering={selectedGathering}
          onSubmitSuccess={() => {
            setShowEditMeetingRequestModal(false);
            setSelectedGathering(null);
          }}
        />
      </div>
    </>
  );
};

export default EmployeeMeetings;
