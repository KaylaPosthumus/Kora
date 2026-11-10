import { describe, it, expect } from "vitest";

import {
  MAX_PROFILE_PICTURE_BYTES,
  MAX_REVIEW_DOCUMENT_BYTES,
  profilePicturePath,
  reviewDocumentPath,
  safeFileName,
  validateProfilePicture,
  validateReviewDocument,
  type UploadableFile,
} from "@/services/storageService";

const file = (overrides: Partial<UploadableFile> = {}): UploadableFile => ({
  name: "avatar.png",
  size: 1024,
  type: "image/png",
  ...overrides,
});

const AT = 1757000000000;

describe("safeFileName", () => {
  it("keeps an ordinary name, prefixed with a timestamp", () => {
    expect(safeFileName("avatar.png", AT)).toBe(`${AT}-avatar.png`);
  });

  // storage.rules matches `…/{userId}/{fileName}` — exactly one segment. A name
  // with a slash would produce a deeper path that matches no rule and is denied.
  it("strips path separators so the path stays one segment deep", () => {
    expect(safeFileName("../../etc/passwd", AT)).not.toContain("/");
    expect(safeFileName("a/b/c.png", AT)).not.toContain("/");
    expect(safeFileName("a\\b\\c.png", AT)).not.toContain("\\");
  });

  it("produces exactly one segment for any input", () => {
    const nasty = ["a/b", "..", "./x", "a//b///c", "\\\\server\\share"];
    for (const name of nasty) {
      expect(profilePicturePath("uid1", safeFileName(name, AT)).split("/")).toHaveLength(3);
    }
  });

  it("replaces characters that would be awkward in a URL", () => {
    expect(safeFileName("my photo (1)!.png", AT)).toBe(`${AT}-my-photo-1-.png`);
  });

  it("collapses runs of dashes", () => {
    expect(safeFileName("a???b.png", AT)).toBe(`${AT}-a-b.png`);
  });

  it("does not leave a leading dot, which would hide the object", () => {
    expect(safeFileName(".hidden", AT)).toBe(`${AT}-hidden`);
  });

  it("falls back to a placeholder when nothing survives cleaning", () => {
    expect(safeFileName("///", AT)).toBe(`${AT}-upload`);
  });

  it("caps a very long name", () => {
    expect(safeFileName(`${"x".repeat(500)}.png`, AT).length).toBeLessThan(140);
  });

  // Two uploads of the same filename must not silently replace each other.
  it("distinguishes two uploads of the same name", () => {
    expect(safeFileName("avatar.png", 1)).not.toBe(safeFileName("avatar.png", 2));
  });
});

describe("validateProfilePicture", () => {
  it("accepts an image inside the limit", () => {
    expect(validateProfilePicture(file())).toEqual({ ok: true });
  });

  it("rejects a non-image", () => {
    const result = validateProfilePicture(file({ type: "application/pdf" }));
    expect(result.ok).toBe(false);
  });

  // The limit mirrors isImageUnder(5) in storage.rules. Disagreeing would let a
  // user pick a file only for the bucket to refuse it.
  it("rejects an image over the rule's size limit", () => {
    const result = validateProfilePicture(file({ size: MAX_PROFILE_PICTURE_BYTES + 1 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("5MB");
  });

  it("accepts an image exactly at the limit boundary the rule allows", () => {
    expect(validateProfilePicture(file({ size: MAX_PROFILE_PICTURE_BYTES - 1 }))).toEqual({
      ok: true,
    });
  });

  it("rejects an empty file", () => {
    expect(validateProfilePicture(file({ size: 0 })).ok).toBe(false);
  });

  it.each(["image/png", "image/jpeg", "image/webp", "image/gif"])("accepts %s", (type) => {
    expect(validateProfilePicture(file({ type })).ok).toBe(true);
  });
});

describe("validateReviewDocument", () => {
  const pdf = (overrides: Partial<UploadableFile> = {}) =>
    file({ name: "review.pdf", type: "application/pdf", ...overrides });

  it("accepts a PDF inside the limit", () => {
    expect(validateReviewDocument(pdf())).toEqual({ ok: true });
  });

  it("rejects a non-PDF", () => {
    expect(validateReviewDocument(pdf({ name: "x.png", type: "image/png" })).ok).toBe(false);
  });

  // Some browsers hand over an empty type; the extension is the fallback.
  it("accepts a PDF whose type the browser did not report", () => {
    expect(validateReviewDocument(pdf({ type: "" })).ok).toBe(true);
  });

  it("accepts an uppercase extension", () => {
    expect(validateReviewDocument(pdf({ name: "REVIEW.PDF", type: "" })).ok).toBe(true);
  });

  it("rejects a document over the rule's size limit", () => {
    const result = validateReviewDocument(pdf({ size: MAX_REVIEW_DOCUMENT_BYTES + 1 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("10MB");
  });

  it("rejects an empty file", () => {
    expect(validateReviewDocument(pdf({ size: 0 })).ok).toBe(false);
  });
});

describe("paths", () => {
  // These must match the two prefixes storage.rules grants, or every write is
  // denied by the catch-all.
  it("puts a profile picture under its owner's id", () => {
    expect(profilePicturePath("uid1", "a.png")).toBe("profilePictures/uid1/a.png");
  });

  it("puts a review document under its review id", () => {
    expect(reviewDocumentPath("rev1", "a.pdf")).toBe("reviewDocuments/rev1/a.pdf");
  });
});
