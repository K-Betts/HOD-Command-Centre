import React, { useMemo, useState } from 'react';
import { differenceInMinutes, format, isSameDay } from 'date-fns';
import { Brain, Compass, CalendarDays, ShieldCheck, Mountain, Timer, Flame, ToggleLeft, Clock3 } from 'lucide-react';
import { useTasks } from '../../hooks/useTasks';
import { useStaff } from '../../hooks/useStaff';
import { useWellbeing } from '../../hooks/useWellbeing';
import { getEffectivePriority } from '../tasks/TaskBoard';
import { formatFriendlyDate } from '../../utils/formatters';
import { useBuckBalance } from '../../hooks/useBuckBalance';
import { applyContextTags } from '../../utils/taskContext';
import { StrategicHeatmap } from '../strategy/StrategicHeatmap';
import { useScheduleEvents } from '../../hooks/useScheduleEvents';
import { WellbeingTrend } from '../wellbeing/WellbeingTrend';
import { SmartContextWidget } from '../tasks/SmartContextWidget';

export function DashboardView({ user, setActiveTab }) {
  const { tasks } = useTasks(user);
  const { staff } = useStaff(user);
  const { wellbeingLogs } = useWellbeing(user);
  const { riskFlags } = useBuckBalance(user, staff);
  const [smartPlanTime, setSmartPlanTime] = useState(null);
  const [smartPlanEnergy, setSmartPlanEnergy] = useState(null);
  const [showSmartPlan, setShowSmartPlan] = useState(false);

  const [dashboardMode, setDashboardMode] = useState('ADMIN');

  const weeklyPinned = useMemo(
    () => tasks.map((t) => applyContextTags(t)).filter((t) => t.isWeeklyWin),
    [tasks]
  );
  const weeklyWins = useMemo(() => {
    const sorted = [...weeklyPinned].sort((a, b) => {
      const priDiff =
        priorityWeight(getEffectivePriority(b)) - priorityWeight(getEffectivePriority(a));
      if (priDiff !== 0) return priDiff;
      const dueA = a.dueDate || '9999-99-99';
      const dueB = b.dueDate || '9999-99-99';
      return dueA.localeCompare(dueB);
    });
    return sorted.slice(0, 5);
  }, [weeklyPinned]);
  const urgentTasks = useMemo(() => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 2);
    return tasks
      .map((t) => applyContextTags(t))
      .filter((t) => {
        if (t.status === 'done' || t.archivedAt) return false;
        const highPriority = (t.priority || '').toLowerCase() === 'high';
        const dueSoon = t.dueDate ? new Date(t.dueDate) <= soon : false;
        return highPriority || dueSoon;
      })
      .sort((a, b) => {
        const priDiff =
          priorityWeight(getEffectivePriority(b)) - priorityWeight(getEffectivePriority(a));
        if (priDiff !== 0) return priDiff;
        return (a.dueDate || '9999-99-99').localeCompare(b.dueDate || '9999-99-99');
      })
      .slice(0, 5);
  }, [tasks]);

  const atRiskStaff = useMemo(
    () =>
      (riskFlags || []).filter(
        (flag) =>
          flag?.risk?.level === 'high' ||
          flag?.risk?.level === 'medium' ||
          (flag?.risk?.message || '').toLowerCase().includes('drift')
      ),
    [riskFlags]
  );

  const openSmartPlan = (timeLabel, durationMinutes) => {
    setSmartPlanTime(timeLabel || '15 min');
    if (Number.isFinite(durationMinutes)) {
      setSmartPlanEnergy(durationMinutes > 60 ? 'High Focus' : 'Low Energy');
    } else {
      setSmartPlanEnergy(null);
    }
    setShowSmartPlan(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Brain size={16} className="text-indigo-600" />
            Context-Aware Workspace
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mt-1">
            {dashboardMode === 'ADMIN' ? 'Execution Engine' : 'Leadership Lens'}
          </h2>
          <p className="text-sm text-gray-600">
            {dashboardMode === 'ADMIN'
              ? 'High-density admin mode to clear debt and keep Weekly Wins visible.'
              : 'Low-density leadership mode to watch people and align projects to purpose.'}
          </p>
        </div>
        <ModeToggle dashboardMode={dashboardMode} setDashboardMode={setDashboardMode} />
      </div>

      {dashboardMode === 'ADMIN' ? (
        <AdminMode
          weeklyWins={weeklyWins}
          totalPinned={weeklyPinned.length}
          onGoToTasks={() => setActiveTab('tasks')}
          user={user}
          urgentTasks={urgentTasks}
          onSmartPlan={openSmartPlan}
        />
      ) : (
        <LeadershipMode
          user={user}
          wellbeingLogs={wellbeingLogs}
          atRiskStaff={atRiskStaff}
          onGoToStaff={() => setActiveTab('staff')}
        />
      )}

      {showSmartPlan && (
        <SmartPlanModal
          time={smartPlanTime}
          prefillEnergy={smartPlanEnergy}
          tasks={tasks}
          onClose={() => setShowSmartPlan(false)}
          onOpenTasks={() => setActiveTab('tasks')}
        />
      )}
    </div>
  );
}

function ModeToggle({ dashboardMode, setDashboardMode }) {
  return (
    <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-full p-1 shadow-inner">
      <button
        type="button"
        onClick={() => setDashboardMode('ADMIN')}
        className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all ${
          dashboardMode === 'ADMIN'
            ? 'bg-white shadow text-slate-900'
            : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <ToggleLeft size={14} />
        Admin Mode
      </button>
      <button
        type="button"
        onClick={() => setDashboardMode('LEADERSHIP')}
        className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all ${
          dashboardMode === 'LEADERSHIP'
            ? 'bg-white shadow text-slate-900'
            : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <Compass size={14} />
        Leadership Mode
      </button>
    </div>
  );
}

function AdminMode({
  weeklyWins,
  totalPinned,
  onGoToTasks,
  user,
  urgentTasks,
  onSmartPlan,
}) {
  const { events } = useScheduleEvents(user);
  const handleSmartPlan = (timeLabel, durationMinutes) =>
    onSmartPlan?.(timeLabel, durationMinutes);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      <div className="xl:col-span-8 space-y-4">
        <DayTimeline events={events} onSmartPlan={handleSmartPlan} />
      </div>

      <div className="xl:col-span-4 space-y-4">
        <WeeklyWinsCompact tasks={weeklyWins} totalPinned={totalPinned} onGoToTasks={onGoToTasks} />
        <UrgentTasksStack tasks={(urgentTasks || []).slice(0, 3)} />
      </div>
    </div>
  );
}

function LeadershipMode({
  user,
  wellbeingLogs,
  atRiskStaff,
  onGoToStaff,
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <StrategicHeatmap user={user} />
        <WellbeingTrend user={user} logs={wellbeingLogs} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <PeopleWatch atRiskStaff={atRiskStaff} onGoToStaff={onGoToStaff} className="xl:col-span-2" />
      </div>
    </div>
  );
}

function DayTimeline({ events = [], onSmartPlan }) {
  const blocks = useMemo(() => buildDayTimeline(events), [events]);
  const dayLabel = format(new Date(), 'EEE d MMM');

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4 min-h-[520px]">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-indigo-600 flex items-center gap-2">
            <Clock3 size={16} /> Day View (08:00 - 17:00)
          </div>
          <p className="text-sm text-gray-600">Timeline for {dayLabel}. Gaps over 30 min surface Smart Plan.</p>
        </div>
        <CalendarDays size={18} className="text-indigo-400" />
      </div>

      {blocks.length === 0 ? (
        <div className="text-sm text-gray-500 italic">No schedule events for today.</div>
      ) : (
        <div className="space-y-3">
          {blocks.map((block, idx) => {
            const isGap = block.type === 'gap';
            const label = isGap
              ? `${formatDuration(block.durationMinutes)} free`
              : block.event?.title || 'Busy block';
            const roomLabel = block.event?.room || block.event?.location;
            const notes = block.event?.notes || block.event?.summary;
            return (
              <div
                key={`${block.type}-${idx}-${block.start?.toISOString?.() || idx}`}
                className={`p-4 rounded-2xl border flex gap-3 items-start ${
                  isGap ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-100'
                }`}
              >
                <div className="w-24 text-[11px] font-bold text-gray-500">
                  {formatTimeRange(block.start, block.end)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wide text-gray-600">
                        {isGap ? 'Smart Slot' : 'Scheduled'}
                      </div>
                      <div className="text-sm font-semibold text-gray-900">{label}</div>
                      {!isGap && roomLabel && (
                        <div className="text-[11px] text-gray-500 mt-1">
                          {roomLabel}
                        </div>
                      )}
                      {!isGap && notes && (
                        <div className="text-xs text-gray-500 mt-1 line-clamp-1">
                          {notes}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDuration(block.durationMinutes)}
                    </div>
                  </div>
                  {isGap && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full border border-emerald-200">
                        Gap {formatDuration(block.durationMinutes)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onSmartPlan?.(block.planTime, block.durationMinutes)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
                      >
                        Smart Plan
                      </button>
                      <span className="text-[11px] text-gray-500">
                        Open a Smart Plan for {block.planTime}
                      </span>
                    </div>
                  )}
                  {!isGap && (
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-600">
                      {block.event?.type && (
                        <span className="px-2 py-1 rounded-full bg-white border border-gray-200 font-semibold text-gray-700">
                          {block.event.type}
                        </span>
                      )}
                      {block.event?.classCode && (
                        <span className="px-2 py-1 rounded-full bg-white border border-gray-200 font-semibold text-gray-700">
                          {block.event.classCode}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WeeklyWinsCompact({ tasks = [], totalPinned = 0, onGoToTasks }) {
  const hiddenCount = Math.max(0, totalPinned - tasks.length);

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-indigo-600 flex items-center gap-2">
            <Mountain size={16} /> Weekly Wins
          </div>
          <p className="text-xs text-gray-500">Compact read-only checklist to stay visible.</p>
        </div>
        <button
          type="button"
          onClick={onGoToTasks}
          className="text-[11px] font-bold text-indigo-700 underline"
        >
          Taskboard
        </button>
      </div>
      {tasks.length === 0 ? (
        <div className="text-sm text-gray-500 italic">Pin a Weekly Win from the taskboard.</div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <label
              key={task.id}
              className="flex items-start gap-3 p-3 rounded-2xl border border-gray-100 bg-gray-50"
            >
              <input
                type="checkbox"
                disabled
                checked={(task.status || '').toLowerCase() === 'done'}
                className="mt-1 accent-indigo-600"
              />
              <div className="flex-1">
                <div className="text-sm font-semibold text-gray-900">{task.title}</div>
                {task.summary && (
                  <div className="text-xs text-gray-500 line-clamp-1">{task.summary}</div>
                )}
              </div>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-2 py-1">
                Win
              </span>
            </label>
          ))}
        </div>
      )}
      {hiddenCount > 0 && (
        <div className="text-[11px] text-gray-500">
          Showing top {tasks.length}; {hiddenCount} more wins hidden.
        </div>
      )}
    </div>
  );
}

function UrgentTasksStack({ tasks = [] }) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-3">
      <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
        <Flame className="text-rose-500" size={18} />
        Urgent Tasks
      </div>
      {tasks.length === 0 ? (
        <div className="text-sm text-gray-400 italic">Nothing burning. Stay proactive.</div>
      ) : (
        tasks.map((task) => (
          <div
            key={task.id}
            className="p-3 rounded-xl border border-gray-100 bg-gray-50 flex justify-between items-start gap-3"
          >
            <div>
              <div className="text-sm font-semibold text-gray-800">{task.title}</div>
              <div className="text-xs text-gray-500 line-clamp-1">
                {task.summary || 'No details'}
              </div>
              <div className="flex items-center gap-2 mt-2 text-[11px]">
                <span className="px-2 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-100 font-bold">
                  {getEffectivePriority(task)}
                </span>
                {task.dueDate && (
                  <span className="px-2 py-1 rounded-full bg-white border text-gray-600">
                    Due {formatFriendlyDate(task.dueDate)}
                  </span>
                )}
              </div>
            </div>
            <Timer size={16} className="text-rose-400 shrink-0" />
          </div>
        ))
      )}
    </div>
  );
}

function SmartPlanModal({ time, tasks, onClose, onOpenTasks, prefillEnergy }) {
  return (
    <div
      className="fixed inset-0 bg-slate-900/25 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl p-6 w-full max-w-3xl shadow-2xl border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-indigo-600">
              Smart Plan
            </div>
            <p className="text-sm text-slate-600">
              Curated tasks for the next {time || 'block'} based on your energy/time tags.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-500"
          >
            ✕
          </button>
        </div>
        <SmartContextWidget
          tasks={tasks}
          prefillTime={time}
          prefillEnergy={prefillEnergy}
          onOpenTasks={onOpenTasks}
        />
      </div>
    </div>
  );
}

function buildDayTimeline(events = []) {
  const today = new Date();
  const dayStart = new Date(today);
  dayStart.setHours(8, 0, 0, 0);
  const dayEnd = new Date(today);
  dayEnd.setHours(17, 0, 0, 0);

  const todaysEvents = (events || []).filter(
    (evt) =>
      evt?.startTime &&
      evt?.endTime &&
      isSameDay(evt.startTime, today) &&
      evt.endTime > dayStart &&
      evt.startTime < dayEnd
  );

  const sorted = [...todaysEvents].sort((a, b) => a.startTime - b.startTime);
  const blocks = [];
  let cursor = dayStart;

  for (const evt of sorted) {
    let start = new Date(evt.startTime);
    let end = new Date(evt.endTime);
    if (end <= dayStart || start >= dayEnd) continue;
    if (start < dayStart) start = dayStart;
    if (end > dayEnd) end = dayEnd;

    const gapMinutes = Math.max(0, differenceInMinutes(start, cursor));
    if (gapMinutes > 30) {
      blocks.push({
        type: 'gap',
        start: new Date(cursor),
        end: new Date(start),
        durationMinutes: gapMinutes,
        planTime: getPlanTimeLabel(gapMinutes),
      });
    }

    const eventDuration = Math.max(0, differenceInMinutes(end, start));
    if (eventDuration > 0) {
      blocks.push({
        type: 'event',
        start,
        end,
        durationMinutes: eventDuration,
        event: evt,
      });
    }

    cursor = end;
  }

  const closingGap = Math.max(0, differenceInMinutes(dayEnd, cursor));
  if (closingGap > 30) {
    blocks.push({
      type: 'gap',
      start: new Date(cursor),
      end: dayEnd,
      durationMinutes: closingGap,
      planTime: getPlanTimeLabel(closingGap),
    });
  }

  return blocks;
}

function formatTimeRange(start, end) {
  if (!start || !end) return '';
  return `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`;
}

function formatDuration(minutes = 0) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0 min';
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    if (remainder >= 10) return `${hours}h ${remainder}m`;
    if (remainder > 0) return `${hours}h`;
    return `${hours}h`;
  }
  return `${Math.round(minutes)} min`;
}

function getPlanTimeLabel(minutes) {
  if (minutes >= 60) return '1 hr+';
  if (minutes >= 30) return '30 min';
  if (minutes >= 15) return '15 min';
  return '5 min';
}

function PeopleWatch({ atRiskStaff, onGoToStaff, className }) {
  return (
    <div className={`bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-3 ${className || ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
          <ShieldCheck className="text-emerald-600" size={18} />
          People Watch
        </div>
        <button
          type="button"
          onClick={onGoToStaff}
          className="text-xs font-bold text-indigo-700 underline"
        >
          Open Staff
        </button>
      </div>
      {atRiskStaff.length === 0 ? (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-sm">
          Team is healthy. Keep the cadence steady.
        </div>
      ) : (
        <div className="space-y-3">
          {atRiskStaff.map((flag) => (
            <div
              key={flag.staffId}
              className="p-4 rounded-2xl border border-gray-100 bg-gray-50 flex items-start justify-between gap-3"
            >
              <div>
                <div className="font-bold text-gray-900 text-sm">{flag.staffName}</div>
                <div className="text-[11px] text-gray-500 uppercase">{flag.role || 'Staff'}</div>
                <div className="text-xs text-gray-600 mt-1">{flag.risk?.message}</div>
              </div>
              <span
                className={`px-2 py-1 rounded-full text-[10px] font-bold border ${
                  flag.risk?.level === 'high'
                    ? 'bg-rose-50 text-rose-700 border-rose-100'
                    : 'bg-amber-50 text-amber-700 border-amber-100'
                }`}
              >
                {flag.risk?.level === 'high' ? 'High' : 'Watch'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function priorityWeight(p) {
  if (p === 'High') return 3;
  if (p === 'Medium') return 2;
  return 1;
}
