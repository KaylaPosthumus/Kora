import React, { useState, useEffect } from "react";
import { empLeaveRequestsAPI } from "../../services/api.service";
import dayjs from "dayjs";
import { calculateDurationInDays } from "../../utils/dateUtils";

// Import Components
import { Tooltip } from "antd";

// Icons
import { ClockCircleOutlined, CheckOutlined, CloseOutlined } from "@ant-design/icons";
import { Icons } from "../../constants/icons";

// Badges & Buttons
import CoriBadge from "../../components/badges/CoriBadge";
import CoriCircleBtn from "../../components/buttons/CoriCircleBtn";
import CoriBtn from "../../components/buttons/CoriBtn";

// Table
import { Table } from "antd";

// Edit Policy Modal
import EditPolicyModal from "../../components/modals/EditPolicyModal";

// Over Balance Confirm Modal
import OverBalanceConfirmModal from "../../components/modals/OverBalanceConfirmModal";

// Authentication
import { getFullCurrentUser } from "../../services/authService";

// Message
import { message } from "antd";

const AdminLeaveRequests: React.FC = () => {
  const [displayingLeaveRequests, setDisplayingLeaveRequests] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"Pending" | "Approved" | "Rejected">("Pending");
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [showOverBalanceModal, setShowOverBalanceModal] = useState(false);
  const [selectedLeaveRequest, setSelectedLeaveRequest] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  // Fetch handlers
  const fetchPending = async () => {
    try {
      setLoading(true);
      const res = await empLeaveRequestsAPI.getPendingLeaveRequests();
      setDisplayingLeaveRequests(res.data);
    } catch (error) {
      console.error("Error fetching pending leave requests:", error);
      messageApi.error("Failed to fetch pending leave requests");
    } finally {
      setLoading(false);
    }
  };
  const fetchApproved = async () => {
    try {
      setLoading(true);
      const res = await empLeaveRequestsAPI.getApprovedLeaveRequests();
      setDisplayingLeaveRequests(res.data);
    } catch (error) {
      console.error("Error fetching approved leave requests:", error);
      messageApi.error("Failed to fetch approved leave requests");
    } finally {
      setLoading(false);
    }
  };
  const fetchRejected = async () => {
    try {
      setLoading(true);
      const res = await empLeaveRequestsAPI.getRejectedLeaveRequests();
      setDisplayingLeaveRequests(res.data);
    } catch (error) {
      console.error("Error fetching rejected leave requests:", error);
      messageApi.error("Failed to fetch rejected leave requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "Pending") fetchPending();
    else if (activeTab === "Approved") fetchApproved();
    else fetchRejected();
  }, [activeTab]);

  useEffect(() => {
    console.log("Displaying Leave Requests:", displayingLeaveRequests);
  }, [displayingLeaveRequests]);

  // Action handlers
  const handleApprove = async (id: string) => {
    // Find the leave request to check if it's over balance
    const leaveRequest = displayingLeaveRequests.find((req) => req.leaveRequestId === id);
    if (leaveRequest) {
      const requestedDays = calculateDurationInDays(leaveRequest.startDate, leaveRequest.endDate);
      const isOverBalance = leaveRequest.remainingDays < requestedDays;

      if (isOverBalance) {
        setSelectedLeaveRequest(leaveRequest);
        setShowOverBalanceModal(true);
        return;
      }
    }

    // Proceed with normal approval if not over balance
    await performApproval(id);
  };

  const performApproval = async (id: string) => {
    try {
      setLoading(true);
      await empLeaveRequestsAPI.approveLeaveRequestById(id);
      setActiveTab("Approved");
      messageApi.success("Leave request approved");
    } catch (error) {
      console.error(`Error approving leave request ${id}:`, error);
      messageApi.error("Error approving leave request");
    } finally {
      setLoading(false);
    }
  };

  const handleOverBalanceApprove = () => {
    if (selectedLeaveRequest) {
      performApproval(selectedLeaveRequest.leaveRequestId);
    }
  };

  const handleOverBalanceReject = () => {
    if (selectedLeaveRequest) {
      handleReject(selectedLeaveRequest.leaveRequestId);
    }
  };

  const handleReject = async (id: string) => {
    try {
      setLoading(true);
      await empLeaveRequestsAPI.rejectLeaveRequestById(id);
      setActiveTab("Rejected");
      messageApi.success("Leave request rejected");
    } catch (error) {
      console.error(`Error rejecting leave request ${id}:`, error);
      messageApi.error("Error rejecting leave request");
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async (id: string) => {
    try {
      setLoading(true);
      await empLeaveRequestsAPI.setLeaveRequestToPendingById(id);
      setActiveTab("Pending");
      messageApi.success("Leave request set to pending");
    } catch (error) {
      console.error(`Error undoing leave request ${id}:`, error);
      messageApi.error("Error setting leave request to pending");
    } finally {
      setLoading(false);
    }
  };

  // Table columns (unchanged)
  const getLeaveIcon = (type: string) => {
    if (type.toLowerCase().includes("annual")) return <Icons.BeachAccess fontSize="large" />;
    if (type.toLowerCase().includes("family")) return <Icons.FamilyRestroom fontSize="large" />;
    if (type.toLowerCase().includes("sick")) return <Icons.Sick fontSize="large" />;
    if (type.toLowerCase().includes("compassion")) return <Icons.HeartBroken fontSize="large" />;
    if (type.toLowerCase().includes("study")) return <Icons.MenuBook fontSize="large" />;
    if (type.toLowerCase().includes("parental")) return <Icons.ChildFriendly fontSize="large" />;
    return null;
  };

  const columns = [
    {
      title: "Leave Type & Duration",
      dataIndex: "startDate",
      key: "startDate",
      render: (_: any, r: any) => (
        <div className="flex items-center gap-4 h-full">
          {getLeaveIcon(r.leaveTypeName)}
          <div className="flex flex-col">
            <p className="font-medium">
              {calculateDurationInDays(r.startDate, r.endDate)} Day
              {calculateDurationInDays(r.startDate, r.endDate) > 1 ? "s" : ""} {r.leaveTypeName}{" "}
              Leave
            </p>
            <p className="text-xs text-zinc-500">
              {dayjs(r.startDate).format("DD MMM YYYY")} – {dayjs(r.endDate).format("DD MMM YYYY")}
            </p>
          </div>
        </div>
      ),
    },
    {
      title: "Employee",
      dataIndex: "fullName",
      key: "fullName",
      className: "text-center",
      render: (_: any, r: any) => (
        <div className="flex flex-col items-center">
          <p className="font-normal text-xs">{r.fullName}</p>
          <p className="text-xs text-zinc-500">ID-00{r.employeeId}</p>
        </div>
      ),
    },
    {
      title: "Leave Balance",
      dataIndex: "remainingDays",
      key: "remainingDays",
      className: "text-center",
      render: (_: any, r: any) => {
        const requestedDays = calculateDurationInDays(r.startDate, r.endDate);
        const isOverBalance = activeTab === "Pending" && r.remainingDays < requestedDays;
        const badgeColor = activeTab === "Pending" ? (isOverBalance ? "red" : "green") : "blue";

        const badge = (
          <CoriBadge text={`${r.remainingDays} days`} size="x-small" color={badgeColor} />
        );

        return (
          <div className="flex justify-center">
            {isOverBalance ? (
              <Tooltip
                title={`Employee is requesting ${requestedDays} days but only has ${r.remainingDays} days available`}
                placement="top"
              >
                <div className="cursor-default">{badge}</div>
              </Tooltip>
            ) : (
              <div className="cursor-default">{badge}</div>
            )}
          </div>
        );
      },
    },
    {
      title: "Comment",
      dataIndex: "comment",
      key: "comment",
      className: "text-center",
      render: (_: any, r: any) =>
        r.comment ? (
          <p className="text-xs text-zinc-500">{r.comment}</p>
        ) : (
          <p className="italic text-xs text-zinc-400">No comment</p>
        ),
    },
    {
      key: "actions",
      title: activeTab === "Pending" ? "" : "Undo",
      className: "text-end",
      render: (_: any, r: any) => (
        <div className="flex justify-end gap-2">
          {r.status === 0 && (
            <>
              <CoriBtn iconOnly disabled={loading} onClick={() => handleApprove(r.leaveRequestId)}>
                <CheckOutlined />
              </CoriBtn>
              <CoriBtn
                secondary
                style="red"
                iconOnly
                disabled={loading}
                onClick={() => handleReject(r.leaveRequestId)}
              >
                <CloseOutlined />
              </CoriBtn>
            </>
          )}
          {r.status === 1 && (
            <CoriBtn
              secondary
              iconOnly
              disabled={loading}
              onClick={() => handleUndo(r.leaveRequestId)}
            >
              <Icons.Undo />
            </CoriBtn>
          )}
          {r.status === 2 && (
            <CoriBtn
              secondary
              style="red"
              iconOnly
              disabled={loading}
              onClick={() => handleUndo(r.leaveRequestId)}
            >
              <Icons.Undo />
            </CoriBtn>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <div className="max-w-7xl mx-auto m-4">
        {/* Title & Edit Policy */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <ClockCircleOutlined className="text-3xl text-zinc-900" />
            <h1 className="text-3xl font-bold text-zinc-900">Leave Requests</h1>
          </div>
          <CoriBtn style="black" onClick={() => setShowPolicyModal(true)}>
            Edit Policy
          </CoriBtn>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {(["Pending", "Approved", "Rejected"] as const).map((tab) => (
            <CoriBtn
              key={tab}
              onClick={() => setActiveTab(tab)}
              secondary
              disabled={loading}
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
        <div className="overflow-hidden rounded-xl">
          <Table
            columns={columns}
            dataSource={loading ? [] : displayingLeaveRequests}
            rowKey="LeaveRequestId"
            pagination={false}
            loading={loading}
          />
        </div>
      </div>

      {/* Edit Policy Modal */}
      <EditPolicyModal showModal={showPolicyModal} setShowModal={setShowPolicyModal} />

      {/* Over Balance Confirm Modal */}
      {selectedLeaveRequest && (
        <OverBalanceConfirmModal
          showModal={showOverBalanceModal}
          setShowModal={setShowOverBalanceModal}
          employeeName={selectedLeaveRequest.fullName}
          requestedDays={calculateDurationInDays(
            selectedLeaveRequest.startDate,
            selectedLeaveRequest.endDate
          )}
          availableDays={selectedLeaveRequest.remainingDays}
          onApprove={handleOverBalanceApprove}
          onReject={handleOverBalanceReject}
        />
      )}
    </>
  );
};

export default AdminLeaveRequests;
