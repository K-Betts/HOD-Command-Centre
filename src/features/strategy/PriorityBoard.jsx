import React, { useEffect, useMemo, useState } from 'react';
import {
  Upload,
  Loader2,
  ClipboardCheck,
  CheckSquare,
  AlertTriangle,
  Clock4,
  Users,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { parsePriorityImport } from '../../services/ai';
import {
  createPriorityId,
  enrichPriorityFromImport,
  getNextReviewDate,
  isPriorityDueSoon,
  parseReviewMeta,
} from '../../utils/priorities';
import { useTasks } from '../../hooks/useTasks';
import { useToast } from '../../context/ToastContext';
import { useAcademicYear } from '../../context/AcademicYearContext';
import { db } from '../../services/firebase';
import { appId } from '../../config/appConfig';
import { IngestionReviewModal } from '../brain-dump/IngestionReviewModal';

const ragStyles = {
  Green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Amber: 'bg-amber-50 text-amber-700 border-amber-200',
  Red: 'bg-rose-50 text-rose-700 border-rose-200',
};

const defaultPriority = () => ({
  id: createPriorityId(),
  vision: '',
  objective: '',
  action: '',
  leadName: '',
  leadInitials: '',
  leadStaffId: '',
  isWholeTeam: false,
  assignmentType: 'INDIVIDUAL',
  reviewDate: '',
  reviewFrequency: '',
  evidence: '',
  rag: 'Amber',
  priorityId: '',
  priorityName: '',
  progressNotes: [],
});

export function PriorityBoard({
  user,
  staff = [],
  plan = {},
  savePriorities,
  saveSchoolPriorities,
  context,
  updateContext,
}) {
  const { addToast } = useToast();
  const { addTask } = useTasks(user);
  const { currentAcademicYear } = useAcademicYear();
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [priorities, setPriorities] = useState(plan.priorities || []);
  const [schoolPriorities, setSchoolPriorities] = useState(plan.schoolPriorities || []);
  const [selectedSchoolPriority, setSelectedSchoolPriority] = useState(
    plan.schoolPriorities?.[0]?.id || ''
  );
  const [savingId, setSavingId] = useState(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [pendingReview, setPendingReview] = useState({ priorities: [], raw: '' });
  const [openPriority, setOpenPriority] = useState('');

  useEffect(() => {
    setPriorities(plan.priorities || []);
    setSchoolPriorities(plan.schoolPriorities || []);
    if (plan.schoolPriorities?.length && !selectedSchoolPriority) {
      setSelectedSchoolPriority(plan.schoolPriorities[0].id);
    }
  }, [plan.priorities, plan.schoolPriorities, selectedSchoolPriority]);

  const handleImport = async () => {
    if (!importText.trim()) return;
    setIsImporting(true);
    try {
      const parsed = await parsePriorityImport(importText.trim());
      const incoming = (parsed?.priorities || []).map((p) =>
        attachSchoolPriority(
          enrichPriorityFromImport(p, staff, user),
          schoolPriorities,
          selectedSchoolPriority
        )
      );
      setPendingReview({ priorities: incoming, raw: importText.trim() });
      setReviewModalOpen(true);
    } catch (err) {
      console.error(err);
      addToast('error', 'Could not ingest priorities right now.');
    } finally {
      setIsImporting(false);
    }
  };

  const persist = async (next) => {
    setPriorities(next);
    try {
      await savePriorities?.(next);
    } catch (err) {
      console.error(err);
      addToast('error', 'Failed to save priorities.');
    }
  };

  const handleFieldChange = (id, field, value) => {
    setPriorities((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const handleFieldBlur = (id, field, value) => {
    const next = priorities.map((p) => {
      if (p.id !== id) return p;
      if (field === 'leadName') {
        const mappedLead = mapLeadFields(value, staff, user);
        return { ...p, ...mappedLead };
      }
      if (field === 'reviewFrequency' && !p.reviewDate) {
        const meta = parseReviewMeta(value);
        return { ...p, reviewFrequency: value, reviewDate: p.reviewDate || meta.reviewDate };
      }
      if (field === 'priorityId') {
        const meta = schoolPriorities.find((sp) => sp.id === value);
        return { ...p, priorityId: value, priorityName: meta?.title || '' };
      }
      return { ...p, [field]: value };
    });
    persist(next);
  };

  const handlePromoteTask = async (priority) => {
    setSavingId(priority.id);
    try {
      if (!currentAcademicYear) {
        addToast('error', 'Set an academic year before creating tasks.');
        setSavingId(null);
        return;
      }
      const nextReview = getNextReviewDate(priority);
      const dueDate = priority.reviewDate || (nextReview ? nextReview.toISOString().slice(0, 10) : null);
      await addTask({
        title: priority.action || priority.objective || 'Strategic Action',
        summary: priority.objective || priority.vision || 'Strategic priority',
        assignee: priority.leadName || '',
        staffId: priority.leadStaffId || '',
        priority: 'High',
        category: 'strategic',
        status: 'todo',
        dueDate: dueDate || null,
        strategyId: priority.id,
        themeTag: priority.objective || priority.vision || 'Strategy',
        isWeeklyWin: true,
      });
      addToast('success', 'Task created on the board');
    } catch (err) {
      console.error(err);
      addToast('error', 'Could not create task from priority.');
    } finally {
      setSavingId(null);
    }
  };

  const handleLogCheckIn = async (priority) => {
    if (!priority.leadStaffId) {
      addToast('error', 'No staff lead linked. Add a lead to log a check-in.');
      return;
    }
    if (!currentAcademicYear) {
      addToast('error', 'Academic year is not set. Cannot log check-in.');
      return;
    }
    setSavingId(priority.id);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await addDoc(
        collection(
          db,
          'artifacts',
          appId,
          'users',
          user.uid,
          'staff',
          priority.leadStaffId,
          'interactions'
        ),
        {
          date: today,
          type: 'Neutral',
          summary: `Strategic check-in: ${priority.action || priority.objective}`,
          source: 'strategy-priority',
          interactionType: 'ADMIN',
          buckTag: 'Admin',
          staffId: priority.leadStaffId,
          staffName: priority.leadName || '',
          userId: user.uid,
          uid: user.uid,
          academicYear: currentAcademicYear,
          createdAt: serverTimestamp(),
        }
      );
      addToast('success', 'Check-in logged for the lead.');
    } catch (err) {
      console.error(err);
      addToast('error', 'Could not log a check-in.');
    } finally {
      setSavingId(null);
    }
  };

  const addBlankRow = async (priorityId = selectedSchoolPriority) => {
    const next = [
      ...priorities,
      attachSchoolPriority(defaultPriority(), schoolPriorities, priorityId),
    ];
    if (priorityId) {
      setSelectedSchoolPriority(priorityId);
      setOpenPriority(priorityId);
    }
    await persist(next);
  };

  const confirmPending = async () => {
    const merged = mergePriorities(priorities, pendingReview.priorities || []);
    await persist(merged);
    setReviewModalOpen(false);
    setPendingReview({ priorities: [], raw: '' });
    setImportText('');
    addToast('success', `Imported ${pendingReview.priorities.length} priority actions`);
  };

  const logProgress = async (priority) => {
    const note = window.prompt('Log progress update'); // lightweight gate
    if (!note) return;
    const next = priorities.map((p) => {
      if (p.id !== priority.id) return p;
      const entry = { note, date: new Date().toISOString() };
      const progressNotes = Array.isArray(p.progressNotes) ? [...p.progressNotes, entry] : [entry];
      return { ...p, progressNotes };
    });
    await persist(next);
    addToast('success', 'Progress logged.');
  };

  const priorityRows = useMemo(
    () =>
      (priorities || []).map((p) => {
        const nextDate = getNextReviewDate(p);
        const dueSoon = isPriorityDueSoon(p, 7);
        const assignmentType = (p.assignmentType || (p.isWholeTeam ? 'TEAM_GOAL' : 'INDIVIDUAL')).toUpperCase();
        return { ...p, nextReviewDate: nextDate, dueSoon, assignmentType };
      }),
    [priorities]
  );

  const priorityGroups = useMemo(() => {
    const groups = (schoolPriorities || []).map((sp) => ({
      ...sp,
      items: priorityRows.filter((p) => p.priorityId === sp.id),
    }));
    const unassigned = priorityRows.filter((p) => !p.priorityId);
    if (unassigned.length || !groups.length) {
      groups.push({
        id: 'unassigned',
        title: 'Unassigned actions',
        items: unassigned.length ? unassigned : priorityRows,
        reviewDate: '',
        reviewFrequency: '',
      });
    }
    return groups;
  }, [priorityRows, schoolPriorities]);

  useEffect(() => {
    if (!openPriority && priorityGroups.length) {
      setOpenPriority(priorityGroups[0].id);
      if (priorityGroups[0].id !== 'unassigned') {
        setSelectedSchoolPriority(priorityGroups[0].id);
      }
    }
  }, [priorityGroups, openPriority, setSelectedSchoolPriority]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-indigo-600 flex items-center gap-2">
                <Users size={16} /> School Priorities
              </div>
              <p className="text-sm text-slate-600">Name top-level priorities and default review cadence.</p>
            </div>
            <button
              onClick={() => {
                const next = [
                  ...schoolPriorities,
                  {
                    id: createPriorityId(),
                    title: `Priority ${schoolPriorities.length + 1}`,
                    reviewFrequency: 'Half-termly',
                    reviewDate: '',
                  },
                ];
                setSchoolPriorities(next);
                saveSchoolPriorities?.(next);
                if (!selectedSchoolPriority) setSelectedSchoolPriority(next[0]?.id);
              }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow-sm hover:bg-indigo-700"
            >
              <CheckSquare size={14} /> Add
            </button>
          </div>
          <div className="mt-3 space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
            {schoolPriorities.length === 0 && (
              <div className="text-xs text-gray-500 italic">No school priorities yet.</div>
            )}
            {schoolPriorities.map((sp) => (
              <div key={sp.id} className="p-3 rounded-2xl border border-slate-100 bg-slate-50">
                <input
                  value={sp.title || ''}
                  onChange={(e) => {
                    const next = schoolPriorities.map((row) =>
                      row.id === sp.id ? { ...row, title: e.target.value } : row
                    );
                    setSchoolPriorities(next);
                    saveSchoolPriorities?.(next);
                  }}
                  className="w-full border border-slate-200 rounded-lg px-2 py-1 text-sm mb-2 focus:ring-1 focus:ring-indigo-200"
                  placeholder="Priority title"
                />
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={sp.reviewDate || ''}
                    onChange={(e) => {
                      const next = schoolPriorities.map((row) =>
                        row.id === sp.id ? { ...row, reviewDate: e.target.value } : row
                      );
                      setSchoolPriorities(next);
                      saveSchoolPriorities?.(next);
                    }}
                    className="w-40 border border-slate-200 rounded-lg px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-200"
                  />
                  <input
                    value={sp.reviewFrequency || ''}
                    onChange={(e) => {
                      const next = schoolPriorities.map((row) =>
                        row.id === sp.id ? { ...row, reviewFrequency: e.target.value } : row
                      );
                      setSchoolPriorities(next);
                      saveSchoolPriorities?.(next);
                    }}
                    placeholder="Frequency"
                    className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-200"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <label className="text-[11px] font-bold uppercase text-slate-500">Active priority for import</label>
            <select
              value={selectedSchoolPriority}
              onChange={(e) => setSelectedSchoolPriority(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm mt-1 bg-white"
            >
              <option value="">None</option>
              {schoolPriorities.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-indigo-600 flex items-center gap-2">
                <Upload size={16} /> Import Priority
              </div>
              <p className="text-sm text-slate-600">Paste SIP text/tables. AI will map to actions with leads and review cadence.</p>
            </div>
            <button
              onClick={handleImport}
              disabled={!importText.trim() || isImporting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow-sm hover:bg-indigo-700 disabled:opacity-60"
            >
              {isImporting ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
              Run AI Parser
            </button>
          </div>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={4}
            className="mt-3 w-full border border-slate-200 rounded-2xl p-3 text-sm bg-slate-50 focus:ring-2 focus:ring-indigo-200 outline-none"
            placeholder="Paste the School Improvement Plan chunk here (Vision, Objectives, Action plan table)..."
          />
        </div>
        <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-indigo-700 font-bold">
            <ClipboardCheck size={16} />
            Living Strategy Board
          </div>
          <p className="text-sm text-indigo-800/80 mt-2">
            Actions sync here. Edit cells inline. Promote to a task or log a check-in for accountability.
          </p>
          <button
            onClick={addBlankRow}
            className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-200 bg-white text-indigo-700 text-sm font-semibold hover:bg-indigo-50"
          >
            <CheckSquare size={14} /> Add manual row
          </button>
          <div className="mt-3 text-xs text-indigo-700 flex gap-2 items-center">
            <Clock4 size={14} /> Auto-surfaces on Dashboard when review is near.
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-slate-600" />
            <h3 className="text-lg font-bold text-slate-900">Living Strategy Board</h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{priorities.length} actions</span>
            <button
              onClick={() => addBlankRow(openPriority === 'unassigned' ? '' : openPriority)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:border-indigo-200 hover:text-indigo-700"
            >
              <CheckSquare size={12} /> Quick add
            </button>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {priorityGroups.map((group) => {
            const isOpen = openPriority === group.id;
            const reviewLabel = group.reviewDate || group.reviewFrequency
              ? `${group.reviewDate || 'Set date'} • ${group.reviewFrequency || 'Cadence?'}`
              : 'No cadence set';
            return (
              <div key={group.id}>
                <div
                  className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                  onClick={() => {
                    setOpenPriority(isOpen ? '' : group.id);
                    if (group.id !== 'unassigned') setSelectedSchoolPriority(group.id);
                  }}
                >
                  <div>
                    <div className="text-sm font-bold text-slate-900">{group.title || 'School Priority'}</div>
                    <div className="text-[11px] text-slate-500">
                      {reviewLabel}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{group.items.length} actions</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        addBlankRow(group.id === 'unassigned' ? '' : group.id);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Add action
                    </button>
                    <ChevronDown
                      size={16}
                      className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>
                {isOpen && (
                  <div className="overflow-x-auto pb-4">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-slate-700 uppercase text-[11px] tracking-wide">
                        <tr>
                          <th className="px-3 py-2 text-left">Objective / Action</th>
                          <th className="px-3 py-2 text-left">Lead</th>
                          <th className="px-3 py-2 text-left">Cadence</th>
                          <th className="px-3 py-2 text-left">Evidence</th>
                          <th className="px-3 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {group.items.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-3 py-3 text-slate-400 italic text-center">
                              No actions yet. Import from SIP or add manually.
                            </td>
                          </tr>
                        )}
                        {group.items.map((p) => {
                          const assignmentLabel = p.assignmentType === 'TEAM_GOAL' ? 'Team Goal' : 'Individual';
                          const badgeClass =
                            p.assignmentType === 'TEAM_GOAL'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200';
                          return (
                            <tr key={p.id} className="align-top hover:bg-slate-50/60">
                              <td className="px-3 py-3 min-w-[240px]">
                                <div className="flex items-center gap-2 mb-2">
                                  <select
                                    value={p.priorityId || ''}
                                    onChange={(e) => handleFieldBlur(p.id, 'priorityId', e.target.value)}
                                    className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-200 bg-white"
                                  >
                                    <option value="">Unassigned</option>
                                    {schoolPriorities.map((sp) => (
                                      <option key={sp.id} value={sp.id}>
                                        {sp.title}
                                      </option>
                                    ))}
                                  </select>
                                  <span className="text-[11px] text-slate-400">
                                    {p.priorityName || group.title || 'Priority'}
                                  </span>
                                </div>
                                <input
                                  value={p.objective || ''}
                                  onChange={(e) => handleFieldChange(p.id, 'objective', e.target.value)}
                                  onBlur={(e) => handleFieldBlur(p.id, 'objective', e.target.value)}
                                  placeholder="Objective"
                                  className="w-full border border-slate-200 rounded-lg px-2 py-1 text-sm mb-2 focus:ring-1 focus:ring-indigo-200"
                                />
                                <textarea
                                  value={p.action || ''}
                                  onChange={(e) => handleFieldChange(p.id, 'action', e.target.value)}
                                  onBlur={(e) => handleFieldBlur(p.id, 'action', e.target.value)}
                                  placeholder="Action"
                                  rows={2}
                                  className="w-full border border-slate-200 rounded-lg px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-200"
                                />
                                {p.vision && (
                                  <div className="text-[11px] text-slate-500 mt-1">Vision: {p.vision}</div>
                                )}
                              </td>
                              <td className="px-3 py-3 min-w-[180px]">
                                <input
                                  value={p.leadName || p.leadInitials || p.leadRaw || ''}
                                  onChange={(e) => handleFieldChange(p.id, 'leadName', e.target.value)}
                                  onBlur={(e) => handleFieldBlur(p.id, 'leadName', e.target.value)}
                                  placeholder="Lead initials"
                                  className="w-full border border-slate-200 rounded-lg px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-200"
                                />
                                <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-2 flex-wrap">
                                  <span className={`px-2 py-0.5 rounded-full border ${badgeClass}`}>
                                    {assignmentLabel}
                                  </span>
                                  <span>{p.isWholeTeam ? 'Whole Team' : p.leadInitials || 'Unmapped'}</span>
                                  {p.leadStaffId && (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">
                                      Linked
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-3 min-w-[180px]">
                                <div className="flex gap-2">
                                  <input
                                    type="date"
                                    value={p.reviewDate || ''}
                                    onChange={(e) => handleFieldChange(p.id, 'reviewDate', e.target.value)}
                                    onBlur={(e) => handleFieldBlur(p.id, 'reviewDate', e.target.value)}
                                    className="w-36 border border-slate-200 rounded-lg px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-200"
                                  />
                                  <input
                                    value={p.reviewFrequency || ''}
                                    onChange={(e) => handleFieldChange(p.id, 'reviewFrequency', e.target.value)}
                                    onBlur={(e) => handleFieldBlur(p.id, 'reviewFrequency', e.target.value)}
                                    placeholder="Frequency"
                                    className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-200"
                                  />
                                </div>
                                {p.nextReviewDate && (
                                  <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                                    <Clock4 size={12} /> Next: {p.nextReviewDate.toISOString().slice(0, 10)}{' '}
                                    {p.dueSoon && (
                                      <span className="ml-1 text-amber-700 font-semibold">Due soon</span>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-3 min-w-[200px]">
                                <textarea
                                  value={p.evidence || ''}
                                  onChange={(e) => handleFieldChange(p.id, 'evidence', e.target.value)}
                                  onBlur={(e) => handleFieldBlur(p.id, 'evidence', e.target.value)}
                                  rows={2}
                                  placeholder="Evidence / impact measure"
                                  className="w-full border border-slate-200 rounded-lg px-2 py-1 text-sm focus:ring-1 focus:ring-indigo-200"
                                />
                              </td>
                              <td className="px-3 py-3 min-w-[180px]">
                                <div className="flex items-center gap-2 mb-2">
                                  <select
                                    value={p.rag || 'Amber'}
                                    onChange={(e) => handleFieldChange(p.id, 'rag', e.target.value)}
                                    onBlur={(e) => handleFieldBlur(p.id, 'rag', e.target.value)}
                                    className={`w-28 border rounded-lg px-2 py-1 text-sm ${ragStyles[p.rag] || 'border-slate-200'}`}
                                  >
                                    {['Green', 'Amber', 'Red'].map((opt) => (
                                      <option key={opt} value={opt}>
                                        {opt}
                                      </option>
                                    ))}
                                  </select>
                                  {Array.isArray(p.progressNotes) && p.progressNotes.length > 0 && (
                                    <span className="text-[11px] text-slate-500">
                                      Last: {new Date(p.progressNotes[p.progressNotes.length - 1].date).toISOString().slice(0, 10)}
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    onClick={() => handlePromoteTask(p)}
                                    disabled={savingId === p.id}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-60"
                                  >
                                    {savingId === p.id ? <Loader2 className="animate-spin" size={14} /> : <ClipboardCheck size={14} />}
                                    Task
                                  </button>
                                  <button
                                    onClick={() => handleLogCheckIn(p)}
                                    disabled={savingId === p.id}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold hover:bg-slate-50 disabled:opacity-60"
                                  >
                                    {savingId === p.id ? <Loader2 className="animate-spin" size={14} /> : <AlertTriangle size={14} />}
                                    Check-in
                                  </button>
                                  <button
                                    onClick={() => logProgress(p)}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-indigo-200 text-xs font-semibold hover:bg-indigo-50"
                                  >
                                    Log Progress
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <IngestionReviewModal
        isOpen={reviewModalOpen}
        aiResult={{ tasks: buildPreviewTasks(pendingReview.priorities || []) }}
        rawText={pendingReview.raw}
        staff={staff}
        user={user}
        context={context}
        updateContext={updateContext}
        onApprove={confirmPending}
        onClose={() => setReviewModalOpen(false)}
        reviewOnly
      />
    </div>
  );
}

function mergePriorities(existing = [], incoming = []) {
  const byKey = (item) =>
    `${(item.objective || '').toLowerCase().trim()}|${(item.action || '').toLowerCase().trim()}`;
  const map = new Map();
  existing.forEach((item) => map.set(byKey(item) || item.id, item));
  incoming.forEach((item) => {
    const key = byKey(item) || item.id || createPriorityId();
    if (map.has(key)) {
      map.set(key, { ...map.get(key), ...item, id: map.get(key).id || item.id || createPriorityId() });
    } else {
      map.set(key, item);
    }
  });
  return Array.from(map.values());
}

function mapLeadFields(leadText, staff = [], user) {
  const mapped = enrichPriorityFromImport({ lead: leadText }, staff, user);
  return {
    leadName: mapped.leadName,
    leadInitials: mapped.leadInitials,
    leadStaffId: mapped.leadStaffId || '',
    isWholeTeam: mapped.isWholeTeam,
    assignmentType: mapped.assignmentType || (mapped.isWholeTeam ? 'TEAM_GOAL' : 'INDIVIDUAL'),
    leadRaw: leadText,
  };
}

function attachSchoolPriority(priority, schoolPriorities = [], selectedId = '') {
  if (!selectedId) return priority;
  const parent = schoolPriorities.find((sp) => sp.id === selectedId);
  return {
    ...priority,
    priorityId: selectedId,
    priorityName: parent?.title || priority.priorityName || '',
    reviewFrequency: priority.reviewFrequency || parent?.reviewFrequency || '',
    reviewDate: priority.reviewDate || parent?.reviewDate || '',
  };
}

function buildPreviewTasks(priorities = []) {
  return priorities.map((p, idx) => ({
    id: p.id || `priority-${idx}`,
    title: p.action || p.objective || 'Priority action',
    summary: p.objective || p.vision || '',
    dueDate: p.reviewDate || '',
    assignee: p.leadName || p.leadInitials || '',
    priority: 'High',
    category: 'Strategic',
  }));
}
