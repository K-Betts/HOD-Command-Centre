import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  Plus,
  Sparkles,
  Search,
} from 'lucide-react';
import { useMeetings } from '../../hooks/useMeetings';
import { useToast } from '../../context/ToastContext';
import { parseMeetingMinutes } from '../../services/ai/workflowAi';
import { IngestionReviewModal } from '../brain-dump/IngestionReviewModal';

import { MeetingAgendaBuilder } from './components/MeetingAgendaBuilder';
import { MeetingArchiveAccordion } from './components/MeetingArchiveAccordion';
import { ImportMinutesModal } from './components/ImportMinutesModal';
import { StatPill } from './components/MeetingsBadges';

import { exportMeetingsBook } from './meetingsExport';
import {
  defaultAgendaSeed,
  ensureIds,
  hasMinutes,
  normalize,
  safeId,
  toMillis,
  todayIso,
} from './meetingsUtils';

export function MeetingsView({ user, staff = [], logInteraction, addTask, tasks = [] }) {
  const meetingsApi = useMeetings(user);
  const { meetings, addMeeting, updateMeeting, deleteMeeting } = meetingsApi;
  const { addToast } = useToast();

  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  const [exportingBook, setExportingBook] = useState(false);
  const [importing, setImporting] = useState(false);
  const [ingestionSaving, setIngestionSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [meetingForm, setMeetingForm] = useState({
    title: 'Department Meeting',
    meetingDate: todayIso(),
    startTime: '',
    location: '',
    attendees: [],
    agenda: defaultAgendaSeed(),
  });
  const [importText, setImportText] = useState('');
  const [aiMeetingDraft, setAiMeetingDraft] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  const selectedMeeting = useMemo(
    () => meetings.find((m) => m.id === selectedMeetingId) || null,
    [meetings, selectedMeetingId]
  );
  const [editableMeeting, setEditableMeeting] = useState(null);
  const agendaCardRef = useRef(null);

  useEffect(() => {
    if (!selectedMeetingId && meetings.length > 0) {
      const firstLive = meetings.find((m) => m.type !== 'archive');
      setSelectedMeetingId((firstLive || meetings[0]).id);
    }
  }, [meetings, selectedMeetingId]);

  useEffect(() => {
    if (!selectedMeeting) {
      setEditableMeeting(null);
      return;
    }
    setEditableMeeting({
      ...selectedMeeting,
      agenda: ensureIds(selectedMeeting.agenda || []),
      actions: ensureIds(selectedMeeting.actions || []),
      staffNotes: ensureIds(selectedMeeting.staffNotes || []),
    });
  }, [selectedMeetingId, selectedMeeting]);

  const liveMeetings = useMemo(
    () => meetings.filter((m) => m.type !== 'archive'),
    [meetings]
  );

  const stats = useMemo(() => {
    const awaitingMinutes = liveMeetings.filter((m) => !hasMinutes(m)).length;
    const upcoming = liveMeetings.filter((m) => toMillis(m.meetingDate) >= Date.now()).length;
    return { awaitingMinutes, upcoming };
  }, [liveMeetings]);

  const scrollToAgendaBuilder = () => {
    if (agendaCardRef.current) {
      agendaCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleDeleteMeeting = async (meeting) => {
    if (!meeting?.id) return;
    const confirmed = window.confirm(
      'This will permanently delete this meeting, including its agenda, minutes, actions, attachments, and staff notes. This cannot be undone. Continue?'
    );
    if (!confirmed) return;

    try {
      if (typeof deleteMeeting === 'function') {
        await deleteMeeting(meeting.id);
        addToast('success', 'Meeting deleted.');
      } else {
        addToast(
          'error',
          'Delete is not yet wired to Firestore. Add a deleteMeeting function to useMeetings to enable hard delete.'
        );
      }
    } catch (err) {
      console.error(err);
      addToast('error', 'Failed to delete meeting.');
    }
  };

  const handleCreateMeeting = async (e) => {
    e.preventDefault();
    if (!meetingForm.title || !meetingForm.meetingDate) {
      addToast('error', 'Title and date are required.');
      return;
    }
    try {
      const payload = {
        ...meetingForm,
        agenda: (meetingForm.agenda || []).filter((item) => (item.title || '').trim()),
      };
      const ref = await addMeeting(payload);
      setMeetingForm({
        title: 'Department Meeting',
        meetingDate: todayIso(),
        startTime: '',
        location: '',
        attendees: [],
        agenda: defaultAgendaSeed(),
      });
      if (ref?.id) setSelectedMeetingId(ref.id);
      addToast('success', 'Agenda created and saved.');
    } catch (err) {
      console.error(err);
      addToast('error', 'Could not save agenda. Try again.');
    }
  };

  const handleExportBook = () => {
    if (!meetings.length) {
      addToast('error', 'No meetings to export yet.');
      return;
    }
    setExportingBook(true);
    try {
      exportMeetingsBook(meetings);
      addToast('success', 'Opening print view for all minutes.');
    } catch (err) {
      console.error(err);
      addToast('error', 'Unable to build the minutes book.');
    } finally {
      setExportingBook(false);
    }
  };

  const handleRunImport = async () => {
    if (!importText.trim()) {
      addToast('error', 'Paste meeting minutes to import.');
      return;
    }
    setImporting(true);
    try {
      const parsed = await parseMeetingMinutes(importText.trim());
      setAiMeetingDraft(parsed);
      setIsReviewOpen(true);
      addToast('success', 'AI draft ready. Review actions before saving.');
    } catch (err) {
      console.error(err);
      addToast('error', 'Import failed. Try again in a moment.');
    } finally {
      setImporting(false);
    }
  };

  const mergeAttendees = (existing = [], incoming = []) =>
    Array.from(new Set([...(existing || []), ...(incoming || [])].filter(Boolean)));

  const mergeAgenda = (existing = [], incoming = []) => {
    const base = ensureIds(existing || []);
    const seen = new Set(base.map((item) => (item.title || '').toLowerCase()));
    const additions = (incoming || [])
      .map((item) => ({
        id: safeId(),
        title: item.title || item.agendaItem || '',
        owner: item.owner || '',
        duration: item.duration || '',
        minutes: item.notes || item.minutes || '',
      }))
      .filter((item) => item.title && !seen.has(item.title.toLowerCase()));
    return [...base, ...additions];
  };

  const mergeActions = (existing = [], incoming = []) => {
    const base = ensureIds(existing || []);
    const seen = new Set(
      base.map((action) => `${(action.task || '').toLowerCase()}|${(action.owner || '').toLowerCase()}|${action.dueDate || ''}`)
    );
    const additions = (incoming || [])
      .map((action) => ({
        id: action.id || safeId(),
        task: action.task || action.title || 'Action',
        owner: action.owner || action.assignee || '',
        dueDate: action.dueDate || action.deadline || '',
        status: action.status === 'done' ? 'done' : 'open',
      }))
      .filter((action) => {
        const key = `${(action.task || '').toLowerCase()}|${(action.owner || '').toLowerCase()}|${action.dueDate || ''}`;
        if (!action.task) return false;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    return [...base, ...additions];
  };

  const buildTasksFromActions = (actions = []) =>
    (Array.isArray(actions) ? actions : []).map((action, idx) => ({
      id: action.id || `import-action-${idx}`,
      title: action.title || action.task || 'Action point',
      assignee: action.owner || '',
      dueDate: action.deadline || action.dueDate || '',
      summary: action.notes || '',
      priority: 'Medium',
      category: 'Meeting follow-up',
      status: action.status || 'open',
    }));

  const handleApproveImport = async (payload = {}) => {
    if (ingestionSaving) return;
    const reviewedTasks = Array.isArray(payload?.tasks) ? payload.tasks : [];
    const parsedActions = buildTasksFromActions(aiMeetingDraft?.actions || []);
    const approvedTasks = reviewedTasks.length ? reviewedTasks : parsedActions;
    const incomingActions = approvedTasks
      .filter((task) => !task.ignore && (task.title || task.summary))
      .map((task) => ({
        id: task.id || safeId(),
        task: task.title || task.summary || 'Action',
        owner: task.assignee || task.owner || '',
        dueDate: task.dueDate || aiMeetingDraft?.meetingDate || '',
        status: task.status === 'done' ? 'done' : 'open',
      }));

    if (incomingActions.length === 0) {
      addToast('error', 'No actions to add from that import.');
      return;
    }

    const meta = aiMeetingDraft || {};
    setIngestionSaving(true);
    try {
      if (!editableMeeting) {
        const newMeetingPayload = {
          title: meta.title || 'Imported Meeting',
          meetingDate: meta.meetingDate || todayIso(),
          attendees: meta.attendees || [],
          agenda: mergeAgenda([], meta.agenda),
          actions: incomingActions,
          minutesSummary: meta.minutesSummary || '',
        };
        const ref = await addMeeting(newMeetingPayload);
        if (ref?.id) {
          setSelectedMeetingId(ref.id);
          await syncActionSnapshots(incomingActions, null, {
            id: ref.id,
            title: newMeetingPayload.title,
            meetingDate: newMeetingPayload.meetingDate,
          });
        }
        addToast('success', 'Meeting created and tasks logged.');
      } else {
        const meetingId = editableMeeting.id;
        const mergedActions = mergeActions(editableMeeting.actions, incomingActions);
        const mergedAgenda = mergeAgenda(editableMeeting.agenda, meta.agenda);
        const mergedAttendees = mergeAttendees(editableMeeting.attendees, meta.attendees);
        const meetingDate = editableMeeting.meetingDate || meta.meetingDate || '';

        const updatePayload = {
          actions: mergedActions,
          agenda: mergedAgenda,
          attendees: mergedAttendees,
          minutesSummary: editableMeeting.minutesSummary || meta.minutesSummary || '',
          meetingDate,
        };

        await updateMeeting(meetingId, updatePayload);
        setEditableMeeting((prev) =>
          prev && prev.id === meetingId ? { ...prev, ...updatePayload } : prev
        );
        await syncActionSnapshots(incomingActions, null, {
          id: meetingId,
          title: editableMeeting.title,
          meetingDate,
        });
        addToast('success', 'Actions added to this meeting and tasks logged.');
      }
      setIsReviewOpen(false);
      setIsImportModalOpen(false);
      setImportText('');
      setAiMeetingDraft(null);
    } catch (err) {
      console.error(err);
      addToast('error', 'Could not apply the imported actions.');
    } finally {
      setIngestionSaving(false);
    }
  };

  const matchStaffByName = (owner = '') => {
    const norm = normalize(owner);
    return staff.find(
      (member) =>
        normalize(member.name) === norm ||
        normalize(member.initials) === norm
    );
  };

  const syncActionSnapshots = async (actions = [], attachment = null, meetingMeta = {}) => {
    if (!Array.isArray(actions) || actions.length === 0) return;
    for (const action of actions) {
      const ownerName = action.owner || action.assignee || action.staffName || '';
      const matchedStaff = matchStaffByName(ownerName);

      if (logInteraction && matchedStaff) {
        try {
          await logInteraction(matchedStaff.id, {
            date: meetingMeta.meetingDate || new Date().toISOString().slice(0, 10),
            type: 'Meeting Action',
            summary: `${meetingMeta.title || 'Meeting'}: ${action.task || action.title || 'Action'}`,
            source: 'meeting-minutes',
            buckTag: 'admin',
            interactionType: 'ADMIN',
            staffName: matchedStaff.name,
          });
        } catch (err) {
          console.error(err);
          addToast('error', 'Unable to sync to staff log for one action.');
        }
      }

      if (addTask) {
        const duplicate = (tasks || []).some(
          (t) =>
            t.meetingAttachmentId === (attachment?.id || '') &&
            t.meetingActionId === (action.id || '')
        );
        if (!duplicate) {
          try {
            await addTask({
              title: action.task || action.title || 'Meeting action',
              assignee: ownerName,
              dueDate: action.dueDate || meetingMeta.meetingDate || '',
              status: action.status === 'done' ? 'done' : 'todo',
              priority: 'Medium',
              category: 'Meeting follow-up',
              meetingId: meetingMeta.id || '',
              meetingTitle: meetingMeta.title || '',
              meetingAttachmentId: attachment?.id || '',
              meetingActionId: action.id || '',
              source: 'meeting-minutes',
            });
          } catch (err) {
            console.error(err);
            addToast('error', 'Could not create follow-up tasks for some actions.');
          }
        }
      }
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex flex-col gap-4 border-b border-slate-200 p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500">
              Meetings
            </p>
            <h1 className="text-3xl font-bold text-slate-900">Department Meeting Control Room</h1>
            <p className="text-sm text-slate-500 max-w-3xl">
              Build agendas, capture minutes against each item, archive past meetings, and keep
              wellbeing notes visible for every discussion.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <StatPill label="Awaiting Minutes" value={stats.awaitingMinutes} tone="amber" />
            <StatPill label="Upcoming" value={stats.upcoming} tone="emerald" />
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={scrollToAgendaBuilder}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold shadow-sm hover:bg-emerald-700"
            >
              <Plus size={16} />
              New Meeting
            </button>
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold shadow-sm hover:bg-slate-800"
            >
              <Sparkles size={16} />
              Import Meeting
            </button>
            <button
              type="button"
              onClick={handleExportBook}
              disabled={exportingBook}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-slate-800 text-sm font-semibold shadow-sm border border-slate-200 hover:border-slate-300"
            >
              <FileText size={16} />
              {exportingBook ? 'Preparing...' : 'Export PDF Book'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Vertical Flow */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-8 p-6 pb-4">
        {/* Section 1: Active Workspace - Create Agenda */}
        <div ref={agendaCardRef} className="flex-shrink-0">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em] mb-3">
            Active Workspace
          </div>
          <MeetingAgendaBuilder
            staff={staff}
            form={meetingForm}
            onChange={setMeetingForm}
            onSubmit={handleCreateMeeting}
          />
        </div>

        {/* Visual Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-slate-200"></div>
          <span className="text-xs font-semibold text-slate-400 px-2">Meeting Archive</span>
          <div className="flex-1 h-px bg-slate-200"></div>
        </div>

        {/* Section 2: Meeting Archive */}
        <div className="flex-1 min-h-0 flex flex-col gap-3">
          <div className="flex justify-end">
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-3 pr-9 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="Search archived meetings..."
              />
              <Search
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
          </div>

          <MeetingArchiveAccordion
            meetings={meetings}
            onUpdate={updateMeeting}
            staff={staff}
            searchQuery={searchQuery}
            onDelete={handleDeleteMeeting}
          />
        </div>
      </div>

      <ImportMinutesModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        text={importText}
        onChange={setImportText}
        onSubmit={handleRunImport}
        loading={importing}
        preview={aiMeetingDraft}
      />

      <IngestionReviewModal
        isOpen={isReviewOpen}
        aiResult={{ tasks: buildTasksFromActions(aiMeetingDraft?.actions || []) }}
        rawText={importText}
        staff={staff}
        user={user}
        onApprove={handleApproveImport}
        onClose={() => setIsReviewOpen(false)}
        isSaving={ingestionSaving}
        reviewOnly
      />
    </div>
  );
}