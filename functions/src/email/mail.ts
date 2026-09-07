/**
 * Outgoing mail, written as documents rather than sent directly.
 *
 * CoriCore talked to an SMTP provider from inside the request. Here a function
 * appends to a `mail` collection and something else drains it — the shape
 * Firebase's `firestore-send-email` extension expects. That keeps the provider
 * (and its credentials) out of this codebase entirely: swapping SendGrid for SES
 * is an extension setting, not a code change, and a send that fails is retried
 * by the extension instead of failing the user's request.
 *
 * If the extension is not installed, these documents simply accumulate
 * unsent — visible, replayable, and not lost.
 */

/** The document shape `firestore-send-email` reads. */
export interface MailDocument {
  to: string[];
  message: {
    subject: string;
    text: string;
    html: string;
  };
}

/** The collection the extension watches. */
export const MAIL_COLLECTION = "mail";

/** Minimal HTML escaping — a display name is user-supplied and lands in the body. */
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** A greeting that reads naturally whether or not a name is known. */
const greeting = (name?: string): string =>
  name && name.trim().length > 0 ? `Hi ${name.trim()}` : "Hi";

/**
 * The verification email carrying a 6-digit code.
 *
 * Both a text and an HTML body: a text/plain alternative keeps it out of spam
 * folders and readable in clients that refuse HTML.
 */
export const verificationEmail = (
  to: string,
  code: string,
  minutesValid: number,
  fullName?: string
): MailDocument => {
  const subject = `Your Kora verification code is ${code}`;
  const opening = greeting(fullName);

  const text = [
    `${opening},`,
    "",
    `Your Kora verification code is ${code}.`,
    `It expires in ${minutesValid} minutes.`,
    "",
    "If you didn't ask to verify this address, you can ignore this email.",
  ].join("\n");

  const html = [
    `<p>${escapeHtml(opening)},</p>`,
    `<p>Your Kora verification code is <strong style="font-size:1.25em;letter-spacing:0.15em">${code}</strong></p>`,
    `<p>It expires in ${minutesValid} minutes.</p>`,
    `<p style="color:#666">If you didn't ask to verify this address, you can ignore this email.</p>`,
  ].join("\n");

  return { to: [to], message: { subject, text, html } };
};
