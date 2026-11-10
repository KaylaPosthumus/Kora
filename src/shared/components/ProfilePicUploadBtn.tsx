import React, { useRef, useState } from "react";
import { message } from "antd";
import { Icons } from "@/constants/icons";
import KoraCircleBtn from "@/shared/components/KoraCircleBtn";
import { uploadProfilePicture, validateProfilePicture } from "@/services/storageService";

/**
 * Profile picture upload, on Firebase Storage.
 *
 * Was a Cloudinary upload widget. The move to Storage means `storage.rules` is
 * what authorises the write, so the file lands under
 * `profilePictures/{userId}/…` — the prefix those rules grant.
 *
 * `userId` is the *owner's* auth uid, not the caller's: an admin editing an
 * employee's profile uploads to that employee's prefix, which the rules allow
 * (`isSelf(userId) || isAdmin()`).
 *
 * One capability is lost in the move: the Cloudinary widget offered cropping and
 * a camera source, and a plain file input does not. Nothing in the app depended
 * on either, and the alternative was keeping a second asset host wired up purely
 * for a cropper.
 */
interface ProfilePicUploadBtnProps {
  /** The auth uid of the person whose picture this is. */
  userId: string;
  onUploadSuccess: (url: string) => void;
  className?: string;
}

const ProfilePicUploadBtn: React.FC<ProfilePicUploadBtnProps> = ({
  userId,
  onUploadSuccess,
  className,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Clear immediately so picking the same file again still fires a change.
    event.target.value = "";
    if (!file) return;

    const validation = validateProfilePicture(file);
    if (!validation.ok) {
      messageApi.error(validation.reason);
      return;
    }

    if (!userId) {
      messageApi.error("Cannot upload a picture before the account is linked.");
      return;
    }

    setUploading(true);
    try {
      onUploadSuccess(await uploadProfilePicture(userId, file));
    } catch (error) {
      // Most often a rules rejection — an unlinked account, or a stale ID token
      // whose role claim has not caught up yet.
      console.error("Profile picture upload failed", error);
      messageApi.error("Could not upload that picture. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      {contextHolder}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleFile}
      />
      <KoraCircleBtn
        icon={uploading ? <Icons.Upload /> : <Icons.Edit />}
        className={className}
        aria-label="Upload a profile picture"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      />
    </>
  );
};

export default ProfilePicUploadBtn;
