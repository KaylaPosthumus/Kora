/**
 * Utility functions for handling images
 */

/**
 * Normalises a stored profile picture reference into something an `<img>` can use.
 *
 * The old .NET server hosted uploads itself, so relative paths had to be resolved
 * against `VITE_API_URL`. Every picture is now an absolute URL — Cloudinary for
 * uploads, Google for OAuth avatars — so there is nothing left to prefix.
 *
 * @param relativePath - A stored image reference, or null
 * @returns The image URL, or null if none was provided
 */
export const getFullImageUrl = (relativePath: string | null): string | null => {
  if (!relativePath) return null;

  return relativePath;
};
