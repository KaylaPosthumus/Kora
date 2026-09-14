import React from "react";
import { getFullImageUrl } from "../../../utils/imageUtils";
import EmployTypeBadge from "../../../components/badges/EmployTypeBadge";
import { EmployType } from "../../../types/common";
import { Icons } from "../../../constants/icons";

interface TopRatedEmployee {
  profilePicture: string;
  fullName: string;
  jobTitle: string;
  averageRating: number;
  employType: string;
  isSuspended: boolean;
}

const TopRatedEmpCard: React.FC<TopRatedEmployee> = ({
  fullName,
  jobTitle,
  averageRating,
  employType,
  profilePicture,
  isSuspended,
}) => {
  return (
    <div className="p-1">
      <div className="flex items-center gap-3 p-2 hover:bg-zinc-100 rounded-xl min-h-[56px]">
        {profilePicture ? (
          <img
            src={getFullImageUrl(profilePicture) || ""}
            alt={fullName}
            className="rounded-full w-11 h-11 flex-shrink-0 object-cover"
          />
        ) : (
          <div className="rounded-full w-11 h-11 flex-shrink-0 object-cover bg-zinc-200 flex items-center justify-center">
            <Icons.Person className="text-zinc-400" />
          </div>
        )}

        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-zinc-900 text-md truncate">{fullName}</span>
          <span className="text-zinc-500 text-xs truncate">{jobTitle}</span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <EmployTypeBadge
            status={isSuspended ? "suspended" : (employType as unknown as EmployType)}
          />
          <span className="text-zinc-900 flex items-center gap-1 text-md">
            <Icons.StarRounded className="text-amber-300" />
            {averageRating.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TopRatedEmpCard;
