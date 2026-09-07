import { describe, it, expect } from "vitest";

import { verificationEmail } from "../mail";

describe("verificationEmail", () => {
  it("addresses the recipient and carries the code in the subject", () => {
    const mail = verificationEmail("sam@kora.test", "012345", 10, "Sam");

    expect(mail.to).toEqual(["sam@kora.test"]);
    expect(mail.message.subject).toContain("012345");
  });

  it("puts the code in both bodies", () => {
    const mail = verificationEmail("sam@kora.test", "012345", 10, "Sam");

    expect(mail.message.text).toContain("012345");
    expect(mail.message.html).toContain("012345");
  });

  it("states the expiry window", () => {
    const mail = verificationEmail("sam@kora.test", "012345", 10, "Sam");

    expect(mail.message.text).toContain("10 minutes");
    expect(mail.message.html).toContain("10 minutes");
  });

  it("greets by name when one is known", () => {
    const mail = verificationEmail("sam@kora.test", "012345", 10, "Sam");

    expect(mail.message.text.startsWith("Hi Sam,")).toBe(true);
    expect(mail.message.html).toContain("Hi Sam,");
  });

  it("falls back to a bare greeting without a name", () => {
    const mail = verificationEmail("sam@kora.test", "012345", 10);

    expect(mail.message.text).toContain("Hi,");
    expect(mail.message.text).not.toContain("undefined");
  });

  it("treats a blank name as no name", () => {
    const mail = verificationEmail("sam@kora.test", "012345", 10, "   ");

    expect(mail.message.text).toContain("Hi,");
  });

  // A display name is user-supplied and lands inside the HTML body.
  it("escapes HTML in the display name", () => {
    const mail = verificationEmail("sam@kora.test", "012345", 10, "<script>alert(1)</script>");

    expect(mail.message.html).not.toContain("<script>");
    expect(mail.message.html).toContain("&lt;script&gt;");
  });

  it("escapes quotes and ampersands in the display name", () => {
    const mail = verificationEmail("sam@kora.test", "012345", 10, `A&B "quoted"`);

    expect(mail.message.html).toContain("&amp;");
    expect(mail.message.html).toContain("&quot;");
  });

  it("always provides a plain-text alternative", () => {
    const mail = verificationEmail("sam@kora.test", "012345", 10, "Sam");

    expect(mail.message.text.length).toBeGreaterThan(0);
    expect(mail.message.text).not.toContain("<p>");
  });
});
