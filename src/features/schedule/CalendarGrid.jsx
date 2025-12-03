import React from 'react';
import { format, startOfWeek, addDays, getDay, differenceInMinutes } from 'date-fns';

const eventTypeColors = {
  class: 'bg-blue-200 border-blue-400 text-blue-800',
  meeting: 'bg-purple-200 border-purple-400 text-purple-800',
  duty: 'bg-amber-200 border-amber-400 text-amber-800',
  eca: 'bg-pink-200 border-pink-400 text-pink-800',
  break: 'bg-gray-200 border-gray-400 text-gray-800',
  other: 'bg-teal-200 border-teal-400 text-teal-800',
};

const hourHeight = 60; // pixels per hour

export function CalendarGrid({ events, onEventClick, onSlotClick }) {
  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const hours = Array.from({ length: 13 }, (_, i) => i + 6); // 6 AM to 6 PM (covers up to 7 PM)

  const getEventStyle = (event) => {
    const startOfDay = new Date(event.startTime);
    startOfDay.setHours(6, 0, 0, 0);

    const top = (differenceInMinutes(event.startTime, startOfDay) / 60) * hourHeight;
    const height = (differenceInMinutes(event.endTime, event.startTime) / 60) * hourHeight;

    return {
      top: `${top}px`,
      height: `${height}px`,
    };
  };

  const handleGridClick = (e, dayIndex) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const hour = Math.floor(y / hourHeight) + 6;
    const minute = Math.floor(((y % hourHeight) / hourHeight) * 60);

    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const clickedDay = addDays(weekStart, dayIndex);
    
    const clickedTime = new Date(clickedDay);
    clickedTime.setHours(hour, minute, 0, 0);

    onSlotClick(clickedTime);
  };

  return (
    <div className="flex-1 overflow-auto custom-scrollbar relative grid grid-cols-[60px_repeat(5,1fr)]">
      {/* Time column */}
      <div className="relative">
        {hours.map((hour) => (
          <div key={hour} className="h-[60px] relative -top-3.5 text-right pr-2">
            <span className="text-xs font-bold text-gray-400">{format(new Date().setHours(hour), 'ha')}</span>
          </div>
        ))}
      </div>

      {/* Day columns */}
      {weekDays.map((day, dayIndex) => (
        <div
          key={day}
          className="relative border-l border-gray-100"
          onClick={(e) => handleGridClick(e, dayIndex)}
        >
          {/* Hour lines */}
          {hours.map((hour) => (
            <div key={hour} className="h-[60px] border-t border-gray-100"></div>
          ))}

          {/* Events for this day */}
          {events
            .filter((event) => getDay(event.startTime) === dayIndex + 1)
            .map((event) => (
              <div
                key={event.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onEventClick(event);
                }}
                style={getEventStyle(event)}
                className={`absolute left-1 right-1 p-2 rounded-lg border text-xs cursor-pointer overflow-hidden ${
                  eventTypeColors[event.type] || eventTypeColors.other
                }`}
              >
                <p className="font-bold truncate">{event.title}</p>
                <p className="truncate">{event.room || event.classCode}</p>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}
