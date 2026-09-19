import React, { useState, useEffect } from "react";
import { LeaveStatus } from "@/shared/types/common";
import { subscribeToEmployeeLeave } from "@/services/api.service";

// Icons
import { ClockCircleOutlined } from "@ant-design/icons";
import { Icons } from "@/constants/icons";

// Graphs & Tooltip
import { Progress, Tooltip, Spin } from "antd";

// Badge
import KoraBadge from "@/shared/components/KoraBadge";
import { LeaveRequestCard, ApplyForLeaveModal } from "@/features/leave/components";

// Apply-for-leave modal
import { getFullCurrentUser } from "@/services/authService";

// KoraBtn component
import KoraBtn from "@/shared/components/KoraBtn";

const getLeaveIcon = (type: string) => {
  if (type.toLowerCase().includes("annual")) return <Icons.BeachAccess fontSize="large" />;
  if (type.toLowerCase().includes("family")) return <Icons.FamilyRestroom fontSize="large" />;
  if (type.toLowerCase().includes("sick")) return <Icons.Sick fontSize="large" />;
  if (type.toLowerCase().includes("compassion")) return <Icons.HeartBroken fontSize="large" />;
  if (type.toLowerCase().includes("study")) return <Icons.MenuBook fontSize="large" />;
  if (type.toLowerCase().includes("parental")) return <Icons.ChildFriendly fontSize="large" />;
  return null;
};

type TabOption = "All" | "Approved" | "Pending" | "Rejected";

const EmployeeLeaveOverview: React.FC = () => {
  const [allRequests, setAllRequests] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [summary, setSummary] = useState<{
    totalRemaining: number;
    totalAllowed: number;
  }>({
    totalRemaining: 0,
    totalAllowed: 0,
  });
  const [activeTab, setActiveTab] = useState<TabOption>("All");
  const [showModal, setShowModal] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const tabOptions: TabOption[] = ["All", "Approved", "Pending", "Rejected"];

  // Define a palette of Tailwind color classes for balance bars
  const barColors = [
    "bg-corigreen-500", // Annual Leave
    "bg-red-500", // Family Responsibility Leave
    "bg-yellow-300", // Sick Leave
    "bg-sakura-500", // Parental Leave
    "bg-blue-400", // Study Leave
    "bg-orange-400", // Compassionate Leave
  ];

  useEffect(() => {
    const fetchUserAndSetId = async () => {
      const user = await getFullCurrentUser();
      if (user?.employeeId) {
        setEmployeeId(user.employeeId);
      }
    };
    fetchUserAndSetId();
  }, []);

  // Live data. A leave request's status changes when an admin approves or
  // rejects it, and the balance moves in the same transaction — both land here
  // without a refresh, which is the pair the employee is most likely watching.
  useEffect(() => {
    if (!employeeId) return;

    setInitialLoading(true);

    const unsubscribe = subscribeToEmployeeLeave(
      employeeId,
      ({ leaveBalances, leaveRequests }) => {
        setBalances(
          leaveBalances.map((b: any) => ({
            leaveTypeId: b.leaveBalanceId,
            leaveTypeName: b.leaveTypeName,
            remainingDays: b.remainingDays,
            defaultDays: b.defaultDays,
          }))
        );

        setSummary({
          totalAllowed: leaveBalances.reduce((sum: number, b: any) => sum + b.defaultDays, 0),
          totalRemaining: leaveBalances.reduce((sum: number, b: any) => sum + b.remainingDays, 0),
        });

        setAllRequests(leaveRequests);
        setHasInitiallyLoaded(true);
        setInitialLoading(false);
        setContentLoading(false);
      },
      (error) => {
        console.error("Error subscribing to employee leave data:", error);
        setAllRequests([]);
        setBalances([]);
        setInitialLoading(false);
        setContentLoading(false);
      }
    );

    return unsubscribe;
  }, [employeeId]);

  // Tab filtering runs against data that is already in hand. It used to refetch
  // the whole page on every tab switch.
  useEffect(() => {
    const statusForTab: Partial<Record<TabOption, LeaveStatus>> = {
      Approved: LeaveStatus.Approved,
      Pending: LeaveStatus.Pending,
      Rejected: LeaveStatus.Rejected,
    };

    const status = statusForTab[activeTab];
    setRequests(status ? allRequests.filter((r: any) => r.status === status) : allRequests);
  }, [activeTab, allRequests]);

  // Read editable policy or fallback
  const policy =
    localStorage.getItem("leavePolicy") ||
    `Employees must submit leave requests in advance for approval. Leave is subject to company policies and availability.
Unauthorized absences may impact benefits. Check your balance before applying.`;

  // Show full page spinner only on initial load
  if (initialLoading)
    return (
      <div className="w-full h-full flex flex-col justify-center items-center">
        <Spin size="large" />
      </div>
    );

  return (
    <>
      <div className="max-w-7xl mx-auto m-4 lg:h-[calc(100vh-32px)]">
        <div className="flex flex-col justify-between lg:h-full">
          <div>
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
              <div className="flex items-center gap-2">
                <ClockCircleOutlined className="text-2xl sm:text-3xl text-zinc-900" />
                <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900">Leave Overview</h1>
              </div>
              <KoraBtn onClick={() => setShowModal(true)}>Apply For Leave</KoraBtn>
            </div>

            {/* Tabs */}
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

            {/* Main Content with conditional loading */}
            {contentLoading ? (
              <div className="flex justify-center items-center h-64">
                <Spin size="large" />
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
                <div
                  className={`grid gap-3 h-fit grid-cols-1 sm:grid-cols-2 ${
                    activeTab === "All"
                      ? "lg:col-span-2"
                      : "lg:grid-cols-3 lg:col-span-3"
                  }`}
                >
                  {requests.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                      <Icons.EventNote className="text-zinc-400" style={{ fontSize: "48px" }} />
                      <div className="text-zinc-500 text-xl mb-2 font-semibold">
                        No Leave Requests
                      </div>
                      <div className="text-zinc-400 text-sm">
                        {activeTab === "All"
                          ? "You haven't submitted any leave requests yet."
                          : `No ${activeTab.toLowerCase()} leave requests to display.`}
                      </div>
                    </div>
                  ) : (
                    requests.map((req) => <LeaveRequestCard key={req.leaveRequestId} req={req} />)
                  )}
                </div>

                {activeTab === "All" && (
                  <div className="flex flex-col gap-2">
                    <div className="text-zinc-500 font-semibold text-center">Total Remaining</div>
                    <div className="bg-white rounded-2xl p-6 shadow-sm flex flex-col items-center">
                      <Tooltip
                        title={`${summary.totalRemaining} days remaining out of ${summary.totalAllowed} total days.`}
                      >
                        <Progress
                          type="circle"
                          percent={Math.round(
                            (summary.totalRemaining / summary.totalAllowed) * 100
                          )}
                          format={() => (
                            <div className="flex flex-col items-center">
                              <p className="text-zinc-800 ">{summary.totalRemaining}</p>
                              <p className="text-zinc-500 text-sm">
                                of {summary.totalAllowed} days
                              </p>
                            </div>
                          )}
                          strokeColor={{ "0%": "#3CB4E7", "100%": "#E0F4FD" }}
                          trailColor="#F4F4F5"
                          strokeWidth={10}
                          size={150}
                          className="[&_.ant-progress-text]:!text-4xl"
                        />
                      </Tooltip>
                    </div>

                    <div className="text-zinc-500 font-semibold text-center mt-4">
                      Leave Balances
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm">
                      <div className="space-y-4 -mt-1">
                        {balances.map((b, idx) => {
                          const pct = Math.round((b.remainingDays / b.defaultDays) * 100);
                          const barColor = barColors[idx % barColors.length];
                          return (
                            <Tooltip
                              key={b.leaveTypeId}
                              title={`${b.leaveTypeName} Leave: ${b.remainingDays} of ${b.defaultDays} days remaining`}
                              placement="top"
                            >
                              <div>
                                <p className="text-xs text-zinc-700 mb-1">{b.leaveTypeName}</p>
                                <div className="h-5 w-full bg-zinc-300 rounded-full relative">
                                  <div
                                    className={`h-5 ${barColor} rounded-full`}
                                    style={{ width: `${pct}%` }}
                                  ></div>
                                  {pct === 0 && (
                                    <p className="text-zinc-500 text-[9px] min-w-full flex items-center pl-2 text-nowrap absolute top-0 bottom-0 left-0">
                                      No Remaining Days
                                    </p>
                                  )}
                                </div>
                              </div>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Editable policy text */}
          <div className="text-center text-sm text-zinc-400 p-4 hover:text-zinc-500">
            {policy.split("\n").map((line, i) => (
              <p key={i} className="max-w-4xl mx-auto">
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Modal */}
      <ApplyForLeaveModal
        showModal={showModal}
        setShowModal={setShowModal}
        // The new request arrives through the subscription; closing is all that
        // is left to do.
        onSubmitSuccess={() => setShowModal(false)}
      />
    </>
  );
};

export default EmployeeLeaveOverview;
