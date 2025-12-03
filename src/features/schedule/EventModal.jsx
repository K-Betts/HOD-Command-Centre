import React, { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { format, parse } from 'date-fns';

const eventTypes = [
  { id: 'class', label: 'Class', color: 'bg-blue-500' },
  { id: 'meeting', label: 'Meeting', color: 'bg-purple-500' },
  { id: 'duty', label: 'Duty', color: 'bg-amber-500' },
  { id: 'eca', label: 'ECA', color: 'bg-pink-500' },
  { id: 'break', label: 'Break', color: 'bg-gray-400' },
  { id: 'other', label: 'Other', color: 'bg-teal-500' },
];

export function EventModal({ event, onSave, onDelete, onClose }) {
  const [formData, setFormData] = useState({
    title: '',
    type: 'class',
    startTime: new Date(),
    endTime: new Date(new Date().getTime() + 60 * 60 * 1000),
    classCode: '',
    room: '',
    notes: '',
  });

  useEffect(() => {
    if (event) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- keep form in sync when a different event is passed in
      setFormData({
        title: event.title || '',
        type: event.type || 'class',
        startTime: event.startTime || new Date(),
        endTime: event.endTime || new Date(new Date().getTime() + 60 * 60 * 1000),
        classCode: event.classCode || '',
        room: event.room || '',
        notes: event.notes || '',
      });
    }
  }, [event]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTimeChange = (e) => {
    const { name, value } = e.target;
    const newDate = parse(value, 'HH:mm', formData[name]);
    setFormData((prev) => ({ ...prev, [name]: newDate }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div
      className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800">
              {event?.id ? 'Edit Event' : 'Create Event'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Title</label>
              <input name="title" value={formData.title} onChange={handleChange} required className="w-full p-3 mt-1 border border-gray-200 rounded-xl" />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Type</label>
              <select name="type" value={formData.type} onChange={handleChange} className="w-full p-3 mt-1 border border-gray-200 rounded-xl bg-white">
                {eventTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Start Time</label>
                <input type="time" name="startTime" value={format(formData.startTime, 'HH:mm')} onChange={handleTimeChange} required className="w-full p-3 mt-1 border border-gray-200 rounded-xl" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">End Time</label>
                <input type="time" name="endTime" value={format(formData.endTime, 'HH:mm')} onChange={handleTimeChange} required className="w-full p-3 mt-1 border border-gray-200 rounded-xl" />
              </div>
            </div>

            {formData.type === 'class' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Class Code</label>
                  <input name="classCode" value={formData.classCode} onChange={handleChange} className="w-full p-3 mt-1 border border-gray-200 rounded-xl" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Room</label>
                  <input name="room" value={formData.room} onChange={handleChange} className="w-full p-3 mt-1 border border-gray-200 rounded-xl" />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Notes</label>
              <textarea name="notes" value={formData.notes} onChange={handleChange} rows="3" className="w-full p-3 mt-1 border border-gray-200 rounded-xl resize-none" />
            </div>
          </div>

          <div className="flex justify-between items-center mt-8">
            <div>
              {event?.id && (
                <button
                  type="button"
                  onClick={() => onDelete(event.id)}
                  className="flex items-center gap-2 px-5 py-2.5 text-red-500 hover:bg-red-50 rounded-xl font-medium"
                >
                  <Trash2 size={16} /> Delete
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-gray-500 hover:bg-gray-100 rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-200"
              >
                Save Event
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
