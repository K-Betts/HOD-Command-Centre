import React, { useState } from 'react';
import { parseCSV } from '../../utils/csvParser';
import { useToast } from '../../context/ToastContext';
import ICSPreviewModal from '../../components/ui/ICSPreviewModal';
import { Plus } from 'lucide-react';
import { useStaffScheduleEvents } from '../../hooks/useStaffScheduleEvents';
import { CalendarGrid } from '../schedule/CalendarGrid';
import { EventModal } from '../schedule/EventModal';

export function StaffScheduleView({ user, staffId }) {
  const { events, addEvent, updateEvent, deleteEvent } = useStaffScheduleEvents(user, staffId);
  const { addToast } = useToast();

  const [previewEvents, setPreviewEvents] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(false);
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
      {/* CSV Upload */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="block font-medium">Upload weekly timetable (CSV):</label>
          <button
            onClick={() => {
              const template = `Day,StartTime,EndTime,Title,Description,Location
Monday,09:00,10:00,Maths,Year 11 Maths,Room B12
Monday,10:00,11:00,English,GCSE English,Room A3
Tuesday,09:00,10:00,Biology,GCSE Biology,Lab 1
Wednesday,13:00,14:00,PE,Year 10 PE,Gym
Thursday,14:00,15:00,Chemistry,Year 9 Chemistry,Lab 2
Friday,10:00,11:00,History,GCSE History,Room C5`;
              const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = 'timetable_template.csv';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            }}
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 underline"
          >
            Download template
          </button>
        </div>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const text = await file.text();
            try {
              const parsed = parseCSV(text);
              if (!parsed.length) {
                addToast('error', 'No events found in the CSV file.');
                e.target.value = null;
                return;
              }
              setPreviewEvents(parsed);
              setPreviewOpen(true);
              e.target.value = null;
            } catch (err) {
              addToast('error', `Failed to parse CSV: ${err.message}`);
            }
          }}
          className="border rounded px-3 py-2 w-full max-w-xs"
        />
        <ICSPreviewModal
          isOpen={previewOpen}
          events={previewEvents}
          onClose={() => setPreviewOpen(false)}
          onConfirm={async () => {
            let imported = 0;
            let skipped = 0;
            for (const evt of previewEvents) {
              try {
                // dedupe by uid: check if uid already exists in existing events
                const exists = (events || []).some((ex) => ex.uid && evt.uid && ex.uid === evt.uid);
                if (exists) {
                  skipped += 1;
                  continue;
                }
                await addEvent(evt);
                imported += 1;
              } catch {
                // ignore per-event errors
              }
            }
            setPreviewOpen(false);
            setPreviewEvents([]);
            if (imported > 0) addToast('success', `${imported} event(s) imported.`);
            if (skipped > 0) addToast('success', `${skipped} duplicate event(s) skipped.`);
          }}
        />
      </div>
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