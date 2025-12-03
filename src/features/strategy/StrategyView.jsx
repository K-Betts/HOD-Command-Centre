import React, { useState, useEffect } from 'react';
import { Map, Target, Calendar as CalendarIcon, Trash2, Lightbulb, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useContextData } from '../../hooks/useContextData';
import { useStrategy } from '../../hooks/useStrategy';
import { analyzeContext, analyzeStrategicPlan, analyzeProjectWhy } from '../../services/ai';
import { useStrategyNotes } from '../../hooks/useStrategyNotes';
import { useToast } from '../../context/ToastContext';
import { useProjects } from '../../hooks/useProjects';
import { BudgetView } from '../budget/BudgetView';
import { BrainCard } from '../../components/ui/BrainCard';

export function StrategyView({ user, staff = [] }) {
  const { context, updateContext } = useContextData(user);
  const { plan, updatePlan } = useStrategy(user);
  const { notes, deleteNote } = useStrategyNotes(user);
  const { addToast } = useToast();
  const { projects, addProject, updateProject, deleteProject } = useProjects(user);
  const [calInput, setCalInput] = useState('');
  const [goalInput, setGoalInput] = useState('');
  const [dipInput, setDipInput] = useState('');
  const [isProcessingCal, setIsProcessingCal] = useState(false);
  const [isProcessingGoal, setIsProcessingGoal] = useState(false);
  const [isProcessingPlan, setIsProcessingPlan] = useState(false);
  const [planError, setPlanError] = useState('');
  const statusOptions = ['Not Started', 'In Flight', 'Blocked', 'Complete'];
  const [projectForm, setProjectForm] = useState({
    title: '',
    strategicWhy: '',
    owner: '',
    expectedResult: '',
    status: 'Not Started',
  });
  const [whyFeedback, setWhyFeedback] = useState(null);
  const [validatingWhy, setValidatingWhy] = useState(false);
  const whyIsStrong =
    !!whyFeedback &&
    (((whyFeedback.strength || '').toLowerCase() === 'strong') ||
      (whyFeedback.verdict || '').toLowerCase() === 'purpose-led' ||
      (whyFeedback.score || 0) >= 4);
  const [activeLens, setActiveLens] = useState('war');
  const [whyStatement, setWhyStatement] = useState('');

  useEffect(() => {
    if (plan.raw) setDipInput(plan.raw);
  }, [plan.raw]);

  useEffect(() => {
    setWhyStatement(context?.whyStatement || '');
  }, [context?.whyStatement]);

  const handleRemoveEvent = async (index) => {
    const next = (context.events || []).filter((_, idx) => idx !== index);
    await updateContext({ ...(context || {}), events: next });
  };

  const handleRemoveGoal = async (index) => {
    const next = (context.goals || []).filter((_, idx) => idx !== index);
    await updateContext({ ...(context || {}), goals: next });
  };

  const handleProcessCalendar = async () => {
    if (!calInput) return;
    setIsProcessingCal(true);
    const result = await analyzeContext(calInput, 'calendar');
    if (result && result.events) {
      await updateContext({ events: result.events });
      setCalInput('');
    }
    setIsProcessingCal(false);
  };

  const handleProcessGoals = async () => {
    if (!goalInput) return;
    setIsProcessingGoal(true);
    const result = await analyzeContext(goalInput, 'goals');
    if (result && result.goals) {
      await updateContext({ goals: result.goals });
      setGoalInput('');
    }
    setIsProcessingGoal(false);
  };

  const handleProcessPlan = async () => {
    if (!dipInput.trim()) return;
    setIsProcessingPlan(true);
    setPlanError('');
    const r = await analyzeStrategicPlan(dipInput);
    if (r?.milestones) {
      await updatePlan({
        milestones: r.milestones,
        themes: r.themes || [],
        raw: dipInput,
      });
      addToast('success', 'Horizon map updated');
    } else {
      setPlanError('Could not map the plan. Try again.');
      addToast('error', 'Strategy mapping failed');
    }
    setIsProcessingPlan(false);
  };

  const handleSaveProject = async () => {
    if (!projectForm.title.trim() || !projectForm.strategicWhy.trim()) {
      addToast('error', 'Project title and Strategic Why are required.');
      return;
    }
    const payload = {
      ...projectForm,
      title: projectForm.title.trim(),
      strategicWhy: projectForm.strategicWhy.trim(),
      status: projectForm.status || 'Not Started',
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
      status: 'Not Started',
    });
    setWhyFeedback(null);
    addToast('success', 'Project captured with a validated WHY.');
  };

  const handleUseRewrite = () => {
    if (whyFeedback?.rewrite) {
      setProjectForm((prev) => ({ ...prev, strategicWhy: whyFeedback.rewrite }));
    }
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

  const isBudgetLens = activeLens === 'budget';

  const handleSaveWhyStatement = async () => {
    await updateContext({ ...(context || {}), whyStatement: whyStatement.trim() });
    addToast('success', 'WHY statement updated');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            Strategy
          </p>
          <h2 className="text-2xl font-bold text-slate-900">War Room</h2>
          <p className="text-sm text-slate-500">
            Anchor the WHY, surface priorities, and map the horizon. Budget sits as a tab.
          </p>
        </div>
        <div className="bg-slate-100 border border-slate-200 rounded-full p-1 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveLens('war')}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
              isBudgetLens ? 'text-slate-500 hover:text-slate-800' : 'bg-white shadow text-slate-900'
            }`}
          >
            War Room
          </button>
          <button
            type="button"
            onClick={() => setActiveLens('budget')}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
              isBudgetLens ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Budget
          </button>
        </div>
      </div>

      {isBudgetLens ? (
        <BrainCard className="p-4">
          <BudgetView user={user} />
        </BrainCard>
      ) : (
        <>
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <BrainCard className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="text-emerald-600" size={20} />
                  <h3 className="text-lg font-bold text-slate-900">Priorities</h3>
                </div>
                <span className="text-xs text-slate-500 font-semibold">
                  {context.goals?.length || 0} live
                </span>
              </div>
              <div className="space-y-3">
                {context.goals?.length ? (
                  context.goals.map((g, i) => (
                    <div
                      key={`${g.title}-${i}`}
                      className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 flex items-start justify-between gap-3"
                    >
                      <div>
                        <div className="text-lg font-bold text-slate-900">{g.title}</div>
                        <div className="text-sm text-slate-600 leading-relaxed">
                          {g.focus}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveGoal(i)}
                        className="p-1.5 rounded-full border border-emerald-200 text-slate-500 hover:text-rose-600 hover:border-rose-200 transition"
                        title="Delete goal"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                    No strategic priorities yet. Paste them below to seed the board.
                  </div>
                )}
              </div>
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3 space-y-2">
                <textarea
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-200 outline-none text-sm bg-white"
                  placeholder="Paste annual goals..."
                  rows={3}
                />
                <button
                  onClick={handleProcessGoals}
                  disabled={!goalInput || isProcessingGoal}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-60"
                >
                  Capture priorities
                </button>
              </div>
            </BrainCard>

            <BrainCard className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="text-sky-600" size={20} />
                  <h3 className="text-lg font-bold text-slate-900">Calendar Signals</h3>
                </div>
                <span className="text-xs text-slate-500 font-semibold">
                  {context.events?.length || 0} captured
                </span>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                {context.events?.map((e, i) => (
                  <div
                    key={`${e.event}-${i}`}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex justify-between items-center gap-3"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{e.event}</div>
                      <div className="text-xs text-slate-500">{e.date}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveEvent(i)}
                      className="p-1.5 rounded-full border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 transition"
                      title="Delete event"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                {!context.events?.length && (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                    No dates extracted yet.
                  </div>
                )}
              </div>
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3 space-y-2 relative">
                <textarea
                  value={calInput}
                  onChange={(e) => setCalInput(e.target.value)}
                  className="w-full p-3 pr-16 rounded-xl border border-slate-200 focus:ring-2 focus:ring-sky-200 outline-none text-sm bg-white"
                  placeholder="Paste term dates..."
                  rows={3}
                />
                <ArrowRightIcon
                  onClick={handleProcessCalendar}
                  disabled={!calInput || isProcessingCal}
                  primary
                />
              </div>
            </BrainCard>

            <BrainCard className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Map className="text-indigo-600" size={20} />
                  <h3 className="text-lg font-bold text-slate-900">War Room Intake</h3>
                </div>
                <span className="text-xs text-slate-500 font-semibold">
                  Themes: {plan.themes?.length || 0}
                </span>
              </div>
              <p className="text-sm text-slate-600">
                Drop your plan text to update the horizon map and AI notes.
              </p>
              <textarea
                value={dipInput}
                onChange={(e) => setDipInput(e.target.value)}
                className="w-full p-4 rounded-2xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-indigo-200 outline-none text-sm min-h-[180px]"
                placeholder="e.g. Week 1: Launch KS3 reading initiative..."
              />
              <button
                onClick={handleProcessPlan}
                disabled={!dipInput || isProcessingPlan}
                className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors disabled:opacity-60"
              >
                {isProcessingPlan ? 'Mapping...' : 'Generate Horizon Map'}
              </button>
              {plan.themes?.length > 0 && (
                <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                  {plan.themes.map((theme) => (
                    <span key={theme} className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {theme}
                    </span>
                  ))}
                </div>
              )}
            </BrainCard>
          </div>

          <BrainCard className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Target className="text-indigo-600" size={24} />
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

          <BrainCard className="p-6 space-y-6">
            <div className="flex items-center gap-3">
              <Lightbulb className="text-amber-500" size={26} />
              <div>
                <h3 className="font-bold text-slate-900 text-2xl">Leadership Engine: Projects</h3>
                <p className="text-sm text-slate-500">
                  Start with WHY. The critical coach flags result-led statements and rewrites them.
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
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-bold uppercase text-amber-700">
                      Sinek Check
                    </div>
                    {validatingWhy && (
                      <div className="text-[11px] text-amber-700">Analysing...</div>
                    )}
                    {!validatingWhy && whyFeedback && (
                      <div
                        className={`text-[11px] font-bold px-2 py-1 rounded-lg border ${
                          (whyFeedback.verdict || '').toLowerCase() === 'purpose-led'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            : 'bg-amber-100 text-amber-700 border-amber-200'
                        }`}
                      >
                        {(whyFeedback.verdict || '').replace('-', ' ') || 'Result-led'}
                        {whyFeedback.score ? ` • ${whyFeedback.score}/5` : ''}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-amber-800 mt-1">
                    {whyFeedback
                      ? whyFeedback.reason || 'Keep it belief-led.'
                      : 'Type your WHY to get a critique and rewrite.'}
                  </p>
                  {whyFeedback?.rewrite && (
                    <div className="mt-3 bg-white border border-amber-100 rounded-xl p-3">
                      <div className="text-[11px] font-bold uppercase text-slate-500 mb-1">
                        Suggested rewrite
                      </div>
                      <div className="text-sm text-slate-800">{whyFeedback.rewrite}</div>
                      <button
                        type="button"
                        onClick={handleUseRewrite}
                        className="mt-2 text-xs font-bold text-amber-700 underline"
                      >
                        Use this rewrite
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSaveProject}
                  className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-md hover:bg-indigo-700 transition-colors"
                >
                  Save Project
                </button>
              </div>
              <div className="lg:col-span-2 space-y-3 max-h-[420px] overflow-y-auto custom-scrollbar">
                {projects.length === 0 && (
                  <div className="text-sm text-slate-400 italic">
                    No projects yet. Capture one with a belief-led WHY.
                  </div>
                )}
                {projects.map((project) => {
                  const verdictGood =
                    (project.whyVerdict || '').toString().toLowerCase() === 'purpose-led';
                  const verdictStyle = verdictGood
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    : 'bg-amber-50 text-amber-700 border-amber-100';
                  return (
                    <div
                      key={project.id}
                      className="p-4 rounded-2xl border border-slate-100 bg-slate-50 relative"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-bold uppercase text-slate-500">
                            {project.status || 'Not Started'}
                          </div>
                          <div className="text-lg font-bold text-slate-900">{project.title}</div>
                          <div className="text-xs text-slate-500">
                            Owner: {project.owner || 'Unassigned'}
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[11px] font-bold border ${verdictStyle}`}>
                          {verdictGood ? 'Purpose-led' : 'Result-led'}
                          {project.whyScore ? ` • ${project.whyScore}/5` : ''}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-slate-700 leading-relaxed">
                        {project.strategicWhy}
                      </div>
                      {project.expectedResult && (
                        <div className="text-[11px] text-slate-500 mt-1">
                          Result target: {project.expectedResult}
                        </div>
                      )}
                      {project.whyCoachNote && (
                        <div className="text-xs text-slate-500 mt-2 flex items-center gap-2">
                          <AlertTriangle size={12} className="text-amber-600" />
                          {project.whyCoachNote}
                        </div>
                      )}
                      {project.whyRewrite && project.whyRewrite !== project.strategicWhy && (
                        <div className="mt-2 bg-white border border-indigo-100 rounded-xl p-3 text-xs text-slate-700">
                          <div className="font-bold text-indigo-700 text-[11px] uppercase mb-1">
                            Coach rewrite
                          </div>
                          <div>{project.whyRewrite}</div>
                          <button
                            type="button"
                            onClick={() => updateProject(project.id, { strategicWhy: project.whyRewrite })}
                            className="mt-2 text-[11px] font-bold text-indigo-700 underline"
                          >
                            Apply rewrite
                          </button>
                        </div>
                      )}
                      <div className="mt-3 flex items-center gap-2">
                        <select
                          value={project.status || 'Not Started'}
                          onChange={(e) => updateProject(project.id, { status: e.target.value })}
                          className="p-2 rounded-lg border border-slate-200 text-xs bg-white"
                        >
                          {statusOptions.map((opt) => (
                            <option key={opt}>{opt}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => deleteProject(project.id)}
                          className="px-3 py-2 rounded-lg text-xs font-bold text-rose-600 bg-white border border-rose-100 hover:bg-rose-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </BrainCard>

          {planError && (
            <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 font-semibold">
              {planError}
            </div>
          )}

          <HorizonScanner
            plan={plan}
            dipInput={dipInput}
            setDipInput={setDipInput}
            onProcess={handleProcessPlan}
            isProcessing={isProcessingPlan}
          />
        </>
      )}
    </div>
  );
}

function HorizonScanner({ plan, dipInput, setDipInput, onProcess, isProcessing }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:col-span-2">
      <BrainCard className="p-8 flex flex-col">
        <h3 className="font-bold text-slate-900 text-xl mb-2 flex items-center gap-2">
          <Map className="text-indigo-600" /> Strategy Input
        </h3>
        <p className="text-slate-500 text-sm mb-4">
          Paste your termly plan. AI will map it.
        </p>
        <textarea
          value={dipInput}
          onChange={(e) => setDipInput(e.target.value)}
          className="flex-1 w-full p-6 rounded-2xl border border-slate-200 text-sm bg-slate-50 resize-none focus:ring-4 focus:ring-indigo-100 outline-none mb-4"
          placeholder="e.g. Week 1: Launch KS3 reading initiative..."
        />
        <button
          onClick={onProcess}
          disabled={!dipInput || isProcessing}
          className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-60"
        >
          {isProcessing ? 'Mapping...' : 'Generate Horizon Map'}
        </button>
      </BrainCard>
      <BrainCard className="p-8 flex flex-col overflow-hidden lg:col-span-2">
        <h3 className="font-bold text-slate-900 text-xl mb-6">15-Week Term Horizon</h3>
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
          {Array.from({ length: 15 }, (_, i) => i + 1).map((w) => {
            const actions = plan.milestones?.filter((m) => m.week === w) || [];
            const isCrunch = actions.length > 2;
            return (
              <div
                key={w}
                className={`flex gap-6 p-6 rounded-3xl border transition-all ${
                  isCrunch
                    ? 'bg-rose-50 border-rose-100'
                    : 'bg-white border-slate-100 hover:border-indigo-100'
                }`}
              >
                <div className="flex flex-col items-center justify-center w-16 border-r border-slate-200 pr-6">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Week
                  </span>
                  <span
                    className={`text-3xl font-black ${
                      isCrunch ? 'text-rose-500' : 'text-slate-300'
                    }`}
                  >
                    {w}
                  </span>
                </div>
                <div className="flex-1 space-y-2">
                  {actions.length > 0 ? (
                    actions.map((a, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 text-sm font-medium text-slate-700 bg-white/60 p-2 rounded-lg"
                      >
                        <div
                          className={`mt-1.5 w-1.5 h-1.5 rounded-full ${
                            isCrunch ? 'bg-rose-400' : 'bg-indigo-400'
                          } shrink-0`}
                        ></div>
                        {a.action}
                      </div>
                    ))
                  ) : (
                    <span className="text-slate-300 italic text-sm py-2 block">
                      No milestones
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </BrainCard>
    </div>
  );
}

function ArrowRightIcon({ onClick, disabled, primary, secondary }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`absolute bottom-3 right-3 p-2 rounded-xl ${
        primary
          ? 'bg-gray-900 text-white hover:bg-gray-800'
          : secondary
          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
          : 'bg-gray-900 text-white'
      } disabled:opacity-50`}
      type="button"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
      </svg>
    </button>
  );
}
