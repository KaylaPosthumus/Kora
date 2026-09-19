import React from 'react';

interface PendingLeaveRequest {
  leaveRequestId: string;
  employeeId: string;
  fullName: string;
  startDate: string;
  endDate: string;
  leaveTypeName: string;
  createdAt: string;
}

interface LeaveCardAdminDashProps {
  leave: PendingLeaveRequest;
}

const LeaveCardAdminDash: React.FC<LeaveCardAdminDashProps> = ({ leave }) => {
  const start = new Date(leave.startDate);
  const end = new Date(leave.endDate);
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  return (
    <div className="p-3 rounded-xl flex flex-col border-2 border-zinc-500 group transition-colors duration-200">
      <h4 className="font-semibold text-md mb-1">{leave.fullName}</h4>
      <p className="text-xs">Submitted on {new Date(leave.createdAt).toLocaleDateString()} </p>

      <div className="hidden-0 max-h-0 pointer-events-none overflow-hidden group-hover:hidden-100 group-hover:max-h-96 group-hover:pointer-events-auto group-hover:mt-2 transition-all duration-300 ease-in-out">
        <h4 className="text-zinc-900 font-medium text-sm">Leave Type: {leave.leaveTypeName}</h4>
        <div className="flex justify-between font-light text-sm">
          <p>
            {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}
          </p>
          <p>
            {days} {days === 1 ? 'Day' : 'Days'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LeaveCardAdminDash;