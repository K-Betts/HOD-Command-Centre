import React, { useRef } from 'react';
import { NotebookPen, Plus } from 'lucide-react';

import { BrainCard } from '../../../components/ui/BrainCard';
import { safeId } from '../meetingsUtils';

export function MeetingAgendaBuilder({ staff, form, onChange, onSubmit }) {
  const attendeeInputRef = useRef(null);
  const addAttendee = (name) => {
    if (!name) return;
    onChange((prev) => ({
      ...prev,
      attendees: Array.from(new Set([...(prev.attendees || []), name])),
    }));
    if (attendeeInputRef.current) attendeeInputRef.current.value = '';
  };

  const updateAgendaItem = (id, field, value) => {
    onChange((prev) => ({
      ...prev,
      agenda: (prev.agenda || []).map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
  };

  const addAgendaRow = () => {
    onChange((prev) => ({
      ...prev,
      agenda: [...(prev.agenda || []), { id: safeId(), title: '', owner: '', duration: '5 min', minutes: '' }],
    }));
  };

  const removeAgendaRow = (id) => {
    onChange((prev) => ({
      ...prev,
      agenda: (prev.agenda || []).filter((item) => item.id !== id),
    }));
  };

  return (
    <BrainCard className="p-6 shadow-md shadow-emerald-100/60 border-emerald-50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <NotebookPen size={18} className="text-emerald-600" />
          <h3 className="text-lg font-bold text-slate-900">Create Meeting Agenda</h3>
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
          New
        </span>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Title</label>
            <input
              value={form.title}
              onChange={(e) => onChange((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white"
              placeholder="Department meeting focus"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Date</label>
              <input
                type="date"
                value={form.meetingDate}
                onChange={(e) => onChange((prev) => ({ ...prev, meetingDate: e.target.value }))}
                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Time</label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => onChange((prev) => ({ ...prev, startTime: e.target.value }))}
                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white"
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Location</label>
            <input
              value={form.location}
              onChange={(e) => onChange((prev) => ({ ...prev, location: e.target.value }))}
              className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white"
              placeholder="Dept office / online"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Attendees</label>
            <div className="flex items-center gap-2">
              <input
                ref={attendeeInputRef}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addAttendee(e.currentTarget.value.trim());
                  }
                }}
                className="flex-1 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white"
                placeholder="Type a name + Enter"
              />
              <select
                onChange={(e) => {
                  addAttendee(e.target.value);
                  e.target.value = '';
                }}
                className="p-3 border border-slate-200 rounded-xl bg-white text-sm"
                defaultValue=""
              >
                <option value="" disabled>
                  Add staff
                </option>
                {staff.map((member) => (
                  <option key={member.id} value={member.name}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {(form.attendees || []).map((name) => (
                <span
                  key={name}
                  className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-semibold"
                >
                  {name}
                </span>
              ))}
              {(form.attendees || []).length === 0 && (
                <span className="text-xs text-slate-400">No attendees added yet.</span>
              )}
            </div>
          </div>
        </div>

        {/* Agenda with notes per item */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-500 uppercase">Agenda</label>
            <button
              type="button"
              onClick={addAgendaRow}
              className="flex items-center gap-1 text-xs font-bold text-emerald-700"
            >
              <Plus size={14} /> Add item
            </button>
          </div>
          <div className="space-y-2">
            {(form.agenda || []).map((item) => (
              <div key={item.id} className="bg-white border border-slate-100 rounded-xl p-3 space-y-2">
                <div className="grid grid-cols-[1.2fr,0.7fr,0.5fr,auto] gap-2 items-center">
                  <input
                    value={item.title}
                    onChange={(e) => updateAgendaItem(item.id, 'title', e.target.value)}
                    className="p-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500"
                    placeholder="Agenda item"
                  />
                  <input
                    value={item.owner}
                    onChange={(e) => updateAgendaItem(item.id, 'owner', e.target.value)}
                    className="p-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500"
                    placeholder="Owner"
                  />
                  <input
                    value={item.duration}
                    onChange={(e) => updateAgendaItem(item.id, 'duration', e.target.value)}
                    className="p-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500"
                    placeholder="10 min"
                  />
                  <button
                    type="button"
                    onClick={() => removeAgendaRow(item.id)}
                    className="text-slate-400 hover:text-rose-500 p-1"
                  >
                    x
                  </button>
                </div>

                {/* Notes field stored in item.minutes */}
                <textarea
                  value={item.minutes || ''}
                  onChange={(e) => updateAgendaItem(item.id, 'minutes', e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs md:text-sm focus:ring-1 focus:ring-emerald-500 min-h-[60px]"
                  placeholder="Notes for this agenda item (discussion points, key questions, etc.)"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-5 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all"
          >
            Save Agenda
          </button>
        </div>
      </form>
    </BrainCard>
  );
}
