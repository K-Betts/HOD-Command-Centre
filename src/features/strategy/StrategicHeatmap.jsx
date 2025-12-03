import React from 'react';
import { BarChart3, AlertTriangle, CheckCircle2, Activity } from 'lucide-react';
import { useTasks } from '../../hooks/useTasks';

export function StrategicHeatmap({ user }) {
  const { weeklyStrategySplit } = useTasks(user);

  const strategyRatio = weeklyStrategySplit?.strategyRatio || 0;
  const opsRatio = weeklyStrategySplit?.operationalRatio || 0;
  const counts = weeklyStrategySplit?.counts || { strategic: 0, operational: 0, total: 0 };
  const window = weeklyStrategySplit?.window || {};

  const strategyPct = Math.max(0, Math.min(100, Math.round(strategyRatio * 100)));
  const opsWidth = Math.max(0, 100 - strategyPct);
  const opsLabel = Math.max(0, Math.min(100, Math.round(opsRatio * 100) || opsWidth));

  const tone =
    strategyRatio < 0.2 ? 'warning' : strategyRatio > 0.5 ? 'positive' : 'neutral';
  const feedbackText =
    tone === 'warning'
      ? 'Caught in the weeds? Try to pin one Strategic Task for tomorrow.'
      : tone === 'positive'
      ? 'High strategic impact this week.'
      : 'Balanced flow. Keep one belief-led action each day.';

  const accentGradient =
    tone === 'warning'
      ? 'from-amber-400 to-orange-500'
      : tone === 'positive'
      ? 'from-emerald-500 to-teal-500'
      : 'from-indigo-500 to-sky-500';

  const feedbackClass =
    tone === 'warning'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : tone === 'positive'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-gray-50 text-gray-700 border-gray-200';

  const FeedbackIcon = tone === 'warning' ? AlertTriangle : tone === 'positive' ? CheckCircle2 : BarChart3;

  return (
    <div className="bg-white border border-gray-100 rounded-[2rem] p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs font-bold uppercase text-gray-500 tracking-wider">Strategy vs Ops</div>
          <div className="text-lg font-bold text-gray-900">This week&apos;s mirror</div>
        </div>
        <div className="text-[11px] font-mono text-gray-400">
          {window.start ? `${(window.start || '').slice(0, 10)} → ${(window.end || '').slice(0, 10)}` : 'Current week'}
        </div>
      </div>

      {counts.total === 0 ? (
        <div className="space-y-3">
          <div className="h-12 rounded-full bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center text-sm text-gray-500 shadow-inner">
            <Activity size={16} className="text-gray-400 mr-2" />
            No Data Yet — log a completion to light up this chart.
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-white border border-gray-200 text-gray-500">
              <span className="w-2 h-2 rounded-full bg-indigo-300"></span>
              0 strategic completions
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-white border border-gray-200 text-gray-500">
              <span className="w-2 h-2 rounded-full bg-gray-300"></span>
              0 ops completions
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="h-12 rounded-full bg-gray-100 overflow-hidden border border-gray-200 flex shadow-inner">
            <div
              style={{ width: `${strategyPct}%` }}
              className={`h-full bg-gradient-to-r ${accentGradient} text-white text-xs font-bold flex items-center justify-end pr-3 transition-[width] duration-500`}
            >
              {strategyPct >= 8 ? `${strategyPct}% Strategy` : null}
            </div>
            <div
              style={{ width: `${opsWidth}%` }}
              className="h-full bg-gray-200 text-gray-700 text-xs font-bold flex items-center pl-3 transition-[width] duration-500"
            >
              {opsWidth >= 8 ? `${opsLabel}% Ops` : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3 text-xs font-semibold">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              {counts.strategic} strategic completions
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100 text-gray-700">
              <span className="w-2 h-2 rounded-full bg-gray-400"></span>
              {counts.operational} ops completions
            </div>
          </div>

          <div className={`mt-4 p-3 rounded-xl border ${feedbackClass}`}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FeedbackIcon size={16} />
              <span>{feedbackText}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
