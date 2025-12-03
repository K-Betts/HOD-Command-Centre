import React, { useMemo, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { devilAdvocateCritique } from '../../services/ai';
import { useStrategy } from '../../hooks/useStrategy';
import { useStaff } from '../../hooks/useStaff';
import { useContextData } from '../../hooks/useContextData';
import { useWellbeing } from '../../hooks/useWellbeing';

export function DevilsAdvocate({ user }) {
  const [idea, setIdea] = useState('');
  const [critique, setCritique] = useState('');
  const [loading, setLoading] = useState(false);
  const { plan } = useStrategy(user);
  const { staff } = useStaff(user);
  const { context } = useContextData(user);
  const { wellbeingLogs } = useWellbeing(user);

  const overloadedStaff = useMemo(() => {
    return (staff || []).filter((s) => (s.tasksOverdue || 0) > 5).map((s) => s.name);
  }, [staff]);

  const upcomingEvents = useMemo(
    () => (context?.events || []).slice(0, 5),
    [context?.events]
  );

  const wellbeingSignal = useMemo(() => {
    if (!Array.isArray(wellbeingLogs) || wellbeingLogs.length === 0) return null;
    const lastFive = wellbeingLogs.slice(0, 5);
    const scores = lastFive
      .map((log) => normalizeEnergy(log.energy || log.energyLevel))
      .filter((v) => typeof v === 'number');
    if (!scores.length) return null;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return avg;
  }, [wellbeingLogs]);

  const handleProcess = async () => {
    if (!idea) return;
    setLoading(true);
    const res = await devilAdvocateCritique(idea, {
      priorities: plan?.priorities || [],
      themes: plan?.themes || [],
      goals: (context?.goals || []).map((g) => g.title || g.goal || g.name).filter(Boolean),
      overloadedStaff,
      upcomingEvents,
      wellbeingScore: wellbeingSignal,
      whyStatement: context?.whyStatement || '',
    });
    setCritique(res);
    setLoading(false);
  };

  return (
    <div className="h-[calc(100vh-140px)] bg-white rounded-[2.5rem] shadow-sm border border-gray-200 overflow-hidden flex flex-col">
      <div className="bg-gray-50 p-6 border-b border-gray-100 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
          <ShieldAlert size={24} />
        </div>
        <div>
          <h3 className="font-bold text-gray-800 text-lg">The Idea Refiner</h3>
          <p className="text-gray-500 text-sm">
            Pitch an idea. I will respond like a supportive SLT partner—probing WHY, wellbeing impact, and alignment to school/department priorities.
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {critique && (
          <div className="flex gap-4 animate-in fade-in slide-in-from-left-4">
            <div className="w-10 h-10 rounded-full bg-gray-900 shrink-0 flex items-center justify-center text-white font-bold text-xs">
              AI
            </div>
            <div className="bg-gray-100 p-6 rounded-2xl rounded-tl-none max-w-2xl text-gray-700 leading-relaxed whitespace-pre-wrap">
              {critique}
            </div>
          </div>
        )}
        <div className="flex gap-4 flex-row-reverse">
          <div className="w-10 h-10 rounded-full bg-indigo-600 shrink-0 flex items-center justify-center text-white font-bold text-xs">
            ME
          </div>
          <div className="bg-indigo-600 text-white p-6 rounded-2xl rounded-tr-none max-w-2xl leading-relaxed">
            {idea || '...'}
          </div>
        </div>
      </div>
      <div className="p-6 bg-white border-t border-gray-100">
        <div className="flex gap-4 max-w-4xl mx-auto">
          <input
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            className="flex-1 p-4 rounded-2xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-gray-100 outline-none"
            placeholder="Type your proposal here..."
          />
          <button
            onClick={handleProcess}
            disabled={!idea || loading}
            className="px-8 bg-gray-900 text-white rounded-2xl font-bold hover:bg-gray-800 transition-all"
          >
            {loading ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

function normalizeEnergy(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower.includes('high')) return 9;
    if (lower.includes('med')) return 6;
    if (lower.includes('low')) return 3;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}
