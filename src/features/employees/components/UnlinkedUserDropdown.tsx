import React from "react";
import { Avatar, Dropdown, MenuProps, Space } from "antd";
import { GoogleOutlined, MailOutlined, DownOutlined } from "@ant-design/icons";
import noUserImage from "@/assets/icons/no_profile_image.webp";
import { UserRole, UserRoleLabels } from "@/shared/types/common";

export interface UnlinkedUser {
  userId: string;
  fullName: string;
  profilePicture: string;
  signupMethod: "google" | "email";
  /** Which signup form they used. Absent on accounts that never went through one. */
  requestedRole?: UserRole;
}

/**
 * What the user asked to be. Admin requests stand out, since granting one hands
 * over org-wide access. Nothing renders when no role was asked for.
 */
const RequestedRoleTag: React.FC<{ role?: UserRole }> = ({ role }) => {
  if (role !== UserRole.Employee && role !== UserRole.Admin) return null;
  const tone =
    role === UserRole.Admin
      ? "bg-saffron-100 text-saffron-800"
      : "bg-korastone-200 text-korastone-800";
  return (
    <span className={`rounded-full px-2 text-xs leading-5 whitespace-nowrap ${tone}`}>
      Wants {UserRoleLabels[role]}
    </span>
  );
};

interface UnlinkedUserDropdownProps {
  users: UnlinkedUser[];
  selectedUser: UnlinkedUser | null;
  onSelectUser: (user: UnlinkedUser) => void;
}

const UnlinkedUserDropdown: React.FC<UnlinkedUserDropdownProps> = ({
  users,
  selectedUser,
  onSelectUser,
}) => {
  const items: MenuProps["items"] = users.map((user) => ({
    key: user.userId,
    label: (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar src={user.profilePicture || noUserImage} size="small" />
          <span>{user.fullName}</span>
        </div>
        <div className="flex items-center gap-2">
          <RequestedRoleTag role={user.requestedRole} />
          {user.signupMethod === "google" ? (
            <GoogleOutlined className="text-[#4285F4]" />
          ) : (
            <MailOutlined className="text-zinc-700" />
          )}
        </div>
      </div>
    ),
    onClick: () => onSelectUser(user),
  }));

  const countPill = (
    <span className="rounded-full bg-korablue-500 px-2 text-xs font-semibold leading-5 text-white whitespace-nowrap">
      {users.length} waiting
    </span>
  );

  return (
    <Dropdown menu={{ items }} trigger={["click"]} disabled={users.length === 0}>
      <div className="cursor-pointer border rounded-2xl px-2 py-2 w-full max-w-sm hover:shadow-sm bg-white">
        <Space className="flex justify-between">
          {selectedUser ? (
            <>
              <div className="flex gap-2 items-center">
                <Avatar src={selectedUser.profilePicture} size="small" />
                <span>{selectedUser.fullName}</span>
              </div>
              <div className="flex gap-2 items-center">
                <RequestedRoleTag role={selectedUser.requestedRole} />
                {countPill}
                {selectedUser.signupMethod === "google" ? (
                  <GoogleOutlined className="text-[#4285F4]" />
                ) : (
                  <MailOutlined className="text-zinc-700" />
                )}
                <DownOutlined />
              </div>
            </>
          ) : (
            <div className="w-full flex items-center justify-between gap-4 px-2">
              <span className="text-zinc-500">
                {users.length === 0 ? "No users waiting" : "Select an unlinked user"}
              </span>
              {users.length > 0 && (
                <div className="flex gap-2 items-center">
                  {countPill}
                  <DownOutlined />
                </div>
              )}
            </div>
          )}
        </Space>
      </div>
    </Dropdown>
  );
};

export default UnlinkedUserDropdown;
