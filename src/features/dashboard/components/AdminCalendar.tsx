import React, { useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; 
import "@/styles/adminDash.css"; 

const AdminCalendar = ({ value, onChange }: { value: Date; onChange: (date: Date) => void }) => (
  <div className="bg-korastone-50 rounded-2xl shadow-sm p-3">
    <Calendar
      className="kora-calendar"
      prev2Label={null}
      next2Label={null}
      onChange={(date) => onChange(date as Date)}
      value={value}
    />
  </div>
);

export default AdminCalendar;
