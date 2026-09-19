import React from "react";
import { Avatar, Dropdown, MenuProps, Space } from "antd";
import { GoogleOutlined, MailOutlined, DownOutlined } from "@ant-design/icons";
import noUserImage from "@/assets/icons/no_profile_image.png";

export interface UnlinkedUser {
  userId: string;
  fullName: string;
  profilePicture: string;
  signupMethod: "google" | "email";
}

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
        {user.signupMethod === "google" ? (
          <GoogleOutlined className="text-[#4285F4]" />
        ) : (
          <MailOutlined className="text-zinc-700" />
        )}
      </div>
    ),
    onClick: () => onSelectUser(user),
  }));

  return (
    <Dropdown menu={{ items }} trigger={["click"]}>
      <div className="cursor-pointer border rounded-2xl px-2 py-2 w-full max-w-sm hover:shadow-sm bg-white">
        <Space className="flex justify-between">
          {selectedUser ? (
            <>
              <div className="flex gap-2 items-center">
                <Avatar src={selectedUser.profilePicture} size="small" />
                <span>{selectedUser.fullName}</span>
              </div>
              <div className="flex gap-2">
                {selectedUser.signupMethod === "google" ? (
                  <GoogleOutlined className="text-[#4285F4]" />
                ) : (
                  <MailOutlined className="text-zinc-700" />
                )}
                <DownOutlined />
              </div>
            </>
          ) : (
            <div className="w-full flex itmes-center justify-between gap-4 px-2">
              <div>
                <span className="text-zinc-500">Select an unlinked user</span>
              </div>
              <div></div>
            </div>
          )}
        </Space>
      </div>
    </Dropdown>
  );
};

export default UnlinkedUserDropdown;
