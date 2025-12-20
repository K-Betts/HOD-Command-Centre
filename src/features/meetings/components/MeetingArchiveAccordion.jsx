import React, { useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { CalendarDays, ChevronDown, CheckCircle2, NotebookPen, Users } from 'lucide-react';

import { BrainCard } from '../../../components/ui/BrainCard';
import { useToast } from '../../../context/ToastContext';
import { ensureIds, meetingMatchesQuery, toMillis } from '../meetingsUtils';

export function MeetingArchiveAccordion({
  meetings = [],
  onUpdate,
  staff = [],
  searchQuery = '',
  onDelete,
}) {
  const { addToast } = useToast();
  const [expandedId, setExpandedId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const attendeeInputRef = useRef(null);

  const normalizedQuery = (searchQuery || '').trim().toLowerCase();

  const archivedMeetings = useMemo(
    () => {
      const base = [...(meetings || [])]
        .filter(
          (m) =>
            m.type === 'archive' ||
            m.minutesSummary ||
            (m.agenda || []).some((item) => item.minutes)
        )
        .sort((a, b) => toMillis(b.meetingDate || b.createdAt) - toMillis(a.meetingDate || a.createdAt));

      if (!normalizedQuery) return base;
      return base.filter((m) => meetingMatchesQuery(m, normalizedQuery));
    },
    [meetings, normalizedQuery]
  );

  const initializeDraft = (meeting) => {
    if (!drafts[meeting.id]) {
      setDrafts((prev) => ({
        ...prev,
        [meeting.id]: {
          title: meeting.title,
          meetingDate: meeting.meetingDate,
          startTime: meeting.startTime,
          location: meeting.location,
          attendees: [...(meeting.attendees || [])],
          minutesSummary: meeting.minutesSummary,
          agenda: ensureIds(meeting.agenda || []),
        },
      }));
    }
  };

  const updateDraft = (meetingId, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [meetingId]: { ...prev[meetingId], [field]: value },
    }));
  };

  const updateAgendaMinutes = (meetingId, itemId, value) => {
    setDrafts((prev) => {
      const draft = prev[meetingId] || {};
      const agenda = ensureIds(draft.agenda || []);
      const updatedAgenda = agenda.map((item) => (item.id === itemId ? { ...item, minutes: value } : item));
      return {
        ...prev,
        [meetingId]: {
          ...draft,
          agenda: updatedAgenda,
        },
      };
    });
  };

  const addAttendee = (meetingId, name) => {
    if (!name.trim()) return;
    setDrafts((prev) => ({
      ...prev,
      [meetingId]: {
        ...prev[meetingId],
        attendees: Array.from(new Set([...(prev[meetingId]?.attendees || []), name.trim()])),
      },
    }));
    if (attendeeInputRef.current) attendeeInputRef.current.value = '';
  };

  const removeAttendee = (meetingId, name) => {
    setDrafts((prev) => ({
      ...prev,
      [meetingId]: {
        ...prev[meetingId],
        attendees: (prev[meetingId]?.attendees || []).filter((a) => a !== name),
      },
    }));
  };

  const handleSaveChanges = async (meeting) => {
    const draft = drafts[meeting.id];
    if (!draft) return;

    try {
      const originalAgenda = ensureIds(meeting.agenda || []);
      const draftAgenda = ensureIds(draft.agenda || originalAgenda);

      const savedAgenda = originalAgenda.map((item) => {
        const match = draftAgenda.find((a) => a.id === item.id);
        return match ? { ...item, minutes: match.minutes ?? '' } : item;
      });

      await onUpdate(meeting.id, {
        ...meeting,
        title: draft.title,
        meetingDate: draft.meetingDate,
        startTime: draft.startTime,
        location: draft.location,
        attendees: draft.attendees,
        minutesSummary: draft.minutesSummary,
        agenda: savedAgenda,
      });
      setDrafts((prev) => {
        const updated = { ...prev };
        delete updated[meeting.id];
        return updated;
      });
      addToast('success', 'Meeting details saved.');
    } catch (err) {
      console.error(err);
      addToast('error', 'Failed to save changes.');
    }
  };

  const hasUnsavedChanges = (meetingId, meeting) => {
    const draft = drafts[meetingId];
    if (!draft) return false;

    const baseChanged =
      draft.title !== meeting.title ||
      draft.meetingDate !== meeting.meetingDate ||
      draft.startTime !== meeting.startTime ||
      draft.location !== meeting.location ||
      draft.minutesSummary !== (meeting.minutesSummary || '') ||
      JSON.stringify(draft.attendees) !== JSON.stringify(meeting.attendees || []);

    const originalAgenda = ensureIds(meeting.agenda || []);
    const draftAgenda = ensureIds(draft.agenda || originalAgenda);

    const agendaChanged =
      draftAgenda.length !== originalAgenda.length ||
      draftAgenda.some((item) => {
        const original = originalAgenda.find((o) => o.id === item.id) || {};
        return (item.minutes || '') !== (original.minutes || '');
      });

    return baseChanged || agendaChanged;
  };

  if (archivedMeetings.length === 0) {
    return (
      <BrainCard className="p-8 text-center border-dashed border-2 border-slate-200">
        <NotebookPen size={28} className="text-slate-300 mx-auto mb-2" />
        <h3 className="text-slate-700 font-semibold">
          {normalizedQuery ? 'No meetings match your search' : 'No meeting archive yet'}
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          {normalizedQuery
            ? 'Try a different keyword, or clear the search box to see all archived meetings.'
            : 'Create a new meeting above to start building your archive.'}
        </p>
      </BrainCard>
    );
  }

  return (
    <div className="space-y-3">
      {archivedMeetings.map((meeting) => {
        const isExpanded = expandedId === meeting.id;
        const hasChanges = hasUnsavedChanges(meeting.id, meeting);
        const draft =
          drafts[meeting.id] || {
            title: meeting.title,
            meetingDate: meeting.meetingDate,
            startTime: meeting.startTime,
            location: meeting.location,
            attendees: [...(meeting.attendees || [])],
            minutesSummary: meeting.minutesSummary || '',
            agenda: ensureIds(meeting.agenda || []),
          };

        return (
          <BrainCard key={meeting.id} className="overflow-hidden">
            <button
              type="button"
              onClick={() => {
                setExpandedId(isExpanded ? null : meeting.id);
                if (!isExpanded) initializeDraft(meeting);
              }}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900">{meeting.title || 'Untitled Meeting'}</h4>
                  {hasChanges && (
                    <span className="text-[9px] font-bold uppercase px-2 py-1 rounded-full bg-amber-50 text-amber-700">
                      Unsaved
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                  <CalendarDays size={12} />
                  <span>{meeting.meetingDate || 'No date'}</span>
                  {meeting.startTime && (
                    <>
                      <span>•</span>
                      <span>{meeting.startTime}</span>
                    </>
                  )}
                  {(meeting.attendees || []).length > 0 && (
                    <>
                      <span>•</span>
                      <Users size={12} />
                      <span>
                        {meeting.attendees.length} attendee{meeting.attendees.length !== 1 ? 's' : ''}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <ChevronDown
                size={18}
                className={clsx(
                  'text-slate-400 transition-transform flex-shrink-0',
                  isExpanded ? 'rotate-180' : ''
                )}
              />
            </button>

            {isExpanded && (
              <div className="border-t border-slate-100 p-4 space-y-4 bg-slate-50">
                {/* Meeting Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-white rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                      Meeting Title
                    </label>
                    <input
                      type="text"
                      value={draft.title || ''}
                      onChange={(e) => updateDraft(meeting.id, 'title', e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="Meeting title"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Date</label>
                    <input
                      type="date"
                      value={draft.meetingDate || ''}
                      onChange={(e) => updateDraft(meeting.id, 'meetingDate', e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={draft.startTime || ''}
                      onChange={(e) => updateDraft(meeting.id, 'startTime', e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      value={draft.location || ''}
                      onChange={(e) => updateDraft(meeting.id, 'location', e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="Meeting location"
                    />
                  </div>
                </div>

                {/* Attendees */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Attendees</label>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      ref={attendeeInputRef}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addAttendee(meeting.id, e.currentTarget.value);
                        }
                      }}
                      className="flex-1 p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="Type name + Enter"
                    />
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          addAttendee(meeting.id, e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="p-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500"
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
                  <div className="flex flex-wrap gap-2">
                    {(draft.attendees || []).map((name) => (
                      <div
                        key={name}
                        className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200"
                      >
                        <span className="text-sm text-emerald-900 font-semibold">{name}</span>
                        <button
                          type="button"
                          onClick={() => removeAttendee(meeting.id, name)}
                          className="text-emerald-600 hover:text-emerald-700 flex-shrink-0"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {(draft.attendees || []).length === 0 && (
                      <span className="text-xs text-slate-400">No attendees yet</span>
                    )}
                  </div>
                </div>

                {/* Minutes Text Area */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Meeting Minutes</label>
                  <textarea
                    value={draft.minutesSummary ?? ''}
                    onChange={(e) => updateDraft(meeting.id, 'minutesSummary', e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent whitespace-pre-wrap min-h-[160px] resize-none"
                    placeholder="Add or edit meeting minutes..."
                  />
                </div>

                {/* Agenda Items */}
                {(draft.agenda || []).length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Agenda Items</label>
                    <div className="space-y-2">
                      {(draft.agenda || []).map((item) => (
                        <div key={item.id} className="p-3 rounded-lg bg-white border border-slate-200 space-y-2">
                          <div className="text-sm font-semibold text-slate-800">
                            {item.title || 'Agenda item'}
                          </div>
                          {item.owner && (
                            <div className="text-[11px] text-slate-500">Owner: {item.owner}</div>
                          )}
                          {/* Editable notes for each agenda item */}
                          <textarea
                            value={item.minutes || ''}
                            onChange={(e) => updateAgendaMinutes(meeting.id, item.id, e.target.value)}
                            className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 min-h-[80px]"
                            placeholder="Notes / minutes for this agenda item..."
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Items */}
                {(meeting.actions || []).length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Actions</label>
                    <div className="space-y-2">
                      {(meeting.actions || []).map((action) => (
                        <div
                          key={action.id}
                          className="flex items-start gap-2 p-3 rounded-lg bg-white border border-slate-200"
                        >
                          <div
                            className={clsx(
                              'mt-1 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center text-xs',
                              action.status === 'done'
                                ? 'bg-emerald-100 border-emerald-500 text-emerald-600'
                                : 'bg-slate-50 border-slate-300 text-slate-400'
                            )}
                          >
                            {action.status === 'done' && '✓'}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-slate-800">
                              {action.task || 'Action'}
                            </div>
                            {action.owner && (
                              <div className="text-[11px] text-slate-500">Assignee: {action.owner}</div>
                            )}
                            {action.dueDate && (
                              <div className="text-[11px] text-slate-500">Due: {action.dueDate}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Delete / Save Buttons */}
                <div className="flex justify-between items-center">
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(meeting)}
                      className="px-3 py-2 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl hover:bg-rose-100"
                    >
                      Delete meeting
                    </button>
                  )}
                  {hasChanges && (
                    <button
                      type="button"
                      onClick={() => handleSaveChanges(meeting)}
                      className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 flex items-center gap-2"
                    >
                      <CheckCircle2 size={16} /> Save All Changes
                    </button>
                  )}
                </div>
              </div>
            )}
          </BrainCard>
        );
      })}
    </div>
  );
}
