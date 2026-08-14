import React from "react";

// Import React Components
import CoriBtn from "../buttons/CoriBtn";

// Import 3rd party components
import { Button, Dropdown, Tooltip } from "antd";

// Import Google Icons
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import TextSnippetRoundedIcon from "@mui/icons-material/TextSnippetRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { formatTimestampToDate, formatTimestampToTime } from "../../utils/dateUtils";

// Constants
import { Icons } from "../../constants/icons";

// Interfaces
import { Gathering } from "../../interfaces/gathering/gathering";
import { GatheringType, MeetStatus, ReviewStatus } from "../../types/common";

interface GatheringBoxProps {
  gathering: Gathering;
}

// !!!!!!!!!!!!!!!!!!
// ! The Employee Gathering Box ONLY takes Upcoming & Completed Meetings / Performance Reviews
// !!!!!!!!!!!!!!!!!!

function EmpGatheringBox({ gathering }: GatheringBoxProps) {
  const isPerformanceReview = gathering.type === GatheringType.PerformanceReview;
  const isMeeting = gathering.type === GatheringType.Meeting;

  const isUpcoming = isPerformanceReview
    ? gathering.reviewStatus === ReviewStatus.Upcoming
    : gathering.meetingStatus === MeetStatus.Upcoming;

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

  return (
    <div className="bg-warmstone-50 p-4 rounded-2xl w-full flex flex-col justify-between gap-3 shadow-sm">
      {/* Heading & Body */}
      <div className="w-full flex flex-col gap-3">
        {/* Heading Section */}
        <div className="w-full flex justify-between items-center">
          <div className=" flex items-center gap-2 w-full">
            {isPerformanceReview ? (
              <Tooltip title="Performance Review">
                <div className="bg-corigreen-100 rounded-full h-12 w-12 flex items-center justify-center">
                  <Icons.StarRounded className="text-corigreen-400" fontSize="large" />
                </div>
              </Tooltip>
            ) : (
              <Tooltip title="Standard Meeting">
                <div className="bg-sakura-100 rounded-full h-12 w-12 flex items-center justify-center">
                  <Icons.Chat className="text-sakura-400" />
                </div>
              </Tooltip>
            )}
            <div className="flex flex-col gap-1">
              <h2 className="text-zinc-800 font-bold w-full">
                {isPerformanceReview ? "Review with " : "Meet with "} {gathering.adminName}
              </h2>

              {/* Date and Time */}
              <div className="w-full flex items-center gap-3 text-zinc-800 text-[12px]">
                <p>
                  {gathering.startDate
                    ? formatTimestampToDate(gathering.startDate.toString())
                    : "No date"}
                </p>
                <p>
                  {gathering.startDate && gathering.endDate
                    ? `${formatTimestampToTime(
                        gathering.startDate.toString()
                      )} - ${formatTimestampToTime(gathering.endDate.toString())}`
                    : "No time"}
                </p>
              </div>
            </div>
          </div>
          {/* Status Indicator */}
          <div className="flex items-center gap-2">
            {isUpcoming ? (
              // Upcoming Status (Online / In Person)
              <>
                {gathering.isOnline ? (
                  <Tooltip title="Online">
                    <Icons.Language className="text-blue-300" />
                  </Tooltip> // Online
                ) : (
                  <Tooltip title="In Person">
                    <Icons.EmojiPeople className="text-purple-400" />
                  </Tooltip> // In Person
                )}
              </>
            ) : (
              // Completed Status
              <>
                <Tooltip title="Completed">
                  <Icons.CheckCircle className="text-corigreen-400" />
                </Tooltip>
              </>
            )}
          </div>
        </div>
        {/* Body Section (For Performance Review) */}
        {isPerformanceReview && (
          <div className="w-full flex flex-col gap-3">
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
          </div>
        )}
        {/* Body Section (For Meeting) */}
        {isMeeting && gathering.purpose && (
          <div className="w-full">
            <p className="text-zinc-500 text-[12px]">{gathering.purpose}</p>
          </div>
        )}
      </div>
      {/* Footer Section (Location / Action Buttons) */}
      {gathering.isOnline ? (
        // If meet is online
        <div className="w-full flex items-center justify-between gap-3">
          <div className="w-full flex h-10 items-center justify-center bg-warmstone-100 rounded-xl ">
            <p className="text-zinc-500 text-[12px]">{gathering.meetLink}</p>
          </div>
          {gathering.meetingStatus === MeetStatus.Upcoming && (
            <CoriBtn primary style="black" onClick={handleJoinClick}>
              Join
            </CoriBtn>
          )}
        </div>
      ) : (
        // If meet is in person
        <div className="w-full flex h-10 items-center justify-center bg-warmstone-100 rounded-xl ">
          <p className="text-zinc-500 text-[12px]">{gathering.meetLocation}</p>
        </div>
      )}
    </div>
  );
}

export default EmpGatheringBox;
