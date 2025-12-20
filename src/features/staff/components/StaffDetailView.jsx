import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, FileText, Pencil, Sparkles, Trash2 } from 'lucide-react';

import { useInteractionLogs } from '../../../hooks/useStaff';
import { useStaffInsights } from '../../../hooks/useStaffInsights';
import { useTasks } from '../../../hooks/useTasks';
import { StaffScheduleView } from '../StaffScheduleView';
import { analyzeStaffProfile } from '../../../services/ai';
import { getNextReviewDate, normalizeInitials } from '../../../utils/priorities';

import {
  formatDisplayDate,
  getDiscColor,
  getInteractionTypeMeta,
  getSecondaryDiscColor,
} from '../staffUtils';

export function StaffDetailView({ staff, onBack, onUpdate, user, strategyPriorities = [] }) {
  const [activeSubTab, setActiveSubTab] = useState('profile');
  const [editingInteraction, setEditingInteraction] = useState(null);
  const [interactionForm, setInteractionForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: 'Neutral',
    summary: '',
    source: 'manual',
    interactionType: 'SUPPORT',
  });

  const { interactions, addInteraction, updateInteraction, deleteInteraction } = useInteractionLogs(
    user,
    staff?.id
  );
  const { insights } = useStaffInsights(user, staff?.id);
  const { tasks: allTasks } = useTasks(user);

  const assignedTasks = allTasks.filter((t) => t.assignedTo === staff?.id && !t.archivedAt);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- intentional memo to avoid recalculating filters per render
  const myStrategyActions = useMemo(() => {
    if (!Array.isArray(strategyPriorities)) return [];
    const myInitials = normalizeInitials(staff?.initials || staff?.name || '');
    return strategyPriorities
      .filter((p) => {
        const assignmentType = (p.assignmentType || (p.isWholeTeam ? 'TEAM_GOAL' : 'INDIVIDUAL')).toUpperCase();
        if (assignmentType !== 'INDIVIDUAL') return false;
        const leadInitials = normalizeInitials(p.leadInitials || p.leadName || p.leadRaw || '');
        return p.leadStaffId === staff?.id || (myInitials && leadInitials && leadInitials.startsWith(myInitials));
      })
      .map((p) => ({
        ...p,
        nextReviewDate: getNextReviewDate(p),
      }));
  }, [strategyPriorities, staff?.id, staff?.initials, staff?.name]);

  const ragBadge = {
    Green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Amber: 'bg-amber-50 text-amber-700 border-amber-200',
    Red: 'bg-rose-50 text-rose-700 border-rose-200',
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset interaction form when switching staff
    setInteractionForm({
      date: new Date().toISOString().slice(0, 10),
      type: 'Neutral',
      summary: '',
      source: 'manual',
      interactionType: 'SUPPORT',
    });
    setEditingInteraction(null);
  }, [staff?.id]);

  const handleAnalyze = async () => {
    if (interactions.length === 0) {
      alert('Please log at least one interaction before running an analysis.');
      return;
    }
    const profile = await analyzeStaffProfile(interactions);
    if (profile) onUpdate({ aiProfile: profile });
  };

  const handleLogInteraction = async () => {
    if (!interactionForm.summary || !interactionForm.date || !interactionForm.interactionType) {
      return;
    }

    const typeKey = (interactionForm.interactionType || '').toUpperCase();
    const buckTag =
      typeKey === 'CHALLENGE'
        ? 'Challenge'
        : typeKey === 'SUPPORT'
          ? 'Support'
          : typeKey === 'OBSERVATION'
            ? 'Observation'
            : 'Admin';

    const payload = {
      date: interactionForm.date,
      type: interactionForm.type || 'Neutral',
      summary: interactionForm.summary,
      source: interactionForm.source || 'manual',
      interactionType: typeKey,
      buckTag,
      staffId: staff?.id,
      staffName: staff?.name,
      userId: user?.uid,
    };

    if (editingInteraction?.id) {
      await updateInteraction(editingInteraction.id, payload);
      setEditingInteraction(null);
    } else {
      await addInteraction(payload);
    }

    setInteractionForm((prev) => ({
      ...prev,
      summary: '',
      date: new Date().toISOString().slice(0, 10),
      interactionType: typeKey,
    }));
  };

  const handleStartEdit = (interaction) => {
    const nextType = (interaction.interactionType || interaction.buckTag || 'ADMIN').toString().toUpperCase();
    const parsedDate = interaction.date?.toDate
      ? interaction.date.toDate().toISOString().slice(0, 10)
      : interaction.date || new Date().toISOString().slice(0, 10);
    setEditingInteraction(interaction);
    setInteractionForm({
      date: parsedDate,
      type: interaction.type || 'Neutral',
      summary: interaction.summary || '',
      source: interaction.source || 'manual',
      interactionType: nextType,
    });
  };

  const handleDeleteInteraction = async (interactionId) => {
    if (window.confirm('Are you sure you want to delete this log?')) {
      await deleteInteraction(interactionId);
    }
  };

  const downloadInteractionHistory = () => {
    if (!interactions.length) {
      alert('No interactions to download yet.');
      return;
    }

    const escapeCsv = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value).replace(/"/g, '""');
      return /[",\n]/.test(str) ? `"${str}"` : str;
    };

    const formatDateForCsv = (value) => {
      if (!value) return '';
      try {
        const d = value?.toDate ? value.toDate() : new Date(value);
        if (Number.isNaN(d.getTime())) return String(value);
        return d.toISOString().slice(0, 10);
      } catch {
        return String(value);
      }
    };

    const rows = interactions.map((i) => {
      const typeKey = (i.interactionType || i.buckTag || 'ADMIN').toString().toUpperCase();
      return [
        formatDateForCsv(i.date),
        i.type || 'Neutral',
        getInteractionTypeMeta(typeKey).label,
        i.summary || '',
        i.source || 'manual',
      ];
    });

    const csv = [
      ['Date', 'Tone', 'Interaction Type', 'Summary', 'Source'].join(','),
      ...rows.map((row) => row.map(escapeCsv).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${staff.name || 'staff'}_interactions.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-140px)]">
      <div className="p-8 border-b border-gray-100 bg-gray-50/30 flex items-center gap-6">
        <button
          onClick={onBack}
          className="p-3 bg-white hover:bg-indigo-50 rounded-full transition-colors border border-gray-200 shadow-sm group"
        >
          <ArrowLeft size={20} className="text-gray-500 group-hover:text-indigo-600" />
        </button>
        <div>
          <h2 className="text-3xl font-bold text-gray-800">{staff.name}</h2>
          <p className="text-gray-500 font-medium">
            {staff.role} • {staff.initials}
          </p>
        </div>
        <div className="ml-auto flex bg-gray-100 p-1.5 rounded-2xl border border-gray-200">
          {['profile', 'schedule'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold capitalize transition-all ${
                activeSubTab === tab ? 'bg-white shadow-md text-indigo-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 bg-gray-50/30">
        {activeSubTab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wider mb-3">Log Interaction</h4>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase text-gray-500 tracking-wider">Date</label>
                    <input
                      type="date"
                      value={interactionForm.date}
                      onChange={(e) => setInteractionForm((prev) => ({ ...prev, date: e.target.value }))}
                      className="p-2.5 rounded-xl border border-gray-200 text-sm bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase text-gray-500 tracking-wider">Tone</label>
                    <select
                      value={interactionForm.type}
                      onChange={(e) => setInteractionForm((prev) => ({ ...prev, type: e.target.value }))}
                      className="p-2.5 rounded-xl border border-gray-200 text-sm bg-white"
                    >
                      <option>Praise</option>
                      <option>Concern</option>
                      <option>Neutral</option>
                    </select>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="text-[11px] font-bold uppercase text-gray-500 tracking-wider mb-2">Interaction Type (required)</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {['SUPPORT', 'CHALLENGE', 'ADMIN', 'OBSERVATION'].map((type) => {
                      const meta = getInteractionTypeMeta(type);
                      const isActive = interactionForm.interactionType === type;
                      return (
                        <label
                          key={type}
                          className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                            isActive
                              ? `${meta.badgeClass} shadow-sm`
                              : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-200'
                          }`}
                        >
                          <input
                            type="radio"
                            name="interactionType"
                            value={type}
                            checked={isActive}
                            onChange={() => setInteractionForm((prev) => ({ ...prev, interactionType: type }))}
                            className="sr-only"
                            required
                          />
                          <div className="font-bold text-sm">{meta.label}</div>
                          <div className="text-[11px] leading-snug text-gray-600">{meta.description}</div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <textarea
                  value={interactionForm.summary}
                  onChange={(e) => setInteractionForm((prev) => ({ ...prev, summary: e.target.value }))}
                  className="w-full p-3 rounded-xl border border-gray-200 text-sm resize-none bg-gray-50/50"
                  rows={3}
                  placeholder="e.g. 1:1 with Harrie – seemed overloaded by data deadlines."
                />
                <div className="mt-3 flex items-center gap-3">
                  <button onClick={handleLogInteraction} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold">
                    {editingInteraction ? 'Update Interaction' : 'Save Interaction'}
                  </button>
                  {editingInteraction && (
                    <button
                      onClick={() => {
                        setEditingInteraction(null);
                        setInteractionForm({
                          date: new Date().toISOString().slice(0, 10),
                          type: 'Neutral',
                          summary: '',
                          source: 'manual',
                          interactionType: 'SUPPORT',
                        });
                      }}
                      className="px-4 py-2 rounded-xl bg-gray-200 text-gray-700 text-sm font-bold"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-3 gap-3">
                  <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wider">Interaction History</h4>
                  <button
                    onClick={downloadInteractionHistory}
                    className="flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 hover:bg-white"
                  >
                    <FileText size={16} />
                    Download CSV
                  </button>
                </div>
                <div className="space-y-3 max-h-[40vh] overflow-y-auto custom-scrollbar">
                  {interactions.length === 0 && <div className="text-xs text-gray-400 italic">No interactions yet.</div>}
                  {interactions.map((i) => (
                    <div key={i.id} className="p-3 rounded-xl border border-gray-100 bg-gray-50 group relative">
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleStartEdit(i)}
                          className="p-1.5 bg-white rounded-md shadow-sm border border-gray-200 text-gray-500 hover:text-indigo-600"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => handleDeleteInteraction(i.id)}
                          className="p-1.5 bg-white rounded-md shadow-sm border border-gray-200 text-gray-500 hover:text-red-600"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div>
                        <div className="flex justify-between items-center text-[11px] uppercase font-bold text-gray-400">
                          <div className="flex items-center gap-2">
                            <span>{i.type}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full border ${
                                getInteractionTypeMeta(i.interactionType || i.buckTag).badgeClass
                              }`}
                            >
                              {getInteractionTypeMeta(i.interactionType || i.buckTag).label}
                            </span>
                          </div>
                          <span>{formatDisplayDate(i.date)}</span>
                        </div>
                        <div className="text-sm text-gray-700 mt-1">{i.summary}</div>
                        <div className="text-[10px] text-gray-400">Source: {i.source || 'manual'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wider">Strategic Responsibilities</h4>
                  <span className="text-xs text-gray-500 font-semibold">{myStrategyActions.length} linked</span>
                </div>
                <div className="space-y-3 max-h-[24vh] overflow-y-auto custom-scrollbar">
                  {myStrategyActions.length === 0 && (
                    <div className="text-xs text-gray-400 italic">No individual SIP actions linked to this staff member yet.</div>
                  )}
                  {myStrategyActions.map((action) => (
                    <div key={action.id} className="p-3 rounded-xl border border-gray-100 bg-gray-50">
                      <div className="flex items-center justify-between text-[11px] uppercase font-bold text-gray-500 gap-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">Individual</span>
                          <span className="line-clamp-1">{action.priorityName || action.objective || 'Objective'}</span>
                        </div>
                        {action.rag && (
                          <span
                            className={`px-2 py-0.5 rounded-full border ${
                              ragBadge[action.rag] || 'border-gray-200 text-gray-600 bg-white'
                            }`}
                          >
                            {action.rag}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-800 font-semibold mt-1">{action.action || 'Action not set'}</div>
                      <div className="text-[11px] text-gray-500 mt-1">
                        Next review:{' '}
                        {action.nextReviewDate
                          ? action.nextReviewDate.toISOString().slice(0, 10)
                          : action.reviewDate || action.reviewFrequency || 'Not set'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wider">Assigned Tasks</h4>
                  <span className="text-xs text-gray-500 font-semibold">
                    {assignedTasks.length} task{assignedTasks.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-3 max-h-[30vh] overflow-y-auto custom-scrollbar">
                  {assignedTasks.length === 0 && (
                    <div className="text-xs text-gray-400 italic">No tasks assigned to this staff member yet.</div>
                  )}
                  {assignedTasks.map((task) => (
                    <div key={task.id} className="p-3 rounded-xl border border-gray-100 bg-gray-50">
                      <div className="flex items-center justify-between text-[11px] uppercase font-bold text-gray-500 gap-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full border ${
                              task.priority === 'High'
                                ? 'bg-rose-100 text-rose-700 border-rose-200'
                                : task.priority === 'Medium'
                                  ? 'bg-amber-100 text-amber-700 border-amber-200'
                                  : 'bg-sky-100 text-sky-700 border-sky-200'
                            }`}
                          >
                            {task.priority || 'Medium'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full border ${
                              task.status === 'done'
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                : task.status === 'doing'
                                  ? 'bg-sky-100 text-sky-700 border-sky-200'
                                  : 'bg-gray-100 text-gray-700 border-gray-200'
                            }`}
                          >
                            {task.status || 'todo'}
                          </span>
                        </div>
                        {task.dueDate && (
                          <span className="text-gray-500">
                            Due:{' '}
                            {new Date(task.dueDate).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-800 font-semibold mt-1">{task.title || 'Untitled Task'}</div>
                      {task.summary && <div className="text-xs text-gray-600 mt-1">{task.summary}</div>}
                      <div className="flex items-center gap-2 mt-2">
                        {task.estimatedTime && <span className="text-[10px] text-gray-500">Est: {task.estimatedTime}</span>}
                        {task.category && <span className="text-[10px] text-gray-500">• {task.category}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wider mb-3">AI Staff Insights</h4>
                <div className="space-y-3 max-h-[30vh] overflow-y-auto custom-scrollbar">
                  {insights.length === 0 && <div className="text-xs text-gray-400 italic">No AI insights captured yet.</div>}
                  {insights.map((insight) => (
                    <div key={insight.id} className="p-3 rounded-xl border border-gray-100 bg-gray-50">
                      <div className="flex justify-between text-[11px] uppercase font-bold text-gray-400">
                        <span>{insight.type || 'note'}</span>
                        <span>{formatDisplayDate(insight.date)}</span>
                      </div>
                      <div className="text-sm text-gray-700 mt-1">{insight.summary}</div>
                      {insight.theme && (
                        <div className="text-[11px] text-indigo-600 font-semibold mt-1">Theme: {insight.theme}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {staff.aiProfile ? (
                <div className="animate-in fade-in slide-in-from-right-8 duration-500 space-y-6">
                  <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wider">Analysis Summary</h4>
                      <span
                        className={`px-4 py-1.5 rounded-full text-xs font-bold border-2 ${getDiscColor(
                          staff.aiProfile.primaryColor
                        )} ${getSecondaryDiscColor(staff.aiProfile.secondaryColor)}`}
                        title={`Primary: ${staff.aiProfile.primaryColor}, Secondary: ${staff.aiProfile.secondaryColor || 'None'}`}
                      >
                        {staff.aiProfile.primaryColor}
                        {staff.aiProfile.secondaryColor && (
                          <span className="opacity-60">/{staff.aiProfile.secondaryColor.charAt(0)}</span>
                        )}
                      </span>
                    </div>
                    <p className="text-gray-600 italic leading-relaxed text-lg">{staff.aiProfile.summary}</p>
                  </div>

                  <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
                    <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wider mb-3">Communication Tips</h4>
                    <ul className="space-y-2 text-gray-600 text-sm leading-relaxed list-disc list-inside">
                      {(staff.aiProfile.communicationTips || []).map((tip, i) => (
                        <li key={i}>{tip}</li>
                      ))}
                      {(staff.aiProfile.communicationTips || []).length === 0 && (
                        <li className="text-xs text-gray-400 italic list-none">No tips captured yet.</li>
                      )}
                    </ul>
                  </div>

                  <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
                    <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wider mb-3">Strengths</h4>
                    <div className="flex flex-wrap gap-2">
                      {(staff.aiProfile.strengths || []).map((s, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100"
                        >
                          {s}
                        </span>
                      ))}
                      {(staff.aiProfile.strengths || []).length === 0 && (
                        <span className="text-xs text-gray-400 italic">No strengths captured yet.</span>
                      )}
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
                    <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wider mb-3">Areas for Development</h4>
                    <div className="flex flex-wrap gap-2">
                      {(staff.aiProfile.developmentAreas || []).map((s, i) => (
                        <span
                          key={i}
                          className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-100"
                        >
                          {s}
                        </span>
                      ))}
                      {(staff.aiProfile.developmentAreas || []).length === 0 && (
                        <span className="text-xs text-gray-400 italic">No development areas captured yet.</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm text-gray-400 italic h-full flex flex-col items-center justify-center text-center">
                  <Sparkles size={32} className="mb-4 text-gray-300" />
                  No AI profile yet.
                  <br />
                  Log some interactions and click "Run AI Analysis".
                </div>
              )}
              <div className="flex justify-end">
                <button
                  onClick={handleAnalyze}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2"
                >
                  <Sparkles size={18} /> Run AI Analysis
                </button>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'schedule' && <StaffScheduleView user={user} staffId={staff.id} />}
      </div>
    </div>
  );
}
