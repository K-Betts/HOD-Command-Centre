import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useStaffScheduleEvents } from '../../hooks/useStaffScheduleEvents';
import { CalendarGrid } from '../schedule/CalendarGrid';
import { EventModal } from '../schedule/EventModal';

export function StaffScheduleView({ user, staffId }) {
  const { events, addEvent, updateEvent, deleteEvent } = useStaffScheduleEvents(user, staffId);
  const [editingEvent, setEditingEvent] = useState(null);

  const handleEventClick = (event) => {
    setEditingEvent(event);
  };

  const handleSlotClick = (startTime) => {
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // Default 1 hour
    setEditingEvent({ startTime, endTime });
  };

  const handleSaveEvent = async (eventData) => {
    if (editingEvent?.id) {
      await updateEvent(editingEvent.id, eventData);
    } else {
      await addEvent(eventData);
    }
    setEditingEvent(null);
  };

  const handleDeleteEvent = async (eventId) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      await deleteEvent(eventId);
      setEditingEvent(null);
    }
  };

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-200 shadow-sm h-full flex flex-col">
      {editingEvent && (
        <EventModal
          event={editingEvent}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
          onClose={() => setEditingEvent(null)}
        />
      )}
      <div className="mb-6 flex justify-between items-center">
        <h3 className="font-bold text-gray-800 text-xl">Weekly Schedule</h3>
        <button
          onClick={() => handleSlotClick(new Date())}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 font-bold text-sm"
        >
          <Plus size={16} /> New Event
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <CalendarGrid
          events={events}
          onEventClick={handleEventClick}
          onSlotClick={handleSlotClick}
        />
      </div>
    </div>
  );
}