import React, { useMemo, useState } from 'react';
import { Mail, Sparkles, ListChecks, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useTasks } from '../../hooks/useTasks';
import { useContextData } from '../../hooks/useContextData';
import { generateWeeklyEmail } from '../../services/ai';

function formatDeadline(task) {
  const date = task.dueDate
    ? format(new Date(task.dueDate), 'yyyy-MM-dd')
    : 'No date';
  return {
    title: task.title || 'Task',
    date,
    owner: task.assignee || '',
  };
}

export function WeeklyEmailGenerator({ user }) {
  const { tasks } = useTasks(user);
  const { context } = useContextData(user);

  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [cpdAgendaRaw, setCpdAgendaRaw] = useState('');
  const [deptAgendaRaw, setDeptAgendaRaw] = useState('');
  const [emailOutput, setEmailOutput] = useState('');
  const [loading, setLoading] = useState(false);

  const deadlines = useMemo(() => {
    return (tasks || [])
      .filter((t) => t.status !== 'done' && t.dueDate)
      .map(formatDeadline)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 8);
  }, [tasks]);

  const events = useMemo(() => {
    return Array.isArray(context?.events) ? context.events.slice(0, 8) : [];
  }, [context?.events]);

  const missingFields = useMemo(() => {
    const missing = [];
    if (!welcomeMessage.trim()) missing.push('Welcome Message');
    if (!cpdAgendaRaw.trim()) missing.push('CPD Session Agenda');
    if (!deptAgendaRaw.trim()) missing.push('Department Meeting Agenda');
    return missing;
  }, [welcomeMessage, cpdAgendaRaw, deptAgendaRaw]);

  const handleGenerate = async () => {
    setLoading(true);
    const draft = await generateWeeklyEmail(
      { deadlines, events },
      { welcomeMessage, cpdAgendaRaw, deptAgendaRaw }
    );
    setEmailOutput(draft);
    setLoading(false);
  };

  return (
    <div className="h-full flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Mail className="text-indigo-600" size={20} /> Weekly Email Generator
        </h2>
        <div className="text-xs font-mono text-gray-500">
          Missing: {missingFields.length ? missingFields.join(', ') : 'None'}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 flex-1">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-4 xl:col-span-2 flex flex-col">
          <div>
            <label className="text-xs font-bold uppercase text-gray-500 mb-2 block">
              Welcome Message
            </label>
            <textarea
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              className="w-full p-4 rounded-2xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none"
              rows={2}
              placeholder="e.g., Thank you for the push on mocks this week..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase text-gray-500 mb-2 block">
                CPD Session Agenda (rough notes)
              </label>
              <textarea
                value={cpdAgendaRaw}
                onChange={(e) => setCpdAgendaRaw(e.target.value)}
                className="w-full p-4 rounded-2xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none"
                rows={4}
                placeholder="Bullet rough items; we will refine them."
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-gray-500 mb-2 block">
                Department Meeting Agenda (rough notes)
              </label>
              <textarea
                value={deptAgendaRaw}
                onChange={(e) => setDeptAgendaRaw(e.target.value)}
                className="w-full p-4 rounded-2xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none"
                rows={4}
                placeholder="Budget, staffing, celebrations..."
              />
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="self-start px-5 py-3 rounded-2xl bg-indigo-600 text-white font-bold shadow-md shadow-indigo-200 hover:bg-indigo-700 transition disabled:opacity-60 flex items-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
            Generate Email
          </button>
        </div>

        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 space-y-4 flex flex-col">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
              Auto-Pulled Deadlines
            </h3>
            <ListChecks size={16} className="text-indigo-600" />
          </div>
          <div className="space-y-2 text-sm text-gray-700 flex-1 overflow-y-auto custom-scrollbar">
            {deadlines.length === 0 && (
              <div className="text-xs text-gray-400 italic">No upcoming deadlines found.</div>
            )}
            {deadlines.map((d, idx) => (
              <div
                key={`${d.title}-${d.date}-${idx}`}
                className="p-3 rounded-xl border border-gray-100 bg-gray-50"
              >
                <div className="font-semibold">{d.title}</div>
                <div className="text-xs text-gray-500">
                  {d.date} {d.owner ? `• ${d.owner}` : ''}
                </div>
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-400">
            We pull tasks with due dates and current context events.
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 flex-1">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
            Draft Email
          </h3>
          <span className="text-xs font-mono text-gray-400">
            {loading ? 'Generating…' : emailOutput ? 'Draft ready' : 'Awaiting input'}
          </span>
        </div>
        <div className="h-full bg-gray-50 rounded-2xl border border-gray-100 p-4 overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap">
          {emailOutput || 'Fill the fields and click Generate to see the email.'}
        </div>
      </div>
    </div>
  );
}
