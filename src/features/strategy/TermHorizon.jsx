import React, { useMemo } from 'react';
import {
  differenceInCalendarDays,
  differenceInCalendarWeeks,
  format,
  isWithinInterval,
} from 'date-fns';
import { CalendarRange, GraduationCap, Users, Sparkles, MapPin } from 'lucide-react';
import { useAcademicYear } from '../../context/AcademicYearContext';
import { BrainCard } from '../../components/ui/BrainCard';
import { useSchoolCalendarEvents } from '../../hooks/useSchoolCalendarEvents';
import { normalizeCalendarCategory } from '../../utils/calendarEvents';

const categoryMeta = {
  'Academic Logistics': {
    label: 'Academic Logistics',
    icon: CalendarRange,
    dot: 'bg-indigo-500',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  'CPD & QA': {
    label: 'CPD & QA',
    icon: GraduationCap,
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  Parents: {
    label: 'Parents',
    icon: Users,
    dot: 'bg-rose-500',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  'Enrichment/Trips': {
    label: 'Enrichment/Trips',
    icon: Sparkles,
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
};

const laneOffset = {
  'Academic Logistics': 8,
  'CPD & QA': 20,
  Parents: 32,
  'Enrichment/Trips': 44,
};

function safeDate(value) {
  if (!value) return null;
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getCurrentTerm(terms = [], today = new Date()) {
  if (!terms.length) return null;
  const sorted = [...terms].filter((t) => t.start).sort((a, b) => a.start - b.start);
  const current = sorted.find((term) => {
    if (!term.start || !term.end) return false;
    return today >= term.start && today <= term.end;
  });
  if (current) return current;
  return sorted.find((t) => t.start && today <= t.start) || sorted[sorted.length - 1];
}

function computeWeeks(term, today = new Date()) {
  if (!term?.start || !term?.end) return { total: 0, currentWeek: 0, progress: 0 };
  const total = Math.max(1, differenceInCalendarWeeks(term.end, term.start) + 1);
  const currentWeek = Math.min(
    total,
    Math.max(1, differenceInCalendarWeeks(today, term.start) + 1)
  );
  const progress = Math.min(100, Math.max(0, (currentWeek / total) * 100));
  return { total, currentWeek, progress };
}

export function TermHorizon({ user }) {
  const { terms, loading } = useAcademicYear();
  const { events } = useSchoolCalendarEvents(user);
  const today = useMemo(() => new Date(), []);

  const currentTerm = useMemo(() => getCurrentTerm(terms, today), [terms, today]);
  const { total, currentWeek, progress } = useMemo(
    () => computeWeeks(currentTerm, today),
    [currentTerm, today]
  );

  const termEvents = useMemo(() => {
    if (!currentTerm?.start || !currentTerm?.end) return [];
    const span = Math.max(1, differenceInCalendarDays(currentTerm.end, currentTerm.start));
    return (events || [])
      .map((evt) => {
        const date = evt.dateObj || safeDate(evt.date);
        if (!date) return null;
        if (!isWithinInterval(date, { start: currentTerm.start, end: currentTerm.end })) {
          return null;
        }
        const offset = Math.max(
          0,
          Math.min(span, differenceInCalendarDays(date, currentTerm.start))
        );
        const category = normalizeCalendarCategory(evt.category);
        const meta = categoryMeta[category] || categoryMeta['Academic Logistics'];
        return {
          ...evt,
          category,
          dateObj: date,
          position: (offset / span) * 100,
          meta,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.dateObj - b.dateObj);
  }, [events, currentTerm]);

  const todayMarker = useMemo(() => {
    if (!currentTerm?.start || !currentTerm?.end) return null;
    if (!isWithinInterval(today, { start: currentTerm.start, end: currentTerm.end })) return null;
    const span = Math.max(1, differenceInCalendarDays(currentTerm.end, currentTerm.start));
    const offset = Math.max(
      0,
      Math.min(span, differenceInCalendarDays(today, currentTerm.start))
    );
    return (offset / span) * 100;
  }, [currentTerm, today]);

  return (
    <BrainCard className="p-4 max-h-[150px] h-[150px] overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-indigo-600">
            Half-Term Horizon
          </div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-slate-900 leading-none">
              {currentTerm?.name || 'Set term dates'}
            </h3>
            <span className="text-xs text-slate-500">
              {loading
                ? 'Loading…'
                : currentTerm?.start && currentTerm?.end
                ? `${format(currentTerm.start, 'd MMM')} - ${format(currentTerm.end, 'd MMM')}`
                : 'No boundaries yet'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            {termEvents.length} events mapped this half-term • Today {format(today, 'd MMM')}
          </p>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-slate-500 uppercase font-bold">Week</div>
          <div className="text-2xl font-extrabold text-slate-900 leading-none">
            {currentWeek || '—'}
          </div>
          <div className="text-[11px] text-slate-500">
            of {total || '—'} • {Math.round(progress)}%
          </div>
        </div>
      </div>

      <div className="relative mt-2 h-[68px]">
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        {todayMarker !== null && (
          <div
            className="absolute top-[6px] bottom-2 w-[2px] bg-slate-900/30"
            style={{ left: `${todayMarker}%` }}
          >
            <div className="absolute -top-1.5 -left-1 w-2 h-2 rounded-full bg-slate-900" />
          </div>
        )}
        {termEvents.map((evt) => {
          const Icon = evt.meta.icon;
          return (
            <div
              key={evt.id || `${evt.title}-${evt.date}`}
              className="absolute flex flex-col items-center"
              style={{
                left: `calc(${evt.position}% - 6px)`,
                top: `${laneOffset[evt.category] || 8}px`,
              }}
              title={`${evt.title || 'Event'} • ${format(evt.dateObj, 'd MMM')}`}
            >
              <span
                className={`w-3 h-3 rounded-full border-2 border-white shadow ${evt.meta.dot}`}
              />
              <Icon className="w-3.5 h-3.5 text-slate-600 mt-1" />
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 text-[11px] text-slate-600 mt-2">
        {Object.values(categoryMeta).map((meta) => (
          <span
            key={meta.label}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border ${meta.badge}`}
          >
            <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
        ))}
        {todayMarker !== null && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            <MapPin className="w-3 h-3" /> Today
          </span>
        )}
      </div>
    </BrainCard>
  );
}
