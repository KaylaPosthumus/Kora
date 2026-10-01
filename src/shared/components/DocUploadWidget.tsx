import React, { useRef, useState } from "react";
import { message } from "antd";
import { Icons } from "@/constants/icons";
import { downloadFileFromUrl } from "@/utils/fileUtils";
import { uploadReviewDocument, validateReviewDocument } from "@/services/storageService";

/**
 * Supporting-document upload for a performance review, on Firebase Storage.
 *
 * Was a Cloudinary upload widget. Files land under `reviewDocuments/{reviewId}/…`,
 * the prefix `storage.rules` grants to admins.
 *
 * Those rules cap the size but cannot check the type — Storage rules cannot see
 * inside a file — so the PDF-only restriction the widget enforced is kept
 * client-side in `validateReviewDocument`. It is a usability guard, not a
 * security boundary.
 */
interface DocUploadWidgetProps {
  /** The review the document belongs to; decides where it is stored. */
  reviewId: string;
  onUploadSuccess: (url: string | null) => void;
  uploadedFileUrl?: string;
  onViewFile?: (url: string) => void;
}

const DocUploadWidget: React.FC<DocUploadWidgetProps> = ({
  reviewId,
  onUploadSuccess,
  uploadedFileUrl,
  onViewFile,
}) => {
  const [messageApi, contextHolder] = message.useMessage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Handle document download
  const downloadFile = async (url: string) => {
    if (!url) return;
    await downloadFileFromUrl(url, messageApi);
  };

  const handleFileAction = (url: string) => {
    if (onViewFile) {
      onViewFile(url);
    } else {
      downloadFile(url);
    }
  };

  // Handle clearing the document
  const handleClearDocument = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the parent onClick handler
    onUploadSuccess(null);
    messageApi.success("Document cleared successfully");
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Clear immediately so picking the same file again still fires a change.
    event.target.value = "";
    if (!file) return;

    const validation = validateReviewDocument(file);
    if (!validation.ok) {
      messageApi.error(validation.reason);
      return;
    }

    if (!reviewId) {
      messageApi.error("Save the review before attaching a document.");
      return;
    }

    setUploading(true);
    try {
      onUploadSuccess(await uploadReviewDocument(reviewId, file));
      messageApi.success("Document uploaded successfully");
    } catch (error) {
      console.error("Review document upload failed", error);
      messageApi.error("Could not upload that document. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const openFilePicker = () => inputRef.current?.click();

  return (
    <>
      {contextHolder}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleFile}
      />
      <div className="w-full">
        {uploadedFileUrl ? (
          <div className="flex items-center justify-between p-3 border border-gray-200 rounded hover:bg-gray-50">
            <div
              className="flex items-center gap-2 cursor-pointer flex-grow"
              onClick={() => handleFileAction(uploadedFileUrl)}
            >
              <Icons.TextSnippet />
              <span className="text-sm text-blue-500 underline">Download PDF</span>
            </div>
            <div
              className="flex items-center justify-center w-6 h-6 rounded-full bg-red-50 hover:bg-red-100 cursor-pointer"
              onClick={handleClearDocument}
              title="Clear document"
            >
              <Icons.Delete fontSize="small" className="text-red-500" />
            </div>
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded cursor-pointer hover:border-blue-500"
            onClick={openFilePicker}
          >
            <Icons.Upload className="mb-2 text-gray-500" />
            <p className="text-zinc-500 text-[12px] mb-2">
              {uploading ? "Uploading…" : "Click to upload a PDF document"}
            </p>
            <p className="text-zinc-400 text-[10px]">PDF files only (max. 10MB)</p>
          </div>
        )}
      </div>
    </>
  );
};

export default DocUploadWidget;
