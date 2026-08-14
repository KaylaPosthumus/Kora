import React from "react";
import { Icons } from "../../constants/icons";
import CoriCircleBtn from "../buttons/CoriCircleBtn";

// Cloudinary Upload Widget (For Uploading Profile Pictures)

declare global {
  interface Window {
    cloudinary: any;
  }
}

interface ProfilePicUploadBtnProps {
  onUploadSuccess: (url: string) => void;
  className?: string;
}

const ProfilePicUploadBtn: React.FC<ProfilePicUploadBtnProps> = ({
  onUploadSuccess,
  className,
}) => {
  const openWidget = () => {
    const widget = window.cloudinary.createUploadWidget(
      {
        cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME,
        uploadPreset: import.meta.env.VITE_CLOUDINARY_PROFPICS_PRESET,
        sources: ["local", "url", "camera"],
        multiple: false,
        cropping: true,
        defaultSource: "local",
        resourceType: "image",
        maxFileSize: 2000000, // 2MB
      },
      (error: any, result: any) => {
        if (!error && result && result.event === "success") {
          console.log("Upload successful:", result.info);
          onUploadSuccess(result.info.secure_url);
        }
      }
    );
    widget.open();
  };

  return <CoriCircleBtn icon={<Icons.Edit />} className={className} onClick={openWidget} />;
};

export default ProfilePicUploadBtn;
