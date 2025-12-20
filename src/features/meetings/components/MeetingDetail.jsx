import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  Clock3,
  Download,
  MapPin,
  NotebookPen,
  Plus,
  Users,
} from 'lucide-react';

import { BrainCard } from '../../../components/ui/BrainCard';
import { useToast } from '../../../context/ToastContext';
import { focusOptions, focusToInteractionType, safeId } from '../meetingsUtils';
import { Badge } from './MeetingsBadges';

export function MeetingDetail({
  staff,
  meeting,
  onChange,
  onSave,
  onExport,
  logInteraction,
  saving,
  exporting,
}) {
  const [staffNoteDraft, setStaffNoteDraft] = useState({
    staffId: '',
    staffName: '',
    focus: 'Wellbeing',
    note: '',
  });
  const { addToast } = useToast();
  const minutesSummaryRef = useRef(null);

  const autoGrow = (element) => {
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.max(element.scrollHeight, 180)}px`;
  };

  useEffect(() => {
    autoGrow(minutesSummaryRef.current);
  }, [meeting?.id, meeting?.minutesSummary]);

  if (!meeting) {
    return (
      <BrainCard className="p-6 h-full flex items-center justify-center border-dashed border-2 border-slate-200">
        <div className="text-center space-y-2">
          <h3 className="font-bold text-slate-800">Select or create a meeting</h3>
          <p className="text-sm text-slate-500">
            Agendas, minutes, and wellbeing notes will appear here for the selected meeting.
          </p>
        </div>
      </BrainCard>
    );
  }

  const updateField = (field, value) => onChange((prev) => ({ ...prev, [field]: value }));
  const updateAgendaItem = (id, field, value) => {
    onChange((prev) => ({
      ...prev,
      agenda: (prev.agenda || []).map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
  };
  const addAgendaItem = () =>
    onChange((prev) => ({
      ...prev,
      agenda: [...(prev.agenda || []), { id: safeId(), title: '', owner: '', duration: '', minutes: '' }],
    }));
  const updateAction = (id, field, value) =>
    onChange((prev) => ({
      ...prev,
      actions: (prev.actions || []).map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
  const addAction = () =>
    onChange((prev) => ({
      ...prev,
      actions: [...(prev.actions || []), { id: safeId(), task: '', owner: '', dueDate: '', status: 'open' }],
    }));
  const toggleActionStatus = (id) =>
    onChange((prev) => ({
      ...prev,
      actions: (prev.actions || []).map((item) =>
        item.id === id ? { ...item, status: item.status === 'done' ? 'open' : 'done' } : item
      ),
    }));

  const addStaffNote = async () => {
    if (!staffNoteDraft.note || !staffNoteDraft.staffName) return;
    onChange((prev) => ({
      ...prev,
      staffNotes: [...(prev.staffNotes || []), { ...staffNoteDraft, id: safeId() }],
    }));
    setStaffNoteDraft({ staffId: '', staffName: '', focus: 'Wellbeing', note: '' });

    if (logInteraction && staffNoteDraft.staffId) {
      try {
        await logInteraction(staffNoteDraft.staffId, {
          date: meeting.meetingDate || new Date().toISOString().slice(0, 10),
          type: 'Meeting',
          summary: staffNoteDraft.note,
          source: 'meeting-minutes',
          buckTag: staffNoteDraft.focus.toLowerCase(),
          interactionType: focusToInteractionType(staffNoteDraft.focus),
          staffName: staffNoteDraft.staffName,
        });
        addToast('success', 'Staff log updated.');
      } catch (err) {
        console.error(err);
        addToast('error', 'Saved note but could not sync to staff log.');
      }
    }
  };

  const actionButtons = (
    <div className="flex flex-wrap gap-2 justify-end relative z-10">
      <button
        onClick={onExport}
        className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-slate-800"
        disabled={exporting}
      >
        <Download size={16} /> {exporting ? 'Exporting...' : 'Export minutes'}
      </button>
      <button
        onClick={onSave}
        className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-emerald-700"
        disabled={saving}
      >
        <CheckCircle2 size={16} /> {saving ? 'Saving...' : 'Save updates'}
      </button>
    </div>
  );

  return (
    <BrainCard className="relative p-0 shadow-lg shadow-slate-200/50 min-w-0 w-full overflow-visible">
      <div className="flex flex-col gap-6 md:gap-8 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <CalendarDays size={14} /> <span>{meeting.meetingDate || 'Date TBD'}</span>
              {meeting.startTime && (
                <>
                  <span className="text-slate-300">•</span>
                  <Clock3 size={14} /> <span>{meeting.startTime}</span>
                </>
              )}
              {meeting.location && (
                <>
                  <span className="text-slate-300">•</span>
                  <MapPin size={14} /> <span>{meeting.location}</span>
                </>
              )}
            </div>
            <input
              value={meeting.title || ''}
              onChange={(e) => updateField('title', e.target.value)}
              className="text-2xl md:text-3xl font-bold text-slate-900 w-full bg-transparent border-b border-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
          {actionButtons}
        </div>

        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Attendees</div>
          <div className="flex flex-wrap items-center gap-3">
            {(meeting.attendees || []).map((name) => (
              <div
                key={name}
                className="flex items-center gap-2 px-3 py-2 rounded-full bg-slate-50 border border-slate-200"
              >
                <span className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center">
                  {name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <span className="text-sm font-semibold text-slate-700">{name}</span>
              </div>
            ))}
            {(meeting.attendees || []).length === 0 && (
              <span className="text-xs text-slate-400">No attendees logged.</span>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <ClipboardList size={16} /> Agenda + Minutes
            </h4>
            <button
              type="button"
              onClick={addAgendaItem}
              className="text-xs font-bold text-emerald-700 flex items-center gap-1"
            >
              <Plus size={14} /> Add item
            </button>
          </div>
          <div className="space-y-3">
            {(meeting.agenda || []).map((item) => (
              <div key={item.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr,0.6fr,0.4fr] gap-2">
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
                    placeholder="Duration"
                  />
                </div>
                <textarea
                  value={item.minutes || ''}
                  onChange={(e) => updateAgendaItem(item.id, 'minutes', e.target.value)}
                  onInput={(e) => autoGrow(e.target)}
                  className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 min-h-[140px]"
                  placeholder="Capture discussion / decisions for this agenda line"
                />
              </div>
            ))}
            {(meeting.agenda || []).length === 0 && (
              <div className="text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg p-3">
                No agenda items added for this meeting.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <NotebookPen size={16} /> Minutes summary
          </div>
          <textarea
            value={meeting.minutesSummary || ''}
            ref={minutesSummaryRef}
            onChange={(e) => updateField('minutesSummary', e.target.value)}
            onInput={(e) => autoGrow(e.target)}
            className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:ring-1 focus:ring-emerald-500 min-h-[200px] resize-vertical"
            placeholder="Key decisions, risks, and headlines"
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <AlertTriangle size={14} className="text-amber-500" /> Actions / follow ups
            </div>
            <div className="space-y-2">
              {(meeting.actions || []).map((action) => (
                <div
                  key={action.id}
                  className="bg-white border border-slate-100 rounded-lg p-2 grid grid-cols-1 sm:grid-cols-[1fr,0.7fr,0.5fr,auto] gap-2 items-center"
                >
                  <input
                    value={action.task || ''}
                    onChange={(e) => updateAction(action.id, 'task', e.target.value)}
                    className="p-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500"
                    placeholder="Action"
                  />
                  <input
                    value={action.owner || ''}
                    onChange={(e) => updateAction(action.id, 'owner', e.target.value)}
                    className="p-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500"
                    placeholder="Owner"
                  />
                  <input
                    type="date"
                    value={action.dueDate || ''}
                    onChange={(e) => updateAction(action.id, 'dueDate', e.target.value)}
                    className="p-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => toggleActionStatus(action.id)}
                    className={clsx(
                      'px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 justify-center',
                      action.status === 'done'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-white border border-slate-200 text-slate-600'
                    )}
                  >
                    <CheckSquare size={14} />
                    {action.status === 'done' ? 'Done' : 'Open'}
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addAction}
                className="w-full py-2 border border-dashed border-emerald-300 text-emerald-700 rounded-lg text-sm font-semibold hover:bg-emerald-50"
              >
                Add follow-up
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Users size={16} /> Staff / Wellbeing notes
              </h4>
              <button
                type="button"
                onClick={addStaffNote}
                className="text-xs font-bold text-emerald-700 flex items-center gap-1"
              >
                <Plus size={14} /> Add note
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[0.9fr,0.5fr,1.1fr,auto] gap-2 items-center">
              <select
                value={staffNoteDraft.staffId}
                onChange={(e) => {
                  const member = staff.find((s) => s.id === e.target.value);
                  setStaffNoteDraft((prev) => ({
                    ...prev,
                    staffId: e.target.value,
                    staffName: member?.name || '',
                  }));
                }}
                className="p-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                <option value="">Pick staff member</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
              <select
                value={staffNoteDraft.focus}
                onChange={(e) => setStaffNoteDraft((prev) => ({ ...prev, focus: e.target.value }))}
                className="p-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                {focusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <input
                value={staffNoteDraft.note}
                onChange={(e) => setStaffNoteDraft((prev) => ({ ...prev, note: e.target.value }))}
                className="p-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500"
                placeholder="Capture wellbeing or interaction notes"
              />
              <button
                type="button"
                onClick={addStaffNote}
                className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
              >
                Save
              </button>
            </div>
            <div className="space-y-2">
              {(meeting.staffNotes || []).map((note) => (
                <div
                  key={note.id}
                  className="border border-slate-100 rounded-lg p-3 flex items-start justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
                        {note.staffName || 'Unassigned'}
                      </span>
                      <Badge tone="amber">{note.focus}</Badge>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{note.note}</p>
                  </div>
                </div>
              ))}
              {(meeting.staffNotes || []).length === 0 && (
                <div className="text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg p-3">
                  No staff notes captured yet.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end">{actionButtons}</div>
      </div>
    </BrainCard>
  );
}
