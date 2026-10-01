/**
 * Utility functions for file handling
 */

/**
 * Cleans a URL by removing the @ prefix if present
 * @param url The URL to clean
 * @returns The cleaned URL
 */
export const cleanFileUrl = (url: string): string => {
  if (!url) return "";
  return url.startsWith("@") ? url.substring(1) : url;
};

/**
 * Downloads a file from a URL
 * @param url The URL of the file to download
 * @param messageApi Antd message API for showing notifications
 */
export const downloadFileFromUrl = async (url: string, messageApi: any): Promise<void> => {
  if (!url) return;

  try {
    messageApi.loading("Downloading document...");

    // Clean the URL if needed (not needed as per user clarification)
    const cleanUrl = cleanFileUrl(url);

    // Get the file name from the URL
    const fileName = cleanUrl.split("/").pop() || "document.pdf";

    console.log("Downloading PDF document:", fileName);

    const response = await fetch(cleanUrl);

    if (response.ok) {
      const blob = await response.blob();

      // Check if blob is empty
      if (blob.size === 0) {
        throw new Error("Downloaded file is empty");
      }

      // Proceed with download
      const blobUrl = window.URL.createObjectURL(blob);
      const downloadLink = document.createElement("a");
      downloadLink.href = blobUrl;
      downloadLink.download = fileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      window.URL.revokeObjectURL(blobUrl);
      messageApi.success("Download complete");
      return;
    } else if (response.status === 401) {
      // If 401, fall through to Option 2
      console.log("Direct download failed with 401, trying to open in new tab");
    } else {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error("Download failed:", error);
    messageApi.error("Download failed. Please try again.");
  }
};
