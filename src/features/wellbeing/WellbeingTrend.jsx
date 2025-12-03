import React, { useMemo } from 'react';
import { Activity, AlertTriangle } from 'lucide-react';
import { useWellbeing } from '../../hooks/useWellbeing';

const ENERGY_LABEL_MAP = {
  low: 3,
  medium: 7,
  high: 10,
};

export function WellbeingTrend({ user, logs: providedLogs }) {
  const { wellbeingLogs } = useWellbeing(user);
  const logs = useMemo(
    () => providedLogs || wellbeingLogs || [],
    [providedLogs, wellbeingLogs]
  );

  const trendData = useMemo(() => buildTrendData(logs), [logs]);
  const recentEnergy = useMemo(() => getRecentAverage(trendData, 3), [trendData]);
  const overallAverage = useMemo(() => getRecentAverage(trendData, trendData.length), [trendData]);
  const burnoutRisk = recentEnergy !== null && recentEnergy < 4;
  const hasData = trendData.some((point) => point.value !== null);

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-amber-600 flex items-center gap-2">
            <Activity size={16} /> Energy Trend
          </div>
          <p className="text-sm text-gray-600">14-day average energy per day.</p>
        </div>
        {burnoutRisk && (
          <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-100 text-[11px] font-bold flex items-center gap-1">
            <AlertTriangle size={12} /> Burnout Risk
          </span>
        )}
      </div>

      {!hasData ? (
        <div className="text-sm text-gray-400 italic">No wellbeing logs in the last 14 days.</div>
      ) : (
        <>
          <div className="flex items-end gap-2 h-36">
            {trendData.map((point, idx) => (
              <div key={point.dateKey ? `trend-${point.dateKey}` : `trend-${idx}`} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full h-full rounded-xl bg-indigo-50 flex items-end overflow-hidden">
                  <div
                    style={{ height: `${Math.max(0, Math.min(10, point.value || 0)) * 10}%` }}
                    className={`w-full ${
                      point.isRecent ? 'bg-indigo-500' : 'bg-indigo-300'
                    } transition-all`}
                  ></div>
                </div>
                <span className="text-[10px] font-semibold text-gray-500">{point.label}</span>
                <span className="text-[11px] font-bold text-gray-800">
                  {point.value !== null ? point.value.toFixed(1) : '—'}
                </span>
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-500">
            <span className="font-semibold text-gray-800">{overallAverage?.toFixed(1) || '—'}</span>
            /10 avg · Last 3-day avg:{' '}
            <span className="font-semibold text-gray-800">
              {recentEnergy !== null ? recentEnergy.toFixed(1) : '—'}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function buildTrendData(logs = []) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - 13);

  const byDay = new Map();
  for (const log of logs) {
    const dateKey = normalizeDateKey(log.date);
    if (!dateKey) continue;
    const logDate = new Date(dateKey);
    if (logDate < start || logDate > today) continue;

    const energyValue = parseEnergyValue(log);
    if (energyValue === null) continue;

    const current = byDay.get(dateKey) || { total: 0, count: 0 };
    byDay.set(dateKey, { total: current.total + energyValue, count: current.count + 1 });
  }

  const points = [];
  const cursor = new Date(start);
  for (let i = 0; i < 14; i++) {
    const dateKey = cursor.toISOString().slice(0, 10);
    const entry = byDay.get(dateKey);
    const value = entry ? entry.total / entry.count : null;
    points.push({
      label: cursor.toLocaleDateString(undefined, { weekday: 'short' }),
      dateKey,
      value,
      isRecent: i >= 11,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return points;
}

function parseEnergyValue(log = {}) {
  const raw = log.energy ?? log.energyLevel ?? log.energyScore;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return clamp(raw, 0, 10);
  }
  if (typeof raw === 'string') {
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) return clamp(numeric, 0, 10);
    const mapped = mapEnergyLabel(raw);
    if (mapped !== null) return mapped;
  }
  return null;
}

function mapEnergyLabel(label = '') {
  const lower = label.toString().trim().toLowerCase();
  if (!lower) return null;
  if (ENERGY_LABEL_MAP[lower] !== undefined) return ENERGY_LABEL_MAP[lower];
  if (lower.includes('low')) return ENERGY_LABEL_MAP.low;
  if (lower.includes('medium') || lower.includes('med')) return ENERGY_LABEL_MAP.medium;
  if (lower.includes('high')) return ENERGY_LABEL_MAP.high;
  return null;
}

function normalizeDateKey(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getRecentAverage(points = [], days) {
  if (!Array.isArray(points) || points.length === 0) return null;
  const slice = points.slice(-days);
  const values = slice.map((p) => p.value).filter((v) => typeof v === 'number');
  if (values.length === 0) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}
