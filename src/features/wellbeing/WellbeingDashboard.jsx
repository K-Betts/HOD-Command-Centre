import React, { useMemo } from 'react';
import { Heart, TrendingUp, AlertCircle, Calendar, Filter } from 'lucide-react';
import { useWellbeing } from '../../hooks/useWellbeing';

/**
 * WellbeingDashboard: Surface wellbeing logs and AI wellbeing signals
 * - Trend visualization (mood/energy over time)
 * - Risk flags for fatigue/burnout
 * - Recent entries with dates
 * - Export/notes capability
 */
export function WellbeingDashboard({ user, wellbeingSignal = null }) {
  const { wellbeingLogs, loading } = useWellbeing(user);
  const [timeRange, setTimeRange] = React.useState('month'); // 'week', 'month', 'term'

  const filteredLogs = useMemo(() => {
    if (!wellbeingLogs.length) return [];

    const now = new Date();
    const cutoff = new Date();

    if (timeRange === 'week') {
      cutoff.setDate(now.getDate() - 7);
    } else if (timeRange === 'month') {
      cutoff.setMonth(now.getMonth() - 1);
    } else if (timeRange === 'term') {
      cutoff.setMonth(now.getMonth() - 3);
    }

    return wellbeingLogs.filter((log) => {
      const logDate = log.date instanceof Date ? log.date : new Date(log.date);
      return logDate >= cutoff;
    });
  }, [wellbeingLogs, timeRange]);

  const stats = useMemo(() => {
    if (!filteredLogs.length) {
      return {
        avgMood: null,
        avgEnergy: null,
        riskCount: 0,
        trend: 'neutral',
      };
    }

    const moodMap = { 'Very Low': 1, 'Low': 2, 'Okay': 3, 'Good': 4, 'Great': 5 };
    const energyMap = { 'Very Low': 1, 'Low': 2, 'Medium': 3, 'High': 4, 'Very High': 5 };

    const avgMood =
      filteredLogs.reduce((sum, log) => sum + (moodMap[log.mood] || 0), 0) / filteredLogs.length;
    const avgEnergy =
      filteredLogs.reduce((sum, log) => sum + (energyMap[log.energy] || 0), 0) / filteredLogs.length;

    const riskCount = filteredLogs.filter(
      (log) =>
        log.mood === 'Very Low' ||
        log.mood === 'Low' ||
        log.energy === 'Very Low' ||
        log.energy === 'Low'
    ).length;

    const trend =
      avgMood >= 4 && avgEnergy >= 4
        ? 'improving'
        : avgMood <= 2 || avgEnergy <= 2
        ? 'declining'
        : 'stable';

    return { avgMood, avgEnergy, riskCount, trend };
  }, [filteredLogs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center space-y-3">
          <div className="h-12 w-12 mx-auto border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading wellbeing data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
          Health & Wellness
        </p>
        <h2 className="text-2xl font-bold text-slate-900">Wellbeing Dashboard</h2>
        <p className="text-sm text-slate-500 mt-2">
          Track your mood, energy, and overall wellbeing trends. Use this to spot patterns and
          flag risk periods.
        </p>
      </div>

      {/* AI Wellbeing Signal (if provided) */}
      {wellbeingSignal && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 space-y-2">
          <div className="flex items-start gap-3">
            <Heart className="text-indigo-600 flex-shrink-0 mt-1" size={20} />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-900 text-sm">AI Wellbeing Insight</h3>
              <p className="text-sm text-slate-700 mt-1">{wellbeingSignal}</p>
            </div>
          </div>
        </div>
      )}

      {/* Time Range Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          View:
        </span>
        {['week', 'month', 'term'].map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              timeRange === range
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {range.charAt(0).toUpperCase() + range.slice(1)}
          </button>
        ))}
      </div>

      {/* Stats Cards */}
      {filteredLogs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Avg Mood */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Avg Mood
              </span>
              <Heart size={16} className="text-red-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {stats.avgMood ? stats.avgMood.toFixed(1) : 'N/A'}
              <span className="text-sm text-slate-400 font-normal ml-1">/5</span>
            </div>
            <p className="text-xs text-slate-500">
              {filteredLogs.length} log{filteredLogs.length !== 1 ? 's' : ''} recorded
            </p>
          </div>

          {/* Avg Energy */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Avg Energy
              </span>
              <TrendingUp size={16} className="text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {stats.avgEnergy ? stats.avgEnergy.toFixed(1) : 'N/A'}
              <span className="text-sm text-slate-400 font-normal ml-1">/5</span>
            </div>
            <p className="text-xs text-slate-500">
              Trend: <span className="font-semibold capitalize">{stats.trend}</span>
            </p>
          </div>

          {/* Risk Flag */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Risk Events
              </span>
              <AlertCircle
                size={16}
                className={stats.riskCount > 0 ? 'text-red-500' : 'text-green-500'}
              />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {stats.riskCount}
              <span className="text-sm text-slate-400 font-normal ml-1">low entries</span>
            </div>
            <p className="text-xs text-slate-500">
              {stats.riskCount > 0
                ? 'Consider lighter load or support'
                : 'No recent risk signals'}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center space-y-2">
          <Calendar className="mx-auto text-slate-400" size={32} />
          <h3 className="font-semibold text-slate-700">No Data Yet</h3>
          <p className="text-sm text-slate-500">
            Log your wellbeing using the "End Day" debrief to start tracking trends.
          </p>
        </div>
      )}

      {/* Recent Entries */}
      {filteredLogs.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Recent Entries</h3>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {filteredLogs.slice(0, 10).map((log, idx) => (
              <div
                key={log.id || idx}
                className="bg-white border border-slate-200 rounded-lg p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-900">
                        Mood: <span className="text-slate-600">{log.mood || 'N/A'}</span> •
                        Energy: <span className="text-slate-600">{log.energy || 'N/A'}</span>
                      </div>
                      {log.summary && (
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">{log.summary}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 whitespace-nowrap ml-2">
                    {log.date
                      ? new Date(log.date).toLocaleDateString('en-GB', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'No date'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
