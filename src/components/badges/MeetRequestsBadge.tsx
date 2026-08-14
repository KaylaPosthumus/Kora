import React, { useEffect, useState } from "react";

interface MeetRequestsBadgeProps {
  requests: number;
  employee?: boolean;
  onClick?: () => void;
}

function MeetRequestsBadge({ requests, employee, onClick }: MeetRequestsBadgeProps) {
  const [showText, setShowText] = useState(true);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowText(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const shouldShowText = showText || hovered;

  return (
    <>
      {employee ? (
        <>
          {requests > 0 && (
            <div className="bg-sakura-500 text-sakura-900 pl-3 pr-4 py-1 rounded-full flex items-center gap-2">
              <div className="rounded-full bg-sakura-50 w-2 h-2"></div>
              <p className="font-medium text-sm">
                {requests} Request{requests === 1 ? "" : "s"} Pending
              </p>
            </div>
          )}
        </>
      ) : (
        requests > 0 && (
          <div
            className="group h-10 min-w-32 w-full flex items-center justify-start"
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <div
              className={`transition-all duration-300 bg-red-700 w-3 h-3 group-hover:h-6 group-hover:w-full text-white group-hover:pl-2 group-hover:pr-4 py-1 rounded-full flex justify-center items-center gap-2 cursor-pointer overflow-hidden ${
                shouldShowText ? "w-full h-6 pl-2 pr-4" : "w-3 h-3"
              }`}
            >
              <div className="rounded-full bg-red-400 w-3 h-3"></div>
              <p
                className={` text-white font-medium text-sm transition-all duration-300 truncate ${
                  shouldShowText ? "opacity-100" : "opacity-0"
                }`}
              >
                {requests} New Request{requests === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        )
      )}
    </>
  );
}

export default MeetRequestsBadge;

{
  /* <>
      {requests > 0 && (
        <div className="bg-red-700 text-white pl-3 pr-4 py-1 rounded-full flex items-center gap-2">
          <div className="rounded-full bg-red-500 w-2 h-2"></div>
          {employee ? (
            <p className="text-white font-medium text-sm">
              {requests} Request{requests === 1 ? "" : "s"} Pending
            </p>
          ) : (
            <p className="text-white font-medium text-sm">
              {requests} Request{requests === 1 ? "" : "s"}
            </p>
          )}
        </div>
      )}
    </> */
}
