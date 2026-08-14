import React, { useState } from "react";
import { MeetingRequestCard } from "../../../interfaces/meetings/meetingRequestCard";
import CoriBtn from "../../buttons/CoriBtn";
import dayjs from "dayjs";
import { Avatar } from "antd";
import { Icons } from "../../../constants/icons";
import { meetingAPI } from "../../../services/api.service";

interface MeetRequestCardProps {
  meetRequest: MeetingRequestCard;
  onApprove: () => void;
  onReject: () => void;
}

function MeetRequestCard({ meetRequest, onApprove, onReject }: MeetRequestCardProps) {
  return (
    <>
      <div className="flex flex-col w-full bg-warmstone-50 p-4 rounded-2xl hover:shadow-md transition-all cursor-pointer group mt-3">
        <div className="flex items-center gap-2">
          {meetRequest.profilePicture ? (
            <Avatar src={meetRequest.profilePicture} />
          ) : (
            <Avatar icon={<Icons.Person />} />
          )}
          <div>
            <p>{meetRequest.employeeName}</p>
            <p className="text-zinc-500 text-[12px]">
              at {dayjs(meetRequest.requestedAt).format("h:mm A, D MMM YYYY")}
            </p>
          </div>
        </div>
        {meetRequest.purpose ? (
          <p className="text-zinc-500 text-sm mt-3">{meetRequest.purpose}</p>
        ) : (
          <p className="text-zinc-500 text-sm mt-3">No purpose provided</p>
        )}
        <div className="flex gap-2 w-full max-h-0 overflow-hidden group-hover:max-h-20 group-hover:mt-3 transition-all duration-300">
          <CoriBtn className="w-full" onClick={onApprove}>
            Accept
          </CoriBtn>
          <CoriBtn secondary style="red" className="w-full" onClick={onReject}>
            Reject
          </CoriBtn>
        </div>
      </div>
    </>
  );
}

export default MeetRequestCard;
