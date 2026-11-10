/**
 * Uploads, on Firebase Storage.
 *
 * Replaces CoriCore's Image API, and the Cloudinary upload widgets that stood in
 * for it during the port. `storage.rules` is what authorises these writes, so
 * the limits below deliberately mirror the ones it enforces — a client-side
 * check that disagreed with the rule would either reject files the bucket would
 * have taken, or let the user pick a file only to have the upload fail.
 *
 * Two prefixes, matching the rules:
 *   profilePictures/{userId}/{fileName}
 *   reviewDocuments/{reviewId}/{fileName}
 */

import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

/** Mirrors `isImageUnder(5)` in storage.rules. */
export const MAX_PROFILE_PICTURE_BYTES = 5 * 1024 * 1024;

/** Mirrors the reviewDocuments size check in storage.rules. */
export const MAX_REVIEW_DOCUMENT_BYTES = 10 * 1024 * 1024;

/** What a file has to be before it is worth attempting an upload. */
export type Validation = { ok: true } | { ok: false; reason: string };

/** The parts of a File this module needs, so callers can be tested without one. */
export interface UploadableFile {
  name: string;
  size: number;
  type: string;
}

const megabytes = (bytes: number) => Math.round(bytes / (1024 * 1024));

/**
 * A single, safe path segment.
 *
 * The rules match `…/{userId}/{fileName}` — exactly one segment after the id. A
 * name containing a slash would produce a deeper path that matches no rule at
 * all and is denied, so stripping separators is correctness rather than tidiness.
 * A timestamp prefix keeps a re-upload of the same filename from silently
 * replacing the previous one.
 */
export const safeFileName = (name: string, now: number = Date.now()): string => {
  const cleaned = name
    .replace(/[/\\]+/g, "-")
    // Storage tolerates more than this, but a conservative set avoids surprises
    // in URLs and in the console's object browser.
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[.-]+/, "")
    .slice(-100);

  return `${now}-${cleaned || "upload"}`;
};

export const validateProfilePicture = (file: UploadableFile): Validation => {
  if (!file.type.startsWith("image/")) {
    return { ok: false, reason: "Profile pictures must be an image." };
  }
  if (file.size > MAX_PROFILE_PICTURE_BYTES) {
    return {
      ok: false,
      reason: `Images must be under ${megabytes(MAX_PROFILE_PICTURE_BYTES)}MB.`,
    };
  }
  if (file.size === 0) return { ok: false, reason: "That file is empty." };

  return { ok: true };
};

export const validateReviewDocument = (file: UploadableFile): Validation => {
  // The rules cap the size but do not check the type — Storage rules cannot see
  // inside the file, and the previous widget accepted PDFs only. Keeping the
  // check here preserves that; it is a usability guard, not a security one.
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return { ok: false, reason: "Supporting documents must be a PDF." };
  }
  if (file.size > MAX_REVIEW_DOCUMENT_BYTES) {
    return {
      ok: false,
      reason: `Documents must be under ${megabytes(MAX_REVIEW_DOCUMENT_BYTES)}MB.`,
    };
  }
  if (file.size === 0) return { ok: false, reason: "That file is empty." };

  return { ok: true };
};

/** The storage path an upload lands at. */
export const profilePicturePath = (userId: string, fileName: string): string =>
  `profilePictures/${userId}/${fileName}`;

export const reviewDocumentPath = (reviewId: string, fileName: string): string =>
  `reviewDocuments/${reviewId}/${fileName}`;

/**
 * Uploads a file and returns the URL to store on the document.
 *
 * The download URL carries its own access token, which is what lets an `<img>`
 * or an anchor use it directly — the same way the Cloudinary `secure_url` did,
 * so nothing downstream changes.
 */
const upload = async (path: string, file: Blob, contentType: string): Promise<string> => {
  const target = ref(storage, path);
  await uploadBytes(target, file, { contentType });
  return getDownloadURL(target);
};

export const uploadProfilePicture = async (
  userId: string,
  file: File,
  now?: number
): Promise<string> =>
  upload(profilePicturePath(userId, safeFileName(file.name, now)), file, file.type);

export const uploadReviewDocument = async (
  reviewId: string,
  file: File,
  now?: number
): Promise<string> =>
  upload(
    reviewDocumentPath(reviewId, safeFileName(file.name, now)),
    file,
    file.type || "application/pdf"
  );
