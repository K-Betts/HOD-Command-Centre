import React from 'react';
import clsx from 'clsx';
import { CalendarDays, ChevronDown, ClipboardList } from 'lucide-react';

import { BrainCard } from '../../../components/ui/BrainCard';
import { hasMinutes } from '../meetingsUtils';
import { Badge } from './MeetingsBadges';

export function MeetingAccordion({ weeks = [], selectedId, onSelect, loading, renderDetail }) {
  if (loading) {
    return (
      <BrainCard className="p-6">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <ClipboardList size={16} />
          Loading meetings...
        </div>
      </BrainCard>
    );
  }

  if (!weeks.length) {
    return (
      <BrainCard className="p-6">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <ClipboardList size={16} />
          Create an agenda to start logging minutes.
        </div>
      </BrainCard>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {weeks.map((week) => (
        <BrainCard key={week.key} className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                <CalendarDays size={16} />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">{week.label}</div>
                <div className="text-[11px] text-slate-500">{week.rangeLabel}</div>
              </div>
            </div>
            <Badge tone="slate">
              {week.meetings.length} meeting{week.meetings.length === 1 ? '' : 's'}
            </Badge>
          </div>
          <div className="flex flex-col gap-2">
            {week.meetings.map((meeting) => {
              const isSelected = selectedId === meeting.id;
              const hasNotes = hasMinutes(meeting);
              const attachments = meeting.attachments?.length || 0;
              const detail = isSelected && renderDetail ? renderDetail(meeting) : null;
              return (
                <div
                  key={meeting.id}
                  className={clsx(
                    'rounded-xl border bg-white transition-all',
                    isSelected ? 'border-slate-900 shadow-lg shadow-slate-200/60' : 'border-slate-200'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(isSelected ? null : meeting.id)}
                    className="w-full flex items-start justify-between gap-2 p-3 text-left"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-sm text-slate-900">{meeting.title}</div>
                        {meeting.type === 'archive' && <Badge tone="slate">Archive</Badge>}
                      </div>
                      <div className="text-xs flex items-center gap-2 text-slate-500">
                        <CalendarDays size={14} />
                        <span>{meeting.meetingDate || 'No date'}</span>
                        {meeting.startTime && <span>• {meeting.startTime}</span>}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {(meeting.attendees || []).slice(0, 3).join(', ') || 'Attendees TBD'}
                        {meeting.attendees?.length > 3 && ' +'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={hasNotes ? 'emerald' : 'amber'}>
                        {hasNotes ? 'Minutes' : 'Need minutes'}
                      </Badge>
                      {attachments > 0 && (
                        <Badge tone="sky">
                          {attachments} file{attachments > 1 ? 's' : ''}
                        </Badge>
                      )}
                      <ChevronDown
                        size={16}
                        className={clsx(
                          'text-slate-500 transition-transform',
                          isSelected ? 'rotate-180' : ''
                        )}
                      />
                    </div>
                  </button>
                  {isSelected && detail && (
                    <div className="border-t border-slate-100 bg-slate-50 rounded-b-xl p-3">{detail}</div>
                  )}
                </div>
              );
            })}
          </div>
        </BrainCard>
      ))}
    </div>
  );
}
