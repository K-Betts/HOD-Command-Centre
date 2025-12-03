import React, { useEffect, useMemo, useState } from 'react';
import { Compass, Search, Loader2, Zap } from 'lucide-react';
import { applyContextTags, ENERGY_OPTIONS, TIME_OPTIONS } from '../../utils/taskContext';
import { getEffectivePriority } from './TaskBoard';

const timeOptions = TIME_OPTIONS;
const energyOptions = ENERGY_OPTIONS;

export function SmartContextWidget({
  onOpenTasks,
  tasks: providedTasks = [],
  loading: externalLoading = false,
  prefillTime,
  prefillEnergy,
}) {
  const loading = externalLoading;
  const normalizeEnergy = (value) => {
    if (!value) return value;
    if (value === 'Low Energy') return 'Low Energy/Admin';
    return value;
  };

  const [selectedTime, setSelectedTime] = useState(prefillTime || '15 min');
  const [selectedEnergy, setSelectedEnergy] = useState(
    normalizeEnergy(prefillEnergy) || 'Low Energy/Admin'
  );
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  const tasks = useMemo(
    () => (providedTasks || []).map((t) => applyContextTags(t)),
    [providedTasks]
  );

  useEffect(() => {
    if (prefillTime) {
      setSelectedTime(prefillTime);
      setHasSearched(false);
    }
  }, [prefillTime]);

  useEffect(() => {
    if (prefillEnergy) {
      setSelectedEnergy(normalizeEnergy(prefillEnergy));
      setHasSearched(false);
    }
  }, [prefillEnergy]);

  const handleFind = () => {
    const filtered = tasks
      .filter((task) => {
        const status = (task.status || '').toLowerCase();
        const blocked = task.blocked || task.isBlocked || status === 'blocked';
        if (blocked || status === 'done' || task.archivedAt) return false;

        const energyMatch =
          !selectedEnergy || !task.energyLevel || task.energyLevel === selectedEnergy;
        const timeMatch =
          !selectedTime || !task.estimatedTime || task.estimatedTime === selectedTime;
        return energyMatch && timeMatch;
      })
      .sort((a, b) => {
        const priDiff = priorityWeight(getEffectivePriority(b)) - priorityWeight(getEffectivePriority(a));
        if (priDiff !== 0) return priDiff;
        const dueA = a.dueDate || '9999-99-99';
        const dueB = b.dueDate || '9999-99-99';
        return dueA.localeCompare(dueB);
      })
      .slice(0, 3);

    setResults(filtered);
    setHasSearched(true);
  };

  return (
    <div className="bg-white border border-indigo-100 shadow-lg shadow-indigo-50 rounded-3xl p-6 h-full flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-indigo-500 uppercase tracking-wide flex items-center gap-2">
            <Compass size={14} /> Smart Context
          </div>
          <h3 className="text-lg font-bold text-gray-900 mt-1 leading-tight">
            I have{' '}
            <span className="text-indigo-600">{selectedTime}</span> and my energy is{' '}
            <span className="text-indigo-600">{selectedEnergy || '…'}</span>. What should I do?
          </h3>
        </div>
        <Zap className="text-amber-400" size={20} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-gray-500 uppercase">Time</label>
          <select
            value={selectedTime}
            onChange={(e) => setSelectedTime(e.target.value)}
            className="w-full p-3 rounded-xl border border-gray-200 text-sm bg-white"
          >
            {timeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-gray-500 uppercase">Energy</label>
          <select
            value={selectedEnergy}
            onChange={(e) => setSelectedEnergy(e.target.value)}
            className="w-full p-3 rounded-xl border border-gray-200 text-sm bg-white"
          >
            {energyOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={handleFind}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-60 shadow-md"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Find Tasks
        </button>
        {onOpenTasks && (
          <button
            type="button"
            onClick={onOpenTasks}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 border border-gray-200"
          >
            Open Taskboard
          </button>
        )}
      </div>

      <div className="mt-4 space-y-3 flex-1 overflow-y-auto custom-scrollbar">
        {!hasSearched && (
          <div className="text-sm text-gray-500 italic">
            Choose your energy and time, then tap Find Tasks for three quick wins.
          </div>
        )}
        {hasSearched && results.length === 0 && (
          <div className="text-sm text-gray-500">
            No matches yet. Try broadening time/energy or tag more tasks in the taskboard.
          </div>
        )}
        {results.map((task) => (
          <div
            key={task.id}
            className="p-4 rounded-2xl border border-gray-100 bg-gray-50 hover:bg-white hover:border-indigo-100 transition-all shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-bold text-gray-900">{task.title}</div>
                {task.summary && (
                  <div className="text-xs text-gray-500 mt-1 line-clamp-2">{task.summary}</div>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {task.energyLevel && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {task.energyLevel}
                    </span>
                  )}
                  {task.estimatedTime && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-gray-50 text-gray-600 border border-gray-100">
                      {task.estimatedTime}
                    </span>
                  )}
                  <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-100">
                    {getEffectivePriority(task)}
                  </span>
                  {task.dueDate && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-white text-gray-600 border border-gray-200">
                      Due {task.dueDate}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function priorityWeight(p) {
  if (p === 'High') return 3;
  if (p === 'Medium') return 2;
  return 1;
}
