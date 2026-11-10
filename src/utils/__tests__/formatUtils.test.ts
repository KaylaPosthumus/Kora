import { describe, it, expect } from "vitest";
import { formatPhone, formatRandAmount, formatShortRandAmount } from "@/utils/formatUtils";

/**
 * Unit tests for the display formatters.
 *
 * `formatRandAmount` delegates to `Intl.NumberFormat`, whose separators are
 * non-breaking spaces. Asserting on those invisibly is a trap for the next
 * person editing the file, so the assertions normalise whitespace to a plain
 * space first — the grouping and the comma decimal separator are still pinned,
 * just readably.
 */

/** Collapses NBSP / narrow-NBSP separators to a plain space. */
const readable = (value: string) => value.replace(/\s/g, " ");

describe("formatPhone", () => {
  it("formats a local 10-digit number", () => {
    expect(formatPhone("0821234567")).toBe("+27 82 123 4567");
  });

  it("strips spaces, dashes and brackets before formatting", () => {
    expect(formatPhone("(082) 123-4567")).toBe("+27 82 123 4567");
  });

  it("drops the leading zero rather than keeping it after the country code", () => {
    // The slice starts at index 1, which is what turns 082 into 82.
    expect(formatPhone("0119876543")).toBe("+27 11 987 6543");
  });

  it("truncates anything past 10 digits", () => {
    // A pasted +27 number arrives as 11 digits; the extra is cut, not wrapped.
    expect(formatPhone("08212345678999")).toBe("+27 82 123 4567");
  });

  it("produces a short, obviously-wrong string for too few digits rather than throwing", () => {
    // Worth knowing: there is no validation here, so a bad number renders as a
    // stub instead of erroring. Validation belongs on the form.
    expect(formatPhone("0821")).toBe("+27 82 1 ");
  });
});

describe("formatRandAmount", () => {
  it("renders a whole amount with two decimals", () => {
    expect(readable(formatRandAmount(999))).toBe("R 999,00");
  });

  it("uses a comma as the decimal separator, en-ZA style", () => {
    expect(readable(formatRandAmount(1234.5))).toBe("R 1 234,50");
  });

  it("groups thousands", () => {
    expect(readable(formatRandAmount(123123456789))).toBe("R 123 123 456 789,00");
  });

  it("puts the minus sign before the currency symbol", () => {
    expect(readable(formatRandAmount(-999))).toBe("-R 999,00");
  });

  it("renders zero rather than an empty string", () => {
    expect(readable(formatRandAmount(0))).toBe("R 0,00");
  });
});

describe("formatShortRandAmount", () => {
  it("abbreviates thousands, millions, billions and trillions", () => {
    expect(formatShortRandAmount(1500)).toBe("R1.5K");
    expect(formatShortRandAmount(2_500_000)).toBe("R2.5M");
    expect(formatShortRandAmount(3_500_000_000)).toBe("R3.5B");
    expect(formatShortRandAmount(4_500_000_000_000)).toBe("R4.5T");
  });

  it("drops a trailing .0", () => {
    expect(formatShortRandAmount(1000)).toBe("R1K");
    expect(formatShortRandAmount(2_000_000)).toBe("R2M");
  });

  it("falls back to the full currency format below a thousand", () => {
    // Under 1000 it returns Intl's output directly — note the space and comma,
    // which the abbreviated branch does not have.
    expect(readable(formatShortRandAmount(999))).toBe("R 999,00");
  });

  it("keeps the sign outside the R for a negative amount", () => {
    expect(formatShortRandAmount(-2_500_000)).toBe("-R2.5M");
  });

  it("switches format exactly at a thousand", () => {
    expect(readable(formatShortRandAmount(999.99))).toBe("R 999,99");
    expect(formatShortRandAmount(1000)).toBe("R1K");
  });

  it("truncates rather than rounds up at a boundary", () => {
    // 1_999_999 is 1.999999M, and toFixed(1) rounds it to 2.0M — so the short
    // form can read a hair above the real figure.
    expect(formatShortRandAmount(1_999_999)).toBe("R2M");
  });
});
