// Date Utility Functions

import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { PayCycle } from "../types/common";

dayjs.extend(duration);
dayjs.extend(utc);
dayjs.extend(timezone);

// Get the duration of employment in years, months, and days (E.g. "1 year, 2 months, 3 days")
const formatEmploymentDuration = (startDate: string): string => {
  const start = dayjs(startDate);
  const now = dayjs();
  const diff = dayjs.duration(now.diff(start));

  const years = diff.years();
  const months = diff.months();
  const days = diff.days();

  const parts = [];
  if (years > 0) parts.push(`${years} year${years > 1 ? "s" : ""}`);
  if (months > 0) parts.push(`${months} month${months > 1 ? "s" : ""}`);
  if (days > 0) parts.push(`${days} day${days > 1 ? "s" : ""}`);

  return parts.join(", ");
};

// Calculate the next pay day
const calculateNextPayDay = (payCycle: PayCycle, lastPaidDate: string): string => {
  // Format the last paid date (just in case)
  const lastPaid = dayjs(lastPaidDate);

  if (payCycle === PayCycle.Monthly) {
    return lastPaid.add(1, "month").format("DD MMM YYYY");
  }

  if (payCycle === PayCycle.BiWeekly) {
    return lastPaid.add(2, "week").format("DD MMM YYYY");
  }

  if (payCycle === PayCycle.Weekly) {
    return lastPaid.add(1, "week").format("DD MMM YYYY");
  } else {
    return "Invalid Pay Cycle";
  }
};

// Calculate the previous pay day (for undo payment)
const calculatePreviousPayDay = (payCycle: PayCycle, lastPaidDate: string): string => {
  // Format the last paid date (just in case)
  const lastPaid = dayjs(lastPaidDate);

  if (payCycle === PayCycle.Monthly) {
    return lastPaid.subtract(1, "month").format("DD MMM YYYY");
  }

  if (payCycle === PayCycle.BiWeekly) {
    return lastPaid.subtract(2, "week").format("DD MMM YYYY");
  }

  if (payCycle === PayCycle.Weekly) {
    return lastPaid.subtract(1, "week").format("DD MMM YYYY");
  } else {
    return "Invalid Pay Cycle";
  }
};

// Formats a timestamp to a date string (e.g. "01 Apr 2025")
const formatTimestampToDate = (timestamp: string): string => {
  // Parse the ISO timestamp directly
  return dayjs(timestamp).format("DD MMM YYYY");
};

// Formats a timestamp to a time string (e.g. "12:30")
const formatTimestampToTime = (timestamp: string): string => {
  // Parse the ISO timestamp directly
  return dayjs(timestamp).format("HH:mm");
};

// Combines a date and time into an ISO timestamp
const combineDateTimeToTimestamp = (date: string, time: string): string => {
  const [hours, minutes] = time.split(":");
  return dayjs(date).hour(parseInt(hours)).minute(parseInt(minutes)).toISOString();
};

// Boolean check if a given date is in the past
const isDateInPast = (date: string): boolean => {
  return dayjs(date).isBefore(dayjs());
};

// Calculate duration in days between two dates
const calculateDurationInDays = (startDate: string, endDate: string): number => {
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  return end.diff(start, "day") + 1;
};

export {
  formatEmploymentDuration,
  calculateNextPayDay,
  calculatePreviousPayDay,
  formatTimestampToDate,
  formatTimestampToTime,
  combineDateTimeToTimestamp,
  isDateInPast,
  calculateDurationInDays,
};
