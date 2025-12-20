import React, { useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronLeft } from 'lucide-react';

export function MeetingFinderView({ staff, onBack }) {
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const today = format(new Date(), 'EEEE');
  const [expandedDay, setExpandedDay] = useState(dayOrder.includes(today) ? today : null);

  const generateTimeSlots = (day) => {
    // This function should be identical to the one in TimetableEditor
    const slots = [];
    if (day === 'Friday') {
      slots.push({ label: 'Meeting', time: '07:00 - 08:20' });
      let time = new Date();
      time.setHours(8, 20, 0, 0);
      for (let i = 0; i < 11; i++) {
        const startTime = format(time, 'HH:mm');
        time.setMinutes(time.getMinutes() + 20);
        const endTime = format(time, 'HH:mm');
        slots.push({ label: `P${i + 1}`, time: `${startTime} - ${endTime}` });
      }
    } else {
      slots.push({ label: 'Meeting', time: '07:00 - 08:00' });
      let time = new Date();
      time.setHours(8, 0, 0, 0);
      for (let i = 0; i < 21; i++) {
        const startTime = format(time, 'HH:mm');
        time.setMinutes(time.getMinutes() + 20);
        const endTime = format(time, 'HH:mm');
        slots.push({ label: `P${i + 1}`, time: `${startTime} - ${endTime}` });
      }
      slots.push({ label: 'Meeting', time: '15:15 - 16:15' });
    }
    return slots;
  };

  const availability = dayOrder.reduce((acc, day) => {
    const timeSlots = generateTimeSlots(day);
    acc[day] = timeSlots.map((slot, i) => {
      const freeStaff = [];
      const busyStaff = [];
      staff.forEach((member) => {
        const memberSlot = member.timetable?.[day]?.[i];
        if (memberSlot?.isFree) {
          freeStaff.push(member);
        } else {
          busyStaff.push(member);
        }
      });
      return { ...slot, freeStaff, busyStaff };
    });
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-200 h-full flex flex-col p-8">
      <div className="flex items-center gap-4 mb-8 pb-4 border-b border-gray-100">
        <button onClick={onBack} className="p-3 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronLeft size={24} className="text-gray-600" />
        </button>
        <h2 className="text-3xl font-bold text-gray-800">Meeting Slot Finder</h2>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar -mr-4 pr-4">
        <div className="space-y-2">
          {dayOrder.map((day) => {
            const isToday = day === today;
            const isExpanded = expandedDay === day;
            const slots = availability[day];
            const allFreeSlots = slots.filter((s) => s.freeStaff.length === staff.length).length;

            return (
              <div
                key={day}
                className={`rounded-3xl border transition-all duration-300 ${
                  isToday ? 'bg-indigo-50/50 border-indigo-200' : 'bg-gray-50 border-gray-100'
                }`}
              >
                <button
                  onClick={() => setExpandedDay((prev) => (prev === day ? null : day))}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-bold text-gray-700 uppercase tracking-wide">{day}</div>
                    {isToday && (
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">Today</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    {allFreeSlots > 0 && (
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                        {allFreeSlots} fully free slot{allFreeSlots > 1 ? 's' : ''}
                      </span>
                    )}
                    <ChevronDown
                      size={16}
                      className={`text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3">
                    {slots.map((slot, i) => (
                      <div
                        key={i}
                        className={`p-4 rounded-2xl border ${
                          slot.freeStaff.length === staff.length
                            ? 'bg-emerald-50 border-emerald-200'
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 uppercase">{slot.label}</span>
                            <span className="text-xs text-gray-500 font-mono">{slot.time}</span>
                          </div>
                          <div
                            className={`text-sm font-bold px-3 py-1 rounded-full text-white ${
                              slot.freeStaff.length === staff.length ? 'bg-emerald-500' : 'bg-gray-400'
                            }`}
                          >
                            {slot.freeStaff.length} / {staff.length} Free
                          </div>
                        </div>
                        {slot.freeStaff.length < staff.length && (
                          <div>
                            <h4 className="text-[11px] font-bold text-gray-400 uppercase mb-2">Busy</h4>
                            <div className="flex flex-wrap gap-2">
                              {slot.busyStaff.map((member) => (
                                <div
                                  key={member.id}
                                  className="flex items-center gap-2 px-2 py-1 bg-gray-100 rounded-lg text-xs font-semibold text-gray-600"
                                >
                                  <div className="w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center text-[10px]">
                                    {member.initials?.[0]}
                                  </div>
                                  {member.name}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
