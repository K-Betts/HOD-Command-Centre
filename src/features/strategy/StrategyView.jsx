import React, { useState, useEffect } from 'react';
import { Map, Lightbulb, AlertTriangle, CheckCircle2, Loader2, Sparkles, PlusCircle, ClipboardList, Layers, Trash2, Calendar } from 'lucide-react';
import { useContextData } from '../../hooks/useContextData';
import { useStrategy } from '../../hooks/useStrategy';
import { analyzeProjectWhy } from '../../services/ai';
import { useStrategyNotes } from '../../hooks/useStrategyNotes';
import { useToast } from '../../context/ToastContext';
import { useProjects } from '../../hooks/useProjects';
import { BudgetView } from '../budget/BudgetView';
import { BrainCard } from '../../components/ui/BrainCard';
import { PriorityBoard } from './PriorityBoard';
import { TermHorizon } from './TermHorizon';
import { DepartmentCalendar } from './DepartmentCalendar';

export function StrategyView({ user, staff = [] }) {
  const { context, updateContext } = useContextData(user);
  const { plan, savePriorities, saveSchoolPriorities } = useStrategy(user);
  const { notes, deleteNote } = useStrategyNotes(user);
  const { addToast } = useToast();
  const { activeProjects, ideaProjects, completedProjects, addProject, updateProject, deleteProject } = useProjects(user);
  const statusOptions = ['ACTIVE', 'IDEA', 'COMPLETED', 'ARCHIVED'];
  const [projectForm, setProjectForm] = useState({
    title: '',
    strategicWhy: '',
    owner: '',
    expectedResult: '',
    status: 'ACTIVE',
  });
  const [whyFeedback, setWhyFeedback] = useState(null);
  const [validatingWhy, setValidatingWhy] = useState(false);
  const whyIsStrong =
    !!whyFeedback &&
    (((whyFeedback.strength || '').toLowerCase() === 'strong') ||
      (whyFeedback.verdict || '').toLowerCase() === 'purpose-led' ||
      (whyFeedback.score || 0) >= 4);
  const [activeTab, setActiveTab] = useState('priorities');
  const [ideaInput, setIdeaInput] = useState('');
  const [whyStatement, setWhyStatement] = useState('');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync editable WHY text with saved context
    setWhyStatement(context?.whyStatement || '');
  }, [context?.whyStatement]);

  const handleSaveProject = async () => {
    if (!projectForm.title.trim() || !projectForm.strategicWhy.trim()) {
      addToast('error', 'Project title and Strategic Why are required.');
      return;
    }
    const payload = {
      ...projectForm,
      title: projectForm.title.trim(),
      strategicWhy: projectForm.strategicWhy.trim(),
      status: (projectForm.status || 'ACTIVE').toUpperCase(),
      whyVerdict: whyFeedback?.verdict || 'result-led',
      whyScore: whyFeedback?.score || 0,
      whyCoachNote: whyFeedback?.reason || '',
      whyRewrite: whyFeedback?.rewrite || '',
      whyHeadline: whyFeedback?.headline || '',
    };
    await addProject(payload);
    setProjectForm({
      title: '',
      strategicWhy: '',
      owner: '',
      expectedResult: '',
      status: 'ACTIVE',
    });
    setWhyFeedback(null);
    addToast('success', 'Project captured with a validated WHY.');
  };

  const handleQuickAddIdea = async () => {
    const title = ideaInput.trim();
    if (!title) return;
    await addProject({
      title,
      strategicWhy: `Idea: ${title}`,
      status: 'IDEA',
    });
    setIdeaInput('');
    addToast('success', 'Idea added to the backlog.');
  };

  const promoteIdea = async (projectId) => {
    await updateProject(projectId, { status: 'ACTIVE' });
    addToast('success', 'Idea promoted to active project.');
  };

  const completeProject = async (projectId) => {
    await updateProject(projectId, { status: 'COMPLETED' });
    addToast('success', 'Project marked complete.');
  };

  const archiveProject = async (projectId) => {
    await updateProject(projectId, { status: 'ARCHIVED' });
    addToast('success', 'Project archived.');
  };

  const handleWhyBlur = async () => {
    const trimmedWhy = projectForm.strategicWhy.trim();
    if (!trimmedWhy) {
      setWhyFeedback(null);
      return;
    }
    setValidatingWhy(true);
    const feedback = await analyzeProjectWhy(trimmedWhy, projectForm.title);
    if (projectForm.strategicWhy.trim() === trimmedWhy) {
      setWhyFeedback(feedback);
    }
    setValidatingWhy(false);
  };

  const handleSaveWhyStatement = async () => {
    await updateContext({ ...(context || {}), whyStatement: whyStatement.trim() });
    addToast('success', 'WHY statement updated');
  };

  const tabs = [
    { id: 'priorities', label: 'Priorities (SIP)', icon: ClipboardList },
    { id: 'calendar', label: 'Half-Term Overview', icon: Calendar },
    { id: 'projects', label: 'Projects', icon: Layers },
    { id: 'budget', label: 'Budget', icon: Lightbulb },
  ];

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
              Strategy
            </p>
            <h2 className="text-2xl font-bold text-slate-900">Strategy Control Room</h2>
            <p className="text-sm text-slate-500">
              Anchor the WHY, surface priorities, and map the horizon across SIP, projects, and budget.
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-2 flex items-center gap-2 flex-wrap">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-2xl text-sm font-semibold flex items-center gap-2 transition-all ${
                    isActive ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pb-4">
        {activeTab === 'priorities' && (
          <div className="space-y-6">
            <div className="sticky top-0 z-20 bg-slate-50 pt-4 -mt-4">
              <TermHorizon user={user} />
            </div>

          <BrainCard className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border-slate-800 shadow-lg">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-200">Why</p>
                <h3 className="text-2xl font-bold">Why this matters</h3>
                <p className="text-sm text-slate-200/80 mt-2">
                  {whyStatement
                    ? whyStatement
                    : 'Set your strategic WHY to anchor priorities and coaching.'}
                </p>
              </div>
              <button
                onClick={handleSaveWhyStatement}
                className="px-4 py-2 rounded-full bg-white/10 border border-white/30 text-sm font-semibold hover:bg-white/20 transition-colors"
              >
                Save WHY
              </button>
            </div>
            <textarea
              value={whyStatement}
              onChange={(e) => setWhyStatement(e.target.value)}
              className="mt-4 w-full p-4 rounded-2xl bg-white/10 border border-white/20 text-sm text-white placeholder:text-slate-200/70 focus:ring-2 focus:ring-emerald-300/60 outline-none"
              rows={3}
              placeholder="e.g. We believe literacy unlocks equity, so every lesson builds confident readers."
            />
          </BrainCard>

          <PriorityBoard
            user={user}
            staff={staff}
            plan={plan}
            savePriorities={savePriorities}
            saveSchoolPriorities={saveSchoolPriorities}
            context={context}
            updateContext={updateContext}
          />

          <BrainCard className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Map className="text-indigo-600" size={24} />
              <h3 className="text-xl font-bold text-slate-900">Strategy Notes (AI)</h3>
            </div>
            <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-3">
              {notes.length === 0 && (
                <div className="text-slate-400 italic text-sm">
                  No strategy notes captured yet. Add via Brain Dump or Horizon analysis.
                </div>
              )}
              {notes.map((n) => (
                <div key={n.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50 relative group">
                  <button
                    type="button"
                    onClick={() => deleteNote(n.id)}
                    className="absolute top-3 right-3 p-1.5 rounded-full border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 opacity-0 group-hover:opacity-100 transition"
                    title="Delete note"
                  >
                    <Trash2 size={12} />
                  </button>
                  <div className="flex justify-between items-center mb-1 pr-6">
                    <span className="text-xs font-bold uppercase text-indigo-600">
                      {n.theme || 'General'}
                    </span>
                    <span className="text-[11px] text-slate-400">{n.createdAt?.toDate ? n.createdAt.toDate().toISOString().slice(0,10) : n.date || ''}</span>
                  </div>
                  <div className="text-slate-700 text-sm leading-relaxed">{n.note}</div>
                  {n.linkedTo && (
                    <div className="text-[11px] text-slate-500 mt-1">Linked to: {n.linkedTo}</div>
                  )}
                </div>
              ))}
            </div>
          </BrainCard>
        </div>
      )}

      {activeTab === 'projects' && (
        <div className="space-y-6">
          <BrainCard className="p-6 space-y-6">
            <div className="flex items-center gap-3">
              <Sparkles className="text-indigo-500" size={22} />
              <div>
                <h3 className="font-bold text-slate-900 text-2xl">Active Projects</h3>
                <p className="text-sm text-slate-500">
                  Validate the WHY and keep live projects visible.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                    Project Title
                  </label>
                  <input
                    value={projectForm.title}
                    onChange={(e) => setProjectForm((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-100 text-sm"
                    placeholder="e.g. KS3 Literacy Lift"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                      Owner
                    </label>
                    <select
                      value={projectForm.owner}
                      onChange={(e) =>
                        setProjectForm((prev) => ({ ...prev, owner: e.target.value }))
                      }
                      className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm"
                    >
                      <option value="">Unassigned</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                      Status
                    </label>
                    <select
                      value={projectForm.status}
                      onChange={(e) =>
                        setProjectForm((prev) => ({ ...prev, status: e.target.value }))
                      }
                      className="w-full p-3 rounded-xl border border-slate-200 bg-white text-sm"
                    >
                      {statusOptions.map((opt) => (
                        <option key={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                    Expected Result (optional)
                  </label>
                  <input
                    value={projectForm.expectedResult}
                    onChange={(e) =>
                      setProjectForm((prev) => ({ ...prev, expectedResult: e.target.value }))
                    }
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-100 text-sm"
                    placeholder="e.g. +8% reading ages"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
                    Strategic Why *
                  </label>
                  <textarea
                    value={projectForm.strategicWhy}
                    onChange={(e) =>
                      setProjectForm((prev) => ({ ...prev, strategicWhy: e.target.value }))
                    }
                    onBlur={handleWhyBlur}
                    className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-100 text-sm min-h-[120px]"
                    placeholder="State the belief and impact, not just the target."
                  />
                  <div className="mt-2 text-sm flex items-center gap-2 min-h-[24px]">
                    {validatingWhy ? (
                      <>
                        <Loader2 size={16} className="text-amber-600 animate-spin" />
                        <span className="text-amber-700 font-semibold">Running the Sinek check...</span>
                      </>
                    ) : whyFeedback ? (
                      <>
                        {whyIsStrong ? (
                          <CheckCircle2 size={16} className="text-emerald-600" />
                        ) : (
                          <AlertTriangle size={16} className="text-amber-600" />
                        )}
                        <span
                          className={`font-medium ${
                            whyIsStrong ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {whyFeedback.message ||
                            (whyIsStrong
                              ? "Great 'Why' statement!"
                              : 'This sounds like a result, not a purpose. Try focusing on the belief behind it.')}
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-400">
                        Blur this field to see if it starts with WHY.
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleSaveProject}
                  className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors disabled:opacity-60"
                >
                  Save Project
                </button>
              </div>

              <div className="lg:col-span-2 space-y-3">
                {activeProjects.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                    No active projects yet. Add one on the left.
                  </div>
                )}
                {activeProjects.map((proj) => (
                  <BrainCard key={proj.id} className="p-4 border border-indigo-100">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-bold text-slate-900">{proj.title}</div>
                        <div className="text-xs text-slate-500 uppercase font-bold">{proj.status}</div>
                        {proj.owner && (
                          <div className="text-sm text-slate-600 mt-1">Owner: {proj.owner}</div>
                        )}
                        {proj.expectedResult && (
                          <div className="text-sm text-slate-600">Result: {proj.expectedResult}</div>
                        )}
                        <div className="text-sm text-slate-700 mt-2 line-clamp-3">
                          {proj.strategicWhy}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => completeProject(proj.id)}
                          className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold"
                        >
                          Mark Complete
                        </button>
                        <button
                          onClick={() => archiveProject(proj.id)}
                          className="px-3 py-1 rounded-lg bg-white text-slate-700 border border-slate-200 text-xs font-semibold"
                        >
                          Archive
                        </button>
                        <button
                          onClick={() => deleteProject(proj.id)}
                          className="px-3 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </BrainCard>
                ))}
                {completedProjects.length > 0 && (
                  <div className="text-xs text-slate-500">
                    Completed: {completedProjects.length} (hidden)
                  </div>
                )}
              </div>
            </div>
          </BrainCard>

          <BrainCard className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb className="text-amber-500" size={20} />
                <h3 className="text-lg font-bold text-slate-900">Idea Lab</h3>
              </div>
              <span className="text-xs text-slate-500 font-semibold">
                {ideaProjects.length} saved
              </span>
            </div>
            <div className="flex gap-2">
              <input
                value={ideaInput}
                onChange={(e) => setIdeaInput(e.target.value)}
                className="flex-1 p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-100 text-sm"
                placeholder="Capture a parking-lot idea..."
              />
              <button
                onClick={handleQuickAddIdea}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow hover:bg-indigo-700"
              >
                <PlusCircle size={16} /> Add Idea
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ideaProjects.length === 0 && (
                <div className="text-sm text-slate-500 italic">No ideas yet.</div>
              )}
              {ideaProjects.map((idea) => (
                <BrainCard key={idea.id} className="p-4">
                  <div className="text-sm font-bold text-slate-900">{idea.title}</div>
                  <div className="text-xs text-slate-500 uppercase font-bold mt-1">
                    {idea.status}
                  </div>
                  <div className="text-sm text-slate-600 mt-2 line-clamp-3">
                    {idea.strategicWhy}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => promoteIdea(idea.id)}
                      className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold"
                    >
                      Promote to Active
                    </button>
                    <button
                      onClick={() => deleteProject(idea.id)}
                      className="px-3 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold"
                    >
                      Delete
                    </button>
                  </div>
                </BrainCard>
              ))}
            </div>
          </BrainCard>
        </div>
      )}

      {activeTab === 'calendar' && (
        <DepartmentCalendar user={user} />
      )}

      {activeTab === 'budget' && (
        <BrainCard className="p-4">
          <BudgetView user={user} />
        </BrainCard>
      )}
    </div>
    </div>
  );
}
