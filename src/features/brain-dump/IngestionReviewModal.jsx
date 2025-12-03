import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useTasks } from '../../hooks/useTasks';
import { db } from '../../services/firebase';
import { appId } from '../../config/appConfig';
import { applyContextTags } from '../../utils/taskContext';
import { createTaskFingerprint } from '../tasks/TaskBoard';
import {
  fingerprintEvent,
  fingerprintInsight,
  fingerprintStrategyNote,
  fetchRecentStaffInsightFingerprints,
  fetchRecentStrategyNoteFingerprints,
} from '../../utils/fingerprints';

const toDateInput = (value) => {
  if (!value) return '';
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return '';
  }
};

const stringifySafe = (val) => {
  if (typeof val === 'string') return val;
  try {
    return JSON.stringify(val, null, 2);
  } catch {
    return '';
  }
};

const normalize = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return String(value);
};

const quickDate = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

const formatFriendlyDate = (value) => {
  const iso = toDateInput(value);
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
};

const quickChipClass =
  'px-2 py-1 rounded-full border border-indigo-100 bg-indigo-50 text-indigo-700 text-[11px] font-semibold hover:bg-indigo-100 transition-colors';
const mutedChipClass =
  'px-2 py-1 rounded-full border border-gray-200 text-[11px] text-gray-600 hover:bg-gray-100 transition-colors';

const diffTaskCorrections = (originalTasks, editedTasks) => {
  const fieldsToTrack = [
    'title',
    'dueDate',
    'assignee',
    'priority',
    'category',
    'summary',
    'estimatedMinutes',
    'themeTag',
    'energyLevel',
    'estimatedTime',
    'isWeeklyWin',
  ];

  return editedTasks
    .map((task, idx) => {
      const baseline = originalTasks[idx] || {};
      const changes = {};
      fieldsToTrack.forEach((field) => {
        const before = normalize(baseline[field]);
        const after = normalize(task[field]);
        if (before !== after) {
          changes[field] = { from: baseline[field] ?? '', to: task[field] ?? '' };
        }
      });
      if (task.ignore) {
        changes.ignore = { from: false, to: true };
      }
      return Object.keys(changes).length
        ? {
            type: 'task',
            label: task.title || `Task ${idx + 1}`,
            changes,
          }
        : null;
    })
    .filter(Boolean);
};

export function IngestionReviewModal({
  isOpen,
  aiResult,
  rawText,
  staff = [],
  user,
  context,
  updateContext,
  isSaving = false,
  onApprove,
  onClose,
  reviewOnly = false,
}) {
  const safeAi = useMemo(
    () => (aiResult && typeof aiResult === 'object' ? aiResult : {}),
    [aiResult]
  );

  const [tasks, setTasks] = useState([]);
  const [insights, setInsights] = useState([]);
  const [events, setEvents] = useState([]);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const originals = useRef({ tasks: [], insights: [], events: [] });
  const { tasks: existingTasks = [], addTask } = useTasks(user);

  const taskFingerprints = useMemo(() => {
    const list = Array.isArray(existingTasks) ? existingTasks : [];
    return new Set(list.map((t) => t.fingerprint || createTaskFingerprint(t)));
  }, [existingTasks]);

  const eventFingerprints = useMemo(() => {
    const eventsList = Array.isArray(context?.events) ? context.events : [];
    return new Set(eventsList.map(fingerprintEvent));
  }, [context?.events]);

  useEffect(() => {
    const nextTasks = (Array.isArray(safeAi.tasks) ? safeAi.tasks : []).map((task, idx) => ({
      id: task.id || `task-${idx}`,
      title: task.title || '',
      dueDate: task.dueDate || '',
      assignee: task.assignee || '',
      priority: task.priority || 'Medium',
      category: task.category || 'General',
      summary: task.summary || '',
      themeTag: task.themeTag || '',
      estimatedMinutes: task.estimatedMinutes || '',
      estimatedTime: task.estimatedTime || '',
      energyLevel: task.energyLevel || '',
      isWeeklyWin: typeof task.isWeeklyWin === 'boolean' ? task.isWeeklyWin : false,
      ignore: false,
    }));

    const nextInsights = (Array.isArray(safeAi.staffInsights) ? safeAi.staffInsights : []).map(
      (insight, idx) => ({
        id: insight.id || `insight-${idx}`,
        staffName: insight.staffName || '',
        summary: insight.summary || '',
        date: insight.date || '',
        type: insight.type || 'neutral',
        ignore: false,
      })
    );

    const nextEvents = (Array.isArray(safeAi.calendarEvents) ? safeAi.calendarEvents : []).map(
      (evt, idx) => ({
        id: evt.id || `event-${idx}`,
        title: evt.title || '',
        startDateTime: evt.startDateTime || evt.date || '',
        endDateTime: evt.endDateTime || '',
        description: evt.description || '',
        type: evt.type || 'Other',
        ignore: false,
      })
    );

    setTasks(nextTasks);
    setInsights(nextInsights);
    setEvents(nextEvents);
    setSaveError('');
    setSaving(false);
    originals.current = {
      tasks: nextTasks.map((t) => ({ ...t, ignore: false })),
      insights: nextInsights.map((i) => ({ ...i, ignore: false })),
      events: nextEvents.map((e) => ({ ...e, ignore: false })),
    };
  }, [safeAi]);

  const rawPreview = useMemo(() => {
    if (typeof rawText === 'string' && rawText.trim()) return rawText.trim();
    if (typeof safeAi.rawText === 'string' && safeAi.rawText.trim()) return safeAi.rawText.trim();
    return stringifySafe(aiResult);
  }, [aiResult, rawText, safeAi.rawText]);

  if (!isOpen) return null;

  const totalItems = tasks.length + insights.length + events.length;
  const hasStructured = totalItems > 0;
  const staffNames = (Array.isArray(staff) ? staff : [])
    .map((s) => s.name)
    .filter(Boolean);

  const handleApprove = async () => {
    if (saving) return;
    const payload = {
      tasks: tasks.filter((t) => !t.ignore && (t.title || t.summary)),
      staffInsights: insights.filter((i) => !i.ignore && (i.summary || i.staffName)),
      calendarEvents: events.filter((e) => !e.ignore && e.title),
      rawText: rawPreview,
      corrections: diffTaskCorrections(originals.current.tasks, tasks),
    };
    try {
      if (reviewOnly) {
        await onApprove?.(payload);
        onClose?.();
        return;
      }
      setSaving(true);
      setSaveError('');

      const corrections = Array.isArray(payload?.corrections) ? payload.corrections : [];
      if (corrections.length) {
        console.info('Brain dump corrections', {
          at: new Date().toISOString(),
          rawText: payload?.rawText || rawPreview || '',
          corrections,
        });
      }

      const staffInsightFingerprints = await fetchRecentStaffInsightFingerprints(user);
      const strategyNoteFingerprints = await fetchRecentStrategyNoteFingerprints(user);

      if (payload?.tasks?.length && addTask) {
        const filteredTasks = payload.tasks
          .filter((task) => {
            const fp = createTaskFingerprint(task);
            return fp && !taskFingerprints.has(fp);
          })
          .map((task) => applyContextTags(task));

        if (filteredTasks.length > 0) {
          await Promise.all(
            filteredTasks.map((task) =>
              addTask({
                ...task,
                originalSource: 'brain-dump-reviewed',
                status: 'todo',
                fingerprint: createTaskFingerprint(task),
                createdAt: serverTimestamp(),
              })
            )
          );
        }
      }

      if (user && safeAi?.wellbeing) {
        const todayIso = new Date().toISOString().split('T')[0];

        await addDoc(
          collection(db, 'artifacts', appId, 'users', user.uid, 'wellbeingLogs'),
          {
            mood: safeAi.wellbeing.mood || 'Okay',
            energy: safeAi.wellbeing.energy || 'Medium',
            summary:
              safeAi.wellbeing.summary ||
              'Wellbeing summary generated from brain dump.',
            source: 'brain-dump',
            date: todayIso,
            createdAt: serverTimestamp(),
          }
        );
      }

      if (payload?.staffInsights?.length) {
        const insightsToSave = payload.staffInsights.filter((insight) => {
          const fp = fingerprintInsight(insight);
          return fp && !staffInsightFingerprints.has(fp);
        });

        for (const insight of insightsToSave) {
          await addDoc(
            collection(db, 'artifacts', appId, 'users', user.uid, 'staffInsights'),
            {
              ...insight,
              fingerprint: fingerprintInsight(insight),
              createdAt: serverTimestamp(),
            }
          );
        }
      }

      if (payload?.calendarEvents?.length && updateContext) {
        const newEvents = payload.calendarEvents.filter((evt) => {
          const fp = fingerprintEvent(evt);
          return fp && !eventFingerprints.has(fp);
        });
        if (newEvents.length) {
          const merged = [...(context?.events || []), ...newEvents];
          await updateContext({ ...(context || {}), events: merged });
        }
      }

      if (Array.isArray(safeAi?.strategyNotes) && safeAi.strategyNotes.length) {
        const notesToSave = safeAi.strategyNotes.filter((note) => {
          const fp = fingerprintStrategyNote(note);
          return fp && !strategyNoteFingerprints.has(fp);
        });

        for (const note of notesToSave) {
          await addDoc(
            collection(db, 'artifacts', appId, 'users', user.uid, 'strategyNotes'),
            {
              ...note,
              fingerprint: fingerprintStrategyNote(note),
              createdAt: serverTimestamp(),
            }
          );
        }
      }

      if (onApprove) {
        await onApprove(payload);
      }
      onClose?.();
    } catch (err) {
      console.error('Error saving reviewed brain dump:', err);
      setSaveError('We could not save the reviewed items. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const updateTask = (id, updates) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  };
  const updateInsight = (id, updates) => {
    setInsights((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
  };
  const updateEvent = (id, updates) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
  };

  return (
    <div
      className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={() => {
        if (saving || isSaving) return;
        onClose?.();
      }}
    >
      <div
        className="bg-white rounded-[2rem] w-full max-w-5xl shadow-2xl border border-gray-100 p-6 max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="text-xs font-bold text-indigo-500 uppercase tracking-wide flex items-center gap-2">
              <Sparkles size={14} /> AI Ingestion Review
            </div>
            <div className="text-xl font-bold text-gray-900 mt-1">
              I found {totalItems} item{totalItems === 1 ? '' : 's'}. Review them before saving.
            </div>
            <p className="text-sm text-gray-500">
              Nothing is saved yet. Edit, ignore, or correct the AI output before committing.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (saving || isSaving) return;
              onClose?.();
            }}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {!hasStructured && (
          <div className="mb-4 flex items-start gap-3 p-3 rounded-2xl bg-amber-50 border border-amber-100 text-amber-700">
            <AlertTriangle size={18} className="mt-0.5" />
            <div>
              <div className="font-semibold text-sm">AI response could not be parsed cleanly.</div>
              <div className="text-sm">The raw response is shown below so you can salvage it manually.</div>
            </div>
          </div>
        )}

        <div className="space-y-6 overflow-y-auto max-h-[60vh] pr-2 custom-scrollbar">
          <section>
            <div className="flex items-center gap-2 mb-3">
              <CheckSquare className="text-indigo-500" size={18} />
              <h3 className="text-sm font-bold uppercase text-gray-600">Tasks</h3>
              <span className="text-[11px] text-gray-400 font-mono bg-gray-50 px-2 py-1 rounded-full border border-gray-200">
                {tasks.length} found
              </span>
            </div>
            {tasks.length === 0 ? (
              <div className="text-sm text-gray-400 italic">No tasks detected.</div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => {
                  const originalTask =
                    originals.current.tasks.find((t) => t.id === task.id) || {};
                  const aiDueDisplay = formatFriendlyDate(originalTask.dueDate) || 'Auto (7d)';
                  const aiEnergyDisplay = originalTask.energyLevel || 'Auto';
                  const aiTimeDisplay = originalTask.estimatedTime || 'Auto';

                  return (
                    <div
                      key={task.id}
                      className={`p-4 rounded-2xl border ${
                        task.ignore ? 'border-dashed border-gray-200 bg-gray-50' : 'border-gray-100 bg-white'
                      } shadow-[0_6px_20px_rgba(0,0,0,0.03)]`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-semibold text-gray-800">
                          {task.title || 'Untitled task'}
                        </div>
                        <label className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                          <input
                            type="checkbox"
                            checked={task.ignore}
                            onChange={(e) => updateTask(task.id, { ignore: e.target.checked })}
                          />
                          Ignore
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className={mutedChipClass}>AI due: {aiDueDisplay}</span>
                        <span className={mutedChipClass}>AI energy: {aiEnergyDisplay}</span>
                        <span className={mutedChipClass}>AI time: {aiTimeDisplay}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[11px] font-bold text-gray-500 uppercase">Title</label>
                          <input
                            value={task.title}
                            onChange={(e) => updateTask(task.id, { title: e.target.value })}
                            className="w-full mt-1 p-3 rounded-xl border border-gray-200 text-sm"
                            placeholder="Short actionable title"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-gray-500 uppercase">Due Date</label>
                          <input
                            type="date"
                            value={toDateInput(task.dueDate)}
                            onChange={(e) => updateTask(task.id, { dueDate: e.target.value })}
                            className="w-full mt-1 p-3 rounded-xl border border-gray-200 text-sm"
                          />
                          <div className="flex flex-wrap gap-2 mt-2">
                            <button
                              type="button"
                              className={quickChipClass}
                              onClick={() =>
                                updateTask(task.id, { dueDate: toDateInput(originalTask.dueDate) || '' })
                              }
                            >
                              Use AI
                            </button>
                            <button
                              type="button"
                              className={mutedChipClass}
                              onClick={() => updateTask(task.id, { dueDate: quickDate(0) })}
                            >
                              Today
                            </button>
                            <button
                              type="button"
                              className={mutedChipClass}
                              onClick={() => updateTask(task.id, { dueDate: quickDate(1) })}
                            >
                              Tomorrow
                            </button>
                            <button
                              type="button"
                              className={mutedChipClass}
                              onClick={() => updateTask(task.id, { dueDate: quickDate(7) })}
                            >
                              Next Week
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-gray-500 uppercase">Staff Link</label>
                          <input
                            value={task.assignee}
                            onChange={(e) => updateTask(task.id, { assignee: e.target.value })}
                            className="w-full mt-1 p-3 rounded-xl border border-gray-200 text-sm"
                            list="staff-suggestions"
                            placeholder="Name (optional)"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                        <div>
                          <label className="text-[11px] font-bold text-gray-500 uppercase">Priority</label>
                          <select
                            value={task.priority || 'Medium'}
                            onChange={(e) => updateTask(task.id, { priority: e.target.value })}
                            className="w-full mt-1 p-3 rounded-xl border border-gray-200 text-sm bg-white"
                          >
                            <option>High</option>
                            <option>Medium</option>
                            <option>Low</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-gray-500 uppercase">Category</label>
                          <input
                            value={task.category}
                            onChange={(e) => updateTask(task.id, { category: e.target.value })}
                            className="w-full mt-1 p-3 rounded-xl border border-gray-200 text-sm"
                            placeholder="Admin / Pastoral / Strategic"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-gray-500 uppercase">Strategy Tag</label>
                          <input
                            value={task.themeTag}
                            onChange={(e) => updateTask(task.id, { themeTag: e.target.value })}
                            className="w-full mt-1 p-3 rounded-xl border border-gray-200 text-sm"
                            placeholder="Optional link"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                        <div>
                          <label className="text-[11px] font-bold text-gray-500 uppercase">Energy</label>
                          <select
                            value={task.energyLevel}
                            onChange={(e) => updateTask(task.id, { energyLevel: e.target.value })}
                            className="w-full mt-1 p-3 rounded-xl border border-gray-200 text-sm bg-white"
                          >
                            <option value="">Auto</option>
                            <option value="High Focus">High Focus</option>
                            <option value="Low Energy/Admin">Low Energy/Admin</option>
                          </select>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <button
                              type="button"
                              className={quickChipClass}
                              onClick={() =>
                                updateTask(task.id, { energyLevel: originalTask.energyLevel || '' })
                              }
                            >
                              Use AI
                            </button>
                            <button
                              type="button"
                              className={mutedChipClass}
                              onClick={() => updateTask(task.id, { energyLevel: 'High Focus' })}
                            >
                              High Focus
                            </button>
                            <button
                              type="button"
                              className={mutedChipClass}
                              onClick={() => updateTask(task.id, { energyLevel: 'Low Energy/Admin' })}
                            >
                              Low Energy
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-gray-500 uppercase">Estimated Time</label>
                          <select
                            value={task.estimatedTime}
                            onChange={(e) => updateTask(task.id, { estimatedTime: e.target.value })}
                            className="w-full mt-1 p-3 rounded-xl border border-gray-200 text-sm bg-white"
                          >
                            <option value="">Auto</option>
                            <option value="5 min">5 min</option>
                            <option value="15 min">15 min</option>
                            <option value="30 min">30 min</option>
                            <option value="1 hr+">1 hr+</option>
                          </select>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <button
                              type="button"
                              className={quickChipClass}
                              onClick={() =>
                                updateTask(task.id, { estimatedTime: originalTask.estimatedTime || '' })
                              }
                            >
                              Use AI
                            </button>
                            <button
                              type="button"
                              className={mutedChipClass}
                              onClick={() => updateTask(task.id, { estimatedTime: '5 min' })}
                            >
                              5 min
                            </button>
                            <button
                              type="button"
                              className={mutedChipClass}
                              onClick={() => updateTask(task.id, { estimatedTime: '15 min' })}
                            >
                              15 min
                            </button>
                            <button
                              type="button"
                              className={mutedChipClass}
                              onClick={() => updateTask(task.id, { estimatedTime: '30 min' })}
                            >
                              30 min
                            </button>
                            <button
                              type="button"
                              className={mutedChipClass}
                              onClick={() => updateTask(task.id, { estimatedTime: '1 hr+' })}
                            >
                              1 hr+
                            </button>
                          </div>
                        </div>
                        <div className="flex items-end">
                          <label className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase w-full">
                            <input
                              type="checkbox"
                              checked={task.isWeeklyWin}
                              onChange={(e) => updateTask(task.id, { isWeeklyWin: e.target.checked })}
                            />
                            Weekly Win
                          </label>
                        </div>
                      </div>
                      <div className="mt-3">
                        <label className="text-[11px] font-bold text-gray-500 uppercase">Summary</label>
                        <textarea
                          value={task.summary}
                          onChange={(e) => updateTask(task.id, { summary: e.target.value })}
                          className="w-full mt-1 p-3 rounded-xl border border-gray-200 text-sm min-h-[80px]"
                          placeholder="One or two sentences"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <UserRound className="text-indigo-500" size={18} />
              <h3 className="text-sm font-bold uppercase text-gray-600">Staff Insights</h3>
              <span className="text-[11px] text-gray-400 font-mono bg-gray-50 px-2 py-1 rounded-full border border-gray-200">
                {insights.length} found
              </span>
            </div>
            {insights.length === 0 ? (
              <div className="text-sm text-gray-400 italic">No staff insights detected.</div>
            ) : (
              <div className="space-y-3">
                {insights.map((insight) => (
                  <div
                    key={insight.id}
                    className={`p-4 rounded-2xl border ${
                      insight.ignore ? 'border-dashed border-gray-200 bg-gray-50' : 'border-gray-100 bg-white'
                    } shadow-[0_6px_20px_rgba(0,0,0,0.03)]`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-gray-800">
                        {insight.staffName || 'Staff insight'}
                      </div>
                      <label className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                        <input
                          type="checkbox"
                          checked={insight.ignore}
                          onChange={(e) => updateInsight(insight.id, { ignore: e.target.checked })}
                        />
                        Ignore
                      </label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-gray-500 uppercase">Staff Member</label>
                        <input
                          value={insight.staffName}
                          onChange={(e) => updateInsight(insight.id, { staffName: e.target.value })}
                          className="w-full mt-1 p-3 rounded-xl border border-gray-200 text-sm"
                          list="staff-suggestions"
                          placeholder="Who is this about?"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-gray-500 uppercase">Tone</label>
                        <select
                          value={insight.type || 'neutral'}
                          onChange={(e) => updateInsight(insight.id, { type: e.target.value })}
                          className="w-full mt-1 p-3 rounded-xl border border-gray-200 text-sm bg-white"
                        >
                          <option value="praise">Praise</option>
                          <option value="concern">Concern</option>
                          <option value="neutral">Neutral</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-gray-500 uppercase">Date</label>
                        <input
                          type="date"
                          value={toDateInput(insight.date)}
                          onChange={(e) => updateInsight(insight.id, { date: e.target.value })}
                          className="w-full mt-1 p-3 rounded-xl border border-gray-200 text-sm"
                        />
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="text-[11px] font-bold text-gray-500 uppercase">Insight</label>
                      <textarea
                        value={insight.summary}
                        onChange={(e) => updateInsight(insight.id, { summary: e.target.value })}
                        className="w-full mt-1 p-3 rounded-xl border border-gray-200 text-sm min-h-[70px]"
                        placeholder="Keep this concise and actionable"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="text-indigo-500" size={18} />
              <h3 className="text-sm font-bold uppercase text-gray-600">Calendar</h3>
              <span className="text-[11px] text-gray-400 font-mono bg-gray-50 px-2 py-1 rounded-full border border-gray-200">
                {events.length} found
              </span>
            </div>
            {events.length === 0 ? (
              <div className="text-sm text-gray-400 italic">No calendar events detected.</div>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className={`p-4 rounded-2xl border ${
                      event.ignore ? 'border-dashed border-gray-200 bg-gray-50' : 'border-gray-100 bg-white'
                    } shadow-[0_6px_20px_rgba(0,0,0,0.03)]`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-gray-800">{event.title || 'Event'}</div>
                      <label className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                        <input
                          type="checkbox"
                          checked={event.ignore}
                          onChange={(e) => updateEvent(event.id, { ignore: e.target.checked })}
                        />
                        Ignore
                      </label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-gray-500 uppercase">Title</label>
                        <input
                          value={event.title}
                          onChange={(e) => updateEvent(event.id, { title: e.target.value })}
                          className="w-full mt-1 p-3 rounded-xl border border-gray-200 text-sm"
                          placeholder="Event title"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-gray-500 uppercase">Start</label>
                        <input
                          type="datetime-local"
                          value={event.startDateTime ? event.startDateTime.toString().slice(0, 16) : ''}
                          onChange={(e) => updateEvent(event.id, { startDateTime: e.target.value })}
                          className="w-full mt-1 p-3 rounded-xl border border-gray-200 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-gray-500 uppercase">End</label>
                        <input
                          type="datetime-local"
                          value={event.endDateTime ? event.endDateTime.toString().slice(0, 16) : ''}
                          onChange={(e) => updateEvent(event.id, { endDateTime: e.target.value })}
                          className="w-full mt-1 p-3 rounded-xl border border-gray-200 text-sm"
                        />
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-gray-500 uppercase">Type</label>
                        <input
                          value={event.type}
                          onChange={(e) => updateEvent(event.id, { type: e.target.value })}
                          className="w-full mt-1 p-3 rounded-xl border border-gray-200 text-sm"
                          placeholder="Parents Evening / Exam / Meeting"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-gray-500 uppercase">Notes</label>
                        <input
                          value={event.description}
                          onChange={(e) => updateEvent(event.id, { description: e.target.value })}
                          className="w-full mt-1 p-3 rounded-xl border border-gray-200 text-sm"
                          placeholder="Optional description"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="mt-6 space-y-3">
          <details className="group">
            <summary className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase cursor-pointer">
              <ClipboardList size={16} className="text-indigo-500" />
              Raw AI Response
              <span className="text-[10px] text-gray-400 font-mono bg-gray-50 px-2 py-0.5 rounded-full border border-gray-200 ml-2 group-open:hidden">
                tap to view
              </span>
            </summary>
            <pre className="mt-2 p-3 rounded-2xl bg-gray-900 text-gray-100 text-xs max-h-48 overflow-auto custom-scrollbar">
{rawPreview || 'No raw text available.'}
            </pre>
          </details>
        </div>

        <datalist id="staff-suggestions">
          {staffNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={() => {
              if (saving || isSaving) return;
              onClose?.();
            }}
            className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 text-sm font-semibold"
            disabled={isSaving || saving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={isSaving || saving}
            className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-60 shadow-lg shadow-indigo-100"
          >
            {isSaving || saving ? 'Saving…' : 'Approve & Save'}
          </button>
        </div>

        {saveError && (
          <div className="mt-3 text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-3">
            {saveError}
          </div>
        )}
      </div>
    </div>
  );
}
