import React from "react";
import "@/styles/authPanel.css";

/**
 * The dark left half of the login and signup screens.
 *
 * A run of calendar weeks stands in for the old photograph: what Kora shows
 * an employee — days off in saffron, meetings in blue — drawn in markup, so it
 * costs nothing on the landing route. The pattern is fixed rather than random
 * so the panel looks the same on every load and in every screenshot.
 */

const WEEKS = 14;
const TODAY = "5-2";

// Leave comes in runs of consecutive weekdays, so it is drawn that way.
const LEAVE = new Set([
  "1-1", "1-2", "1-3",
  "4-0", "4-1", "4-2", "4-3", "4-4",
  "8-2", "8-3",
  "12-0", "12-1",
]);

const MEETINGS = new Set(["0-3", "2-1", "3-4", "5-0", "6-2", "7-3", "9-1", "10-4", "11-2", "13-3"]);

const cellClass = (week: number, day: number): string => {
  const key = `${week}-${day}`;
  if (LEAVE.has(key)) return "auth-panel__day auth-panel__day--leave";
  if (MEETINGS.has(key)) return "auth-panel__day auth-panel__day--meeting";
  if (day >= 5) return "auth-panel__day auth-panel__day--weekend";
  return "auth-panel__day";
};

const AuthPanel: React.FC = () => (
  <div className="auth-panel hidden lg:flex" aria-hidden="true">
    <div className="auth-panel__calendar">
      {Array.from({ length: WEEKS }, (_, week) =>
        Array.from({ length: 7 }, (_, day) => (
          <span
            key={`${week}-${day}`}
            className={`${cellClass(week, day)}${`${week}-${day}` === TODAY ? " auth-panel__day--today" : ""}`}
            style={{ "--order": week * 7 + day } as React.CSSProperties}
          />
        ))
      )}
    </div>

    <div className="auth-panel__copy">
      <p className="auth-panel__headline">
        Leave, meetings and your team, in one place.
      </p>
      <p className="auth-panel__sub">
        Book time off, see who is out, and know what is on this week.
      </p>
      <ul className="auth-panel__legend">
        <li>
          <span className="auth-panel__swatch auth-panel__day--leave" />
          Leave
        </li>
        <li>
          <span className="auth-panel__swatch auth-panel__day--meeting" />
          Meeting
        </li>
      </ul>
    </div>
  </div>
);

export default AuthPanel;
