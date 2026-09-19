import React, { useState } from "react";

// Import React Components
import KoraBtn from "@/shared/components/KoraBtn";
import EditPRModal, { PerformanceReviewDTO } from "@/features/gatherings/components/EditPRModal";
import EditMeetingModal from "@/features/gatherings/components/EditMeetingModal";
import { MeetingDTO } from "@/shared/types/meetingDTO";
import DeleteMeetingModal from "@/features/gatherings/components/DeleteMeetingModal";
import DeletePRModal from "@/features/gatherings/components/DeletePRModal";

// Import 3rd party components
import { Button, Dropdown, Tooltip } from "antd";

// Import Google Icons
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import TextSnippetRoundedIcon from "@mui/icons-material/TextSnippetRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

// Functionality
import { meetingAPI, performanceReviewsAPI } from "@/features/gatherings/api/gatheringsApi";
// Utils
import { formatTimestampToDate, formatTimestampToTime } from "@/utils/dateUtils";

// Constants
import { Icons } from "@/constants/icons";

// Interfaces
import { Gathering } from "@/shared/types/gathering";
import { GatheringType, MeetStatus, ReviewStatus } from "@/shared/types/common";

interface GatheringBoxProps {
  gathering: Gathering;
  onEditSuccess?: () => void;
  onDeleteSuccess?: () => void;
  withAdminNamesTitle?: boolean;
  loggedInAdminId?: string;
}

// !!!!!!!!!!!!!!!!!!
// ! The Admin Gathering Box ONLY takes Upcoming & Completed Meetings / Performance Reviews
// !!!!!!!!!!!!!!!!!!

function AdminGatheringBox({
  gathering,
  onEditSuccess,
  onDeleteSuccess,
  withAdminNamesTitle = false,
  loggedInAdminId = "",
}: GatheringBoxProps) {
  const [showEditPRModal, setShowEditPRModal] = useState(false);
  const [showEditMeetingModal, setShowEditMeetingModal] = useState(false);
  const [showDeleteMeetingModal, setShowDeleteMeetingModal] = useState(false);
  const [showDeletePRModal, setShowDeletePRModal] = useState(false);

  const gatheringType = {
    isPerformanceReview: gathering.type === GatheringType.PerformanceReview,
    isMeeting: gathering.type === GatheringType.Meeting,
  };

  const gatheringStatus = {
    isUpcoming: gatheringType.isPerformanceReview
      ? gathering.reviewStatus === ReviewStatus.Upcoming
      : gathering.meetingStatus === MeetStatus.Upcoming,
    isCompleted: gatheringType.isPerformanceReview
      ? gathering.reviewStatus === ReviewStatus.Completed
      : gathering.meetingStatus === MeetStatus.Completed,
  };

  const adminPermissions = {
    isOwner: loggedInAdminId === gathering.adminId,
  };

  const handleEditClick = () => {
    if (gatheringType.isPerformanceReview) {
      setShowEditPRModal(true);
    } else if (gatheringType.isMeeting) {
      setShowEditMeetingModal(true);
    }
  };

  const handleDeleteClick = () => {
    if (gatheringType.isPerformanceReview) {
      setShowDeletePRModal(true);
    } else if (gatheringType.isMeeting) {
      setShowDeleteMeetingModal(true);
    }
  };

  const handleEditSuccess = () => {
    if (gatheringType.isPerformanceReview) {
      console.log("Performance review edited successfully");
    } else if (gatheringType.isMeeting) {
      console.log("Meeting edited successfully");
    }

    // Call the parent component's onEditSuccess callback if provided
    if (onEditSuccess) {
      onEditSuccess();
    }
  };

  // Convert Gathering to PerformanceReviewDTO
  const convertToPerformanceReviewDTO = (): PerformanceReviewDTO => {
    const result = {
      reviewId: gathering.id,
      adminId: gathering.adminId,
      adminName: gathering.adminName,
      employeeId: gathering.employeeId,
      employeeName: gathering.employeeName,
      isOnline: gathering.isOnline || false,
      meetLocation: gathering.meetLocation ?? null,
      meetLink: gathering.meetLink ?? null,
      startDate: gathering.startDate ?? "",
      endDate: gathering.endDate ?? "",
      rating: gathering.rating ?? null,
      comment: gathering.comment ?? null,
      docUrl: gathering.docUrl ?? null,
      status: gathering.reviewStatus ?? ReviewStatus.Upcoming,
    };
    return result;
  };

  // Convert Gathering to MeetingDTO
  const convertToMeetingDTO = (): MeetingDTO => {
    const result = {
      meetingId: gathering.id,
      adminId: gathering.adminId,
      adminName: gathering.adminName,
      employeeId: gathering.employeeId,
      employeeName: gathering.employeeName,
      isOnline: gathering.isOnline || false,
      meetLocation: gathering.meetLocation || "",
      meetLink: gathering.meetLink || "",
      startDate: gathering.startDate?.toString() || "",
      endDate: gathering.endDate?.toString() || "",
      purpose: gathering.purpose || "",
      status: gathering.meetingStatus || MeetStatus.Upcoming,
    };
    return result;
  };

  // Gathering icon (Pink Performance Review, Pink Standard Meeting)
  const GatheringIcon = () => {
    if (gatheringType.isPerformanceReview) {
      return (
        <Tooltip title="Performance Review">
          <div className="bg-corigreen-100 rounded-full h-12 w-12 flex items-center justify-center">
            <Icons.StarRounded className="text-corigreen-400" fontSize="large" />
          </div>
        </Tooltip>
      );
    } else if (gatheringType.isMeeting) {
      return (
        <Tooltip title="Standard Meeting">
          <div className="bg-sakura-100 rounded-full h-12 w-12 flex items-center justify-center">
            <Icons.Chat className="text-sakura-500" />
          </div>
        </Tooltip>
      );
    }

    // Fallback for unknown gathering types
    return (
      <Tooltip title="Unknown">
        <div className="bg-gray-100 rounded-full h-12 w-12 flex items-center justify-center"></div>
      </Tooltip>
    );
  };

  // Gathering title (Review by You, Review by Admin, Meet with Employee)
  const GatheringTitle = () => {
    let title = "";
    const withAdminNames = withAdminNamesTitle;
    const isOwner = adminPermissions.isOwner;
    const isMeeting = gatheringType.isMeeting;
    const isPerformanceReview = gatheringType.isPerformanceReview;
    const isCompleted = gatheringStatus.isCompleted;

    // Standard Titles with Employee Names
    if (!withAdminNames) {
      if (isPerformanceReview) {
        if (isCompleted) {
          title = `Reviewed ${gathering.employeeName}`;
        } else {
          title = `Review ${gathering.employeeName}`;
        }
      } else if (isMeeting) {
        if (isCompleted) {
          title = `Met with ${gathering.employeeName}`;
        } else {
          title = `Meet with ${gathering.employeeName}`;
        }
        // Titles with Admin Names
      }
    } else {
      // Admin not the owner
      if (!isOwner) {
        if (isPerformanceReview) {
          if (isCompleted) {
            title = `Reviewed by ${gathering.adminName}`;
          } else {
            title = `Review with ${gathering.adminName}`;
          }
        } else if (isMeeting) {
          if (isCompleted) {
            title = `Met with ${gathering.adminName}`;
          } else {
            title = `Meeting with ${gathering.adminName}`;
          }
        }
        // Admin IS the owner
      } else {
        if (isPerformanceReview) {
          if (isCompleted) {
            title = `Reviewed by You`;
          } else {
            title = `Review with You`;
          }
        } else if (isMeeting) {
          if (isCompleted) {
            title = `Met with You`;
          } else {
            title = `Meet with You`;
          }
        }
      }
    }

    return <h2 className="text-zinc-800 font-bold w-full">{title}</h2>;
  };

  // Status indicator (Completed, Online, In Person)
  const StatusIndicator = () => {
    if (gatheringStatus.isCompleted) {
      return (
        <Tooltip title="Completed">
          <Icons.CheckCircle className="text-corigreen-400" />
        </Tooltip>
      );
    }

    // Upcoming status
    if (gathering.isOnline) {
      return (
        <Tooltip title="Online">
          <Icons.Language className="text-blue-300" />
        </Tooltip>
      );
    }

    return (
      <Tooltip title="In Person">
        <Icons.EmojiPeople className="text-purple-400" />
      </Tooltip>
    );
  };

  // Review Body (Comment, Rating, PDF Attachment)
  const PerformanceReviewBody = () => {
    if (!gatheringType.isPerformanceReview) return null;

    const shouldShowReviewBtn =
      adminPermissions.isOwner &&
      !gathering.comment &&
      (!gathering.rating || gathering.rating <= 0) &&
      !gathering.docUrl;

    return (
      <div className="flex flex-col w-full gap-2">
        {/* Comment */}
        {gathering.comment && <p className="text-zinc-500 text-[12px]">{gathering.comment}</p>}

        <div className="flex w-full items-center gap-4">
          {/* Rating */}
          {gathering.rating && gathering.rating > 0 && (
            <div className="flex items-center gap-1">
              <StarRoundedIcon className="text-amber-300" />
              <p className="text-zinc-800 font-bold">{gathering.rating}</p>
            </div>
          )}
          {/* PDF Attachment */}
          {gathering.docUrl && (
            <div className="flex items-center gap-1">
              <p className="text-zinc-500 text-[12px]">PDF Attached</p>
              <TextSnippetRoundedIcon className="text-zinc-500" />
            </div>
          )}
        </div>

        {shouldShowReviewBtn && (
          <>
            <KoraBtn
              primary
              style="default"
              onClick={() => setShowEditPRModal(true)}
              className="w-fit"
            >
              Review Employee
              <Icons.StarRounded />
            </KoraBtn>
            <EditPRModal
              showModal={showEditPRModal}
              setShowModal={setShowEditPRModal}
              onEditSuccess={handleEditSuccess}
              performanceReview={convertToPerformanceReviewDTO()}
            />
          </>
        )}
      </div>
    );
  };

  // Meet Body (Purpose)
  const MeetingBody = () => {
    if (!gatheringType.isMeeting || !gathering.purpose) return null;

    return (
      <div className="w-full">
        <p className="text-zinc-500 text-[12px]">{gathering.purpose}</p>
      </div>
    );
  };

  // Dropdown Menu Items (Mark as Upcoming, Edit, Remove)
  const getDropdownMenuItems = () => [
    {
      key: "1",
      label: gatheringStatus.isCompleted ? "Mark as Upcoming" : "Mark as Completed",
      icon: gatheringStatus.isCompleted ? <Icons.Schedule /> : <Icons.CheckCircle />,
      onClick: handleStatusUpdate,
    },
    {
      key: "2",
      label: gatheringType.isPerformanceReview ? "Edit Review" : "Edit Meeting",
      icon: <EditIcon />,
      onClick: handleEditClick,
    },
    {
      key: "3",
      label: "Remove",
      icon: <DeleteIcon />,
      danger: true,
      onClick: handleDeleteClick,
    },
  ];

  // Handle Join button click
  const handleJoinClick = () => {
    if (gathering.meetLink) {
      if (gathering.meetLink.includes("https://")) {
        window.open(`${gathering.meetLink}`, "_blank");
      } else {
        window.open(`https://${gathering.meetLink}`, "_blank");
      }
    }
  };

  // Handle status update (Mark as Upcoming/Completed)
  const handleStatusUpdate = async () => {
    try {
      if (gatheringType.isPerformanceReview) {
        // For Performance Reviews: toggle between Upcoming (1) and Completed (2)
        const newStatus = gatheringStatus.isCompleted
          ? ReviewStatus.Upcoming
          : ReviewStatus.Completed;
        await performanceReviewsAPI.UpdatePerformanceReviewStatus(gathering.id, newStatus);
        console.log(
          `Performance review status updated to: ${
            newStatus === ReviewStatus.Upcoming ? "Upcoming" : "Completed"
          }`
        );
      } else if (gatheringType.isMeeting) {
        // For Meetings: use separate endpoints for marking as upcoming or completed
        if (gatheringStatus.isCompleted) {
          await meetingAPI.markAsUpcomingMeeting(gathering.id);
          console.log("Meeting marked as upcoming");
        } else {
          await meetingAPI.markAsCompletedMeeting(gathering.id);
          console.log("Meeting marked as completed");
        }
      }

      // Call the parent component's onEditSuccess callback to refresh data
      if (onEditSuccess) {
        onEditSuccess();
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  // Admin Action Buttons (Join, Edit, Remove)
  const AdminActionButtons = () => {
    if (!adminPermissions.isOwner) return null;

    return (
      <div className="flex items-center gap-3">
        {gatheringStatus.isUpcoming && gathering.isOnline && (
          <KoraBtn primary style="black" onClick={handleJoinClick}>
            Join
          </KoraBtn>
        )}
        <Dropdown
          menu={{ items: getDropdownMenuItems() }}
          placement="bottomRight"
          trigger={["click"]}
          dropdownRender={(menu) => (
            <div className="border-2 border-zinc-100 rounded-2xl">{menu}</div>
          )}
        >
          <Button className="p-0 border-none bg-transparent">
            <MoreVertRoundedIcon className="text-zinc-500" />
          </Button>
        </Dropdown>
      </div>
    );
  };

  // Location/Link Display (Online or In Person)
  const LocationDisplay = () => {
    const displayText = gathering.isOnline ? gathering.meetLink : gathering.meetLocation;

    return (
      <div className="w-full h-10 flex items-center justify-center bg-warmstone-200 rounded-xl overflow-hidden">
        <Tooltip title={displayText}>
          <p className="text-zinc-500 text-[12px] truncate mx-4">{displayText}</p>
        </Tooltip>
      </div>
    );
  };

  return (
    <div className="bg-warmstone-50 p-4 rounded-2xl w-full flex flex-col justify-between gap-3 shadow-sm">
      {/* Heading & Body */}
      <div className="w-full flex flex-col gap-3">
        {/* Heading Section */}
        <div className="w-full flex justify-between items-center">
          <div className="flex items-center gap-2 w-full">
            <GatheringIcon />
            <div className="flex flex-col gap-1">
              <GatheringTitle />
              {/* Date and Time */}
              <div className="w-full flex items-center gap-3 text-zinc-800 text-[12px]">
                <p>
                  {gathering.startDate ? formatTimestampToDate(gathering.startDate.toString()) : ""}
                </p>
                <p>•</p>
                <p>
                  {gathering.startDate ? formatTimestampToTime(gathering.startDate.toString()) : ""}{" "}
                  -{gathering.endDate ? formatTimestampToTime(gathering.endDate.toString()) : ""}
                </p>
              </div>
            </div>
          </div>
          {/* Status Indicator */}
          <div className="flex items-center gap-2">
            <StatusIndicator />
          </div>
        </div>

        {/* Body Content */}
        <PerformanceReviewBody />
        <MeetingBody />
      </div>

      {/* Footer Section (Location / Action Buttons) */}
      <div className="w-full flex items-center justify-between gap-3">
        <LocationDisplay />
        <AdminActionButtons />
      </div>

      {/* Modals */}
      {gatheringType.isPerformanceReview && (
        <>
          <EditPRModal
            showModal={showEditPRModal}
            setShowModal={setShowEditPRModal}
            onEditSuccess={handleEditSuccess}
            performanceReview={convertToPerformanceReviewDTO()}
          />
          <DeletePRModal
            showModal={showDeletePRModal}
            setShowModal={setShowDeletePRModal}
            onDeleteSuccess={onDeleteSuccess}
            performanceReview={convertToPerformanceReviewDTO()}
          />
        </>
      )}

      {gatheringType.isMeeting && (
        <>
          <EditMeetingModal
            showModal={showEditMeetingModal}
            setShowModal={setShowEditMeetingModal}
            onEditSuccess={handleEditSuccess}
            meeting={convertToMeetingDTO()}
          />
          <DeleteMeetingModal
            showModal={showDeleteMeetingModal}
            setShowModal={setShowDeleteMeetingModal}
            onDeleteSuccess={onDeleteSuccess}
            meeting={convertToMeetingDTO()}
          />
        </>
      )}
    </div>
  );
}

export default AdminGatheringBox;
