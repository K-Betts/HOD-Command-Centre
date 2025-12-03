import React, { useEffect, useMemo, useState } from 'react';
import {
  Shield,
  HeartHandshake,
  Scale,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ClipboardList,
  Lightbulb,
  ChevronRight,
} from 'lucide-react';
import { useStaff } from '../../hooks/useStaff';
import { useBuckBalance } from '../../hooks/useBuckBalance';
import { useProjects } from '../../hooks/useProjects';
import { useLeadershipSettings } from '../../hooks/useLeadershipSettings';
import { useToast } from '../../context/ToastContext';

export default function LeadershipView({ user, staff = [], setActiveTab }) {
  const { logInteraction } = useStaff(user);
  const { balanceByStaff, riskFlags } = useBuckBalance(user, staff);
  const { projects } = useProjects(user);
  const { settings, updateLeadershipSettings } = useLeadershipSettings(user);
  const { addToast } = useToast();
  const [quickLog, setQuickLog] = useState({
    staffId: '',
    buckTag: 'Support',
    summary: '',
  });
  const [savingIntent, setSavingIntent] = useState(false);
  const [weeklyIntent, setWeeklyIntent] = useState('');

  const todayIso = new Date().toISOString().slice(0, 10);

  const staffOptions = useMemo(() => staff.filter((s) => s.memberType !== 'stakeholder'), [staff]);

  useEffect(() => {
    setWeeklyIntent(settings.weeklyIntent || '');
  }, [settings.weeklyIntent]);

  const handleLog = async () => {
    if (!quickLog.staffId || !quickLog.summary.trim()) {
      addToast('error', 'Pick a person and add a note.');
      return;
    }
    const target = staffOptions.find((s) => s.id === quickLog.staffId);
    const type = quickLog.buckTag === 'Challenge' ? 'Concern' : 'Praise';
    await logInteraction(quickLog.staffId, {
      date: todayIso,
      summary: quickLog.summary.trim(),
      type,
      source: 'leadership',
      buckTag: quickLog.buckTag,
      staffName: target?.name || '',
    });
    setQuickLog((prev) => ({ ...prev, summary: '' }));
    addToast('success', `${quickLog.buckTag} logged for ${target?.name || 'staff'}.`);
  };

  const handleSaveIntent = async () => {
    setSavingIntent(true);
    await updateLeadershipSettings({ weeklyIntent });
    setSavingIntent(false);
    addToast('success', 'Weekly intent saved.');
  };

  const sortedBalance = useMemo(() => {
    return staffOptions
      .map((member) => {
        const stats = balanceByStaff[member.id];
        return {
          id: member.id,
          name: member.name,
          role: member.role,
          counts: stats?.counts || { support: 0, challenge: 0, admin: 0 },
          risk: stats?.risk || { level: 'none', message: '' },
        };
      })
      .sort((a, b) => {
        const rA = a.risk.level === 'high' ? 2 : a.risk.level === 'medium' ? 1 : 0;
        const rB = b.risk.level === 'high' ? 2 : b.risk.level === 'medium' ? 1 : 0;
        if (rA !== rB) return rB - rA;
        return (b.counts.support + b.counts.challenge) - (a.counts.support + a.counts.challenge);
      });
  }, [staffOptions, balanceByStaff]);

  const verdictStyle = (verdict) =>
    verdict?.toLowerCase() === 'purpose-led'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : 'bg-amber-50 text-amber-700 border-amber-100';

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-white to-indigo-50 border border-gray-100 rounded-[2rem] p-8 shadow-sm flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-indigo-600 text-white shadow-lg">
            <Shield size={28} />
          </div>
          <div>
            <div className="text-xs font-bold uppercase text-gray-500 tracking-wider">
              Leadership Engine
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Lead with balance and purpose.</h2>
            <p className="text-gray-600">
              Track challenge vs support, surface at-risk staff, and validate every project&apos;s WHY.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setActiveTab?.('staff')}
            className="px-4 py-3 rounded-xl bg-white border border-gray-200 text-sm font-bold text-gray-700 hover:border-indigo-200"
          >
            Open Staff Room
          </button>
          <button
            onClick={() => setActiveTab?.('strategy')}
            className="px-4 py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold shadow-md hover:bg-indigo-700"
          >
            Review Projects
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold uppercase text-gray-500">Quick Log</div>
              <div className="flex gap-2 text-[11px] font-semibold text-gray-500">
                <BuckPill label="Support" active={quickLog.buckTag === 'Support'} onClick={() => setQuickLog((p) => ({ ...p, buckTag: 'Support' }))} icon={HeartHandshake} />
                <BuckPill label="Challenge" active={quickLog.buckTag === 'Challenge'} onClick={() => setQuickLog((p) => ({ ...p, buckTag: 'Challenge' }))} icon={Scale} />
              </div>
            </div>
            <select
              value={quickLog.staffId}
              onChange={(e) => setQuickLog((p) => ({ ...p, staffId: e.target.value }))}
              className="w-full p-3 rounded-xl border border-gray-200 bg-white text-sm mb-3"
            >
              <option value="">Select staff</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.role}
                </option>
              ))}
            </select>
            <textarea
              value={quickLog.summary}
              onChange={(e) => setQuickLog((p) => ({ ...p, summary: e.target.value }))}
              className="w-full p-3 rounded-xl border border-gray-200 text-sm mb-3 min-h-[90px]"
              placeholder="What did you just say or notice?"
            />
            <button
              onClick={handleLog}
              className="w-full py-3 rounded-xl bg-indigo-600 text-white text-sm font-bold shadow-sm hover:bg-indigo-700"
            >
              Log {quickLog.buckTag}
            </button>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold uppercase text-gray-500">Weekly Intent</div>
              <Sparkles className="text-amber-500" size={16} />
            </div>
            <textarea
              value={weeklyIntent}
              onChange={(e) => setWeeklyIntent(e.target.value)}
              className="w-full p-3 rounded-xl border border-gray-200 text-sm min-h-[80px]"
              placeholder="Example: Lift support touchpoints for ECTs before mock week."
            />
            <button
              type="button"
              onClick={handleSaveIntent}
              className="mt-3 w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800"
            >
              {savingIntent ? 'Saving...' : 'Save Intent'}
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase text-gray-500">Buck Balance</div>
              <div className="text-lg font-bold text-gray-900">Challenge / Support radar</div>
            </div>
            <ClipboardList className="text-indigo-600" size={20} />
          </div>
          <div className="space-y-2 max-h-[520px] overflow-y-auto custom-scrollbar">
            {sortedBalance.length === 0 && (
              <div className="text-sm text-gray-400 italic">No staff yet.</div>
            )}
            {sortedBalance.map((row) => (
              <div
                key={row.id}
                className="p-3 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-bold text-gray-800 text-sm">{row.name}</div>
                  <div className="text-[11px] text-gray-500 uppercase">{row.role}</div>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-bold">
                  <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                    S {row.counts.support}
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-100">
                    C {row.counts.challenge}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {row.risk.level !== 'none' ? (
                    <RiskTag level={row.risk.level} message={row.risk.message} />
                  ) : (
                    <span className="text-[11px] text-gray-400">Balanced</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs font-bold uppercase text-gray-500">
                  Safety Monitor
                </div>
                <div className="font-bold text-gray-900">At-risk staff</div>
              </div>
              <Shield className="text-emerald-600" size={18} />
            </div>
            {riskFlags.length === 0 ? (
              <div className="text-sm text-gray-400 italic">
                No risk alerts. Keep balancing challenge and support.
              </div>
            ) : (
              <div className="space-y-2">
                {riskFlags.slice(0, 5).map((flag) => (
                  <div
                    key={flag.staffId}
                    className="p-3 rounded-xl border border-gray-100 bg-gray-50"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-gray-800 text-sm">{flag.staffName}</div>
                        <div className="text-[11px] text-gray-500 uppercase">
                          {flag.role || 'Staff'}
                        </div>
                      </div>
                      <RiskTag level={flag.risk.level} />
                    </div>
                    <div className="text-xs text-gray-600 mt-1 flex gap-1 items-start">
                      <AlertTriangle size={12} className="text-amber-600 mt-0.5" />
                      <span>{flag.risk.message}</span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1">
                      Support {flag.counts.support || 0} • Challenge {flag.counts.challenge || 0}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setActiveTab?.('staff')}
              className="mt-3 flex items-center gap-1 text-xs font-bold text-indigo-700"
            >
              Open detailed view <ChevronRight size={14} />
            </button>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs font-bold uppercase text-gray-500">
                  Sinek Validator
                </div>
                <div className="font-bold text-gray-900">Project WHY verdicts</div>
              </div>
              <Lightbulb className="text-amber-500" size={18} />
            </div>
            {projects.length === 0 ? (
              <div className="text-sm text-gray-400 italic">No projects captured yet.</div>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto custom-scrollbar">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl border border-gray-100 bg-gray-50 flex items-start gap-3"
                  >
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${verdictStyle(p.whyVerdict)}`}>
                      {(p.whyVerdict || 'result-led').replace('-', ' ')}
                      {p.whyScore ? ` • ${p.whyScore}/5` : ''}
                    </span>
                    <div className="flex-1">
                      <div className="font-bold text-gray-800 text-sm">{p.title}</div>
                      <div className="text-[11px] text-gray-500 uppercase">
                        {p.owner || 'Unassigned'} • {p.status || 'Not Started'}
                      </div>
                      <div className="text-xs text-gray-700 mt-1 line-clamp-2">
                        {p.strategicWhy}
                      </div>
                      {p.whyHeadline && (
                        <div className="text-[11px] text-indigo-700 font-semibold mt-1">
                          {p.whyHeadline}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setActiveTab?.('strategy')}
              className="mt-3 text-xs font-bold text-indigo-700 flex items-center gap-1"
            >
              Refine WHYs <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BuckPill({ label, active, onClick, icon: Icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold transition-all ${
        active ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-white text-gray-500 border-gray-200'
      }`}
    >
      <Icon size={12} />
      {label}
    </button>
  );
}

function RiskTag({ level, message }) {
  const high = level === 'high';
  const medium = level === 'medium';
  if (!high && !medium) {
    return (
      <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
        Balanced
      </span>
    );
  }
  return (
    <span
      className={`px-2 py-1 rounded-full text-[10px] font-bold border ${
        high ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-amber-50 text-amber-700 border-amber-100'
      }`}
      title={message}
    >
      {high ? 'High risk' : 'Watch'}
    </span>
  );
}
