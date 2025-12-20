import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { CalendarDays, ChevronDown, NotebookPen } from 'lucide-react';

import { BrainCard } from '../../../components/ui/BrainCard';
import { useToast } from '../../../context/ToastContext';
import { ensureIds, toMillis } from '../meetingsUtils';

export function MinutesNotebook({ meetings = [], onSave }) {
  const { addToast } = useToast();
  const [openId, setOpenId] = useState(null);
  const [drafts, setDrafts] = useState({});

  const sorted = useMemo(
    () =>
      [...(meetings || [])].sort(
        (a, b) => toMillis(b.meetingDate || b.createdAt) - toMillis(a.meetingDate || a.createdAt)
      ),
    [meetings]
  );

  const initialDrafts = useMemo(() => {
    const map = {};
    sorted.forEach((m) => {
      if (!m?.id) return;
      map[m.id] = {
        minutesSummary: m.minutesSummary || '',
        agendaMinutes: Object.fromEntries(
          ensureIds(m.agenda || []).map((item) => [item.id, item.minutes || ''])
        ),
      };
    });
    return map;
  }, [sorted]);

  const updateDraft = (meetingId, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [meetingId]: { ...(prev[meetingId] || {}), [field]: value },
    }));
  };

  const updateAgendaDraft = (meetingId, itemId, value) => {
    setDrafts((prev) => {
      const draft = prev[meetingId] || { agendaMinutes: {} };
      return {
        ...prev,
        [meetingId]: {
          ...draft,
          agendaMinutes: { ...(draft.agendaMinutes || {}), [itemId]: value },
        },
      };
    });
  };

  const handleSave = async (meeting) => {
    if (!meeting?.id || !onSave) return;
    const draft = drafts[meeting.id] || {};
    const minutesSummary = draft.minutesSummary ?? meeting.minutesSummary ?? '';
    const agenda = ensureIds(meeting.agenda || []).map((item) => ({
      ...item,
      minutes: draft.agendaMinutes?.[item.id] ?? item.minutes ?? '',
    }));
    try {
      await onSave(meeting.id, { minutesSummary, agenda });
      addToast('success', 'Minutes saved.');
    } catch (err) {
      console.error(err);
      addToast('error', 'Could not save minutes.');
    }
  };

  if (!sorted.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
        <NotebookPen size={14} /> Minutes Notebook
      </div>
      {sorted.map((meeting) => {
        const draft = drafts[meeting.id] || initialDrafts[meeting.id] || { agendaMinutes: {} };
        const agenda = ensureIds(meeting.agenda || []);
        const isOpen = openId === meeting.id;
        return (
          <BrainCard key={meeting.id} className="p-4">
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : meeting.id)}
              className="w-full flex items-center justify-between text-left"
            >
              <div>
                <div className="text-sm font-bold text-slate-900">{meeting.title}</div>
                <div className="text-[11px] text-slate-500 flex items-center gap-2">
                  <CalendarDays size={12} /> {meeting.meetingDate || 'No date'}
                </div>
              </div>
              <ChevronDown
                size={16}
                className={clsx('text-slate-500 transition-transform', isOpen ? 'rotate-180' : '')}
              />
            </button>
            {isOpen && (
              <div className="mt-4 space-y-4">
                <textarea
                  value={draft.minutesSummary ?? meeting.minutesSummary ?? ''}
                  onChange={(e) => updateDraft(meeting.id, 'minutesSummary', e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:ring-1 focus:ring-emerald-500 min-h-[140px]"
                  placeholder="Minutes summary for this meeting"
                />
                <div className="space-y-3">
                  {agenda.map((item) => (
                    <div key={item.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50">
                      <div className="text-sm font-semibold text-slate-800">{item.title || 'Agenda item'}</div>
                      <textarea
                        value={draft.agendaMinutes?.[item.id] ?? item.minutes ?? ''}
                        onChange={(e) => updateAgendaDraft(meeting.id, item.id, e.target.value)}
                        className="w-full mt-2 p-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 min-h-[120px]"
                        placeholder="Minutes for this agenda line"
                      />
                    </div>
                  ))}
                  {agenda.length === 0 && (
                    <div className="text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg p-3">
                      No agenda items captured for this meeting.
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleSave(meeting)}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700"
                  >
                    Save minutes
                  </button>
                </div>
              </div>
            )}
          </BrainCard>
        );
      })}
    </div>
  );
}
