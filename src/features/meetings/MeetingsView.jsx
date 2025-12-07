import React, { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  Clock3,
  Download,
  FileText,
  MapPin,
  NotebookPen,
  Plus,
  Sparkles,
  Users,
} from 'lucide-react';
import { BrainCard } from '../../components/ui/BrainCard';
import { useMeetings } from '../../hooks/useMeetings';
import { useToast } from '../../context/ToastContext';
import { parseMeetingMinutes } from '../../services/ai/workflowAi';
import { IngestionReviewModal } from '../brain-dump/IngestionReviewModal';

const todayIso = () => new Date().toISOString().slice(0, 10);
const safeId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.floor(Math.random() * 100000)}`;

const defaultAgendaSeed = () => [
  { id: safeId(), title: 'Results & Outcomes', owner: '', duration: '10 min', minutes: '' },
  { id: safeId(), title: 'Curriculum / QA', owner: '', duration: '10 min', minutes: '' },
  { id: safeId(), title: 'Staff Wellbeing', owner: '', duration: '8 min', minutes: '' },
];

const focusOptions = ['Support', 'Challenge', 'Wellbeing', 'Action'];
const focusToInteractionType = (focus = '') => {
  const key = focus.toLowerCase();
  if (key === 'challenge') return 'CHALLENGE';
  if (key === 'support') return 'SUPPORT';
  if (key === 'wellbeing') return 'SUPPORT';
  return 'ADMIN';
};

const normalize = (value) => (value || '').toString().trim().toLowerCase();

export function MeetingsView({ user, staff = [], logInteraction, addTask, tasks = [] }) {
  const { meetings, addMeeting, updateMeeting, loading } = useMeetings(user);
  const { addToast } = useToast();

  const [selectedMeetingId, setSelectedMeetingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingBook, setExportingBook] = useState(false);
  const [importing, setImporting] = useState(false);
  const [ingestionSaving, setIngestionSaving] = useState(false);

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
  const weekGroups = useMemo(() => groupMeetingsByWeek(meetings), [meetings]);

  const scrollToAgendaBuilder = () => {
    if (agendaCardRef.current) {
      agendaCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  const handleSaveMeeting = async () => {
    if (!editableMeeting?.id) return;
    setSaving(true);
    const payload = {
      title: editableMeeting.title,
      meetingDate: editableMeeting.meetingDate,
      startTime: editableMeeting.startTime,
      location: editableMeeting.location,
      attendees: editableMeeting.attendees || [],
      agenda: ensureIds(editableMeeting.agenda || []),
      actions: ensureIds(editableMeeting.actions || []),
      staffNotes: ensureIds(editableMeeting.staffNotes || []),
      minutesSummary: editableMeeting.minutesSummary || '',
      attachments: editableMeeting.attachments || [],
      type: editableMeeting.type || 'live',
      status: editableMeeting.status || 'planned',
    };
    try {
      await updateMeeting(editableMeeting.id, payload);
      addToast('success', 'Meeting updated.');
    } catch (err) {
      console.error(err);
      addToast('error', 'Failed to save meeting.');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    if (!editableMeeting) return;
    setExporting(true);
    try {
      exportMinutes(editableMeeting);
      addToast('success', 'Minutes exported.');
    } catch (err) {
      console.error(err);
      addToast('error', 'Export failed.');
    } finally {
      setExporting(false);
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
        <div className="flex-1 min-h-0">
          <MeetingArchiveAccordion
            meetings={meetings}
            onUpdate={updateMeeting}
            staff={staff}
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

function MeetingArchiveAccordion({ meetings = [], onUpdate, staff = [] }) {
  const { addToast } = useToast();
  const [expandedId, setExpandedId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const attendeeInputRef = useRef(null);

  const archivedMeetings = useMemo(
    () =>
      [...(meetings || [])]
        .filter((m) => m.type === 'archive' || m.minutesSummary || (m.agenda || []).some((item) => item.minutes))
        .sort((a, b) => toMillis(b.meetingDate || b.createdAt) - toMillis(a.meetingDate || a.createdAt)),
    [meetings]
  );

  const initializeDraft = (meeting) => {
    if (!drafts[meeting.id]) {
      setDrafts((prev) => ({
        ...prev,
        [meeting.id]: {
          title: meeting.title,
          meetingDate: meeting.meetingDate,
          startTime: meeting.startTime,
          location: meeting.location,
          attendees: [...(meeting.attendees || [])],
          minutesSummary: meeting.minutesSummary,
        },
      }));
    }
  };

  const updateDraft = (meetingId, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [meetingId]: { ...prev[meetingId], [field]: value },
    }));
  };

  const addAttendee = (meetingId, name) => {
    if (!name.trim()) return;
    setDrafts((prev) => ({
      ...prev,
      [meetingId]: {
        ...prev[meetingId],
        attendees: Array.from(new Set([...(prev[meetingId]?.attendees || []), name.trim()])),
      },
    }));
    if (attendeeInputRef.current) attendeeInputRef.current.value = '';
  };

  const removeAttendee = (meetingId, name) => {
    setDrafts((prev) => ({
      ...prev,
      [meetingId]: {
        ...prev[meetingId],
        attendees: (prev[meetingId]?.attendees || []).filter((a) => a !== name),
      },
    }));
  };

  const handleSaveChanges = async (meeting) => {
    const draft = drafts[meeting.id];
    if (!draft) return;

    try {
      await onUpdate(meeting.id, {
        ...meeting,
        title: draft.title,
        meetingDate: draft.meetingDate,
        startTime: draft.startTime,
        location: draft.location,
        attendees: draft.attendees,
        minutesSummary: draft.minutesSummary,
      });
      setDrafts((prev) => {
        const updated = { ...prev };
        delete updated[meeting.id];
        return updated;
      });
      addToast('success', 'Meeting details saved.');
    } catch (err) {
      console.error(err);
      addToast('error', 'Failed to save changes.');
    }
  };

  const hasUnsavedChanges = (meetingId, meeting) => {
    const draft = drafts[meetingId];
    if (!draft) return false;
    return (
      draft.title !== meeting.title ||
      draft.meetingDate !== meeting.meetingDate ||
      draft.startTime !== meeting.startTime ||
      draft.location !== meeting.location ||
      draft.minutesSummary !== (meeting.minutesSummary || '') ||
      JSON.stringify(draft.attendees) !== JSON.stringify(meeting.attendees || [])
    );
  };

  if (archivedMeetings.length === 0) {
    return (
      <BrainCard className="p-8 text-center border-dashed border-2 border-slate-200">
        <NotebookPen size={28} className="text-slate-300 mx-auto mb-2" />
        <h3 className="text-slate-700 font-semibold">No meeting archive yet</h3>
        <p className="text-sm text-slate-500 mt-1">
          Create a new meeting above to start building your archive.
        </p>
      </BrainCard>
    );
  }

  return (
    <div className="space-y-3">
      {archivedMeetings.map((meeting) => {
        const isExpanded = expandedId === meeting.id;
        const hasChanges = hasUnsavedChanges(meeting.id, meeting);
        const draft = drafts[meeting.id] || { title: meeting.title, meetingDate: meeting.meetingDate };

        return (
          <BrainCard key={meeting.id} className="overflow-hidden">
            <button
              type="button"
              onClick={() => {
                setExpandedId(isExpanded ? null : meeting.id);
                if (!isExpanded) initializeDraft(meeting);
              }}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900">{meeting.title || 'Untitled Meeting'}</h4>
                  {hasChanges && (
                    <span className="text-[9px] font-bold uppercase px-2 py-1 rounded-full bg-amber-50 text-amber-700">
                      Unsaved
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                  <CalendarDays size={12} />
                  <span>{meeting.meetingDate || 'No date'}</span>
                  {meeting.startTime && (
                    <>
                      <span>•</span>
                      <span>{meeting.startTime}</span>
                    </>
                  )}
                  {(meeting.attendees || []).length > 0 && (
                    <>
                      <span>•</span>
                      <Users size={12} />
                      <span>{meeting.attendees.length} attendee{meeting.attendees.length !== 1 ? 's' : ''}</span>
                    </>
                  )}
                </div>
              </div>
              <ChevronDown
                size={18}
                className={clsx('text-slate-400 transition-transform flex-shrink-0', isExpanded ? 'rotate-180' : '')}
              />
            </button>

            {isExpanded && (
              <div className="border-t border-slate-100 p-4 space-y-4 bg-slate-50">
                {/* Meeting Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-white rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                      Meeting Title
                    </label>
                    <input
                      type="text"
                      value={draft.title || ''}
                      onChange={(e) => updateDraft(meeting.id, 'title', e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="Meeting title"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                      Date
                    </label>
                    <input
                      type="date"
                      value={draft.meetingDate || ''}
                      onChange={(e) => updateDraft(meeting.id, 'meetingDate', e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={draft.startTime || ''}
                      onChange={(e) => updateDraft(meeting.id, 'startTime', e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      value={draft.location || ''}
                      onChange={(e) => updateDraft(meeting.id, 'location', e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="Meeting location"
                    />
                  </div>
                </div>

                {/* Attendees */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                    Attendees
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      ref={attendeeInputRef}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addAttendee(meeting.id, e.currentTarget.value);
                        }
                      }}
                      className="flex-1 p-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="Type name + Enter"
                    />
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          addAttendee(meeting.id, e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="p-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Add staff
                      </option>
                      {staff.map((member) => (
                        <option key={member.id} value={member.name}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(draft.attendees || []).map((name) => (
                      <div
                        key={name}
                        className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200"
                      >
                        <span className="text-sm text-emerald-900 font-semibold">{name}</span>
                        <button
                          type="button"
                          onClick={() => removeAttendee(meeting.id, name)}
                          className="text-emerald-600 hover:text-emerald-700 flex-shrink-0"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {(draft.attendees || []).length === 0 && (
                      <span className="text-xs text-slate-400">No attendees yet</span>
                    )}
                  </div>
                </div>

                {/* Minutes Text Area */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                    Meeting Minutes
                  </label>
                  <textarea
                    value={draft.minutesSummary ?? ''}
                    onChange={(e) => updateDraft(meeting.id, 'minutesSummary', e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent whitespace-pre-wrap min-h-[160px] resize-none"
                    placeholder="Add or edit meeting minutes..."
                  />
                </div>

                {/* Agenda Items */}
                {(meeting.agenda || []).length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                      Agenda Items
                    </label>
                    <div className="space-y-2">
                      {(meeting.agenda || []).map((item) => (
                        <div key={item.id} className="p-3 rounded-lg bg-white border border-slate-200">
                          <div className="text-sm font-semibold text-slate-800">{item.title || 'Agenda item'}</div>
                          {item.owner && <div className="text-[11px] text-slate-500">Owner: {item.owner}</div>}
                          {item.minutes && (
                            <div className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{item.minutes}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Items */}
                {(meeting.actions || []).length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                      Actions
                    </label>
                    <div className="space-y-2">
                      {(meeting.actions || []).map((action) => (
                        <div
                          key={action.id}
                          className="flex items-start gap-2 p-3 rounded-lg bg-white border border-slate-200"
                        >
                          <div className={clsx(
                            'mt-1 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center text-xs',
                            action.status === 'done'
                              ? 'bg-emerald-100 border-emerald-500 text-emerald-600'
                              : 'bg-slate-50 border-slate-300 text-slate-400'
                          )}>
                            {action.status === 'done' && '✓'}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-slate-800">{action.task || 'Action'}</div>
                            {action.owner && <div className="text-[11px] text-slate-500">Assignee: {action.owner}</div>}
                            {action.dueDate && <div className="text-[11px] text-slate-500">Due: {action.dueDate}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Save Button */}
                {hasChanges && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleSaveChanges(meeting)}
                      className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 flex items-center gap-2"
                    >
                      <CheckCircle2 size={16} /> Save All Changes
                    </button>
                  </div>
                )}
              </div>
            )}
          </BrainCard>
        );
      })}
    </div>
  );
}

function MeetingAgendaBuilder({ staff, form, onChange, onSubmit }) {
  const attendeeInputRef = useRef(null);
  const addAttendee = (name) => {
    if (!name) return;
    onChange((prev) => ({
      ...prev,
      attendees: Array.from(new Set([...(prev.attendees || []), name])),
    }));
    if (attendeeInputRef.current) attendeeInputRef.current.value = '';
  };

  const updateAgendaItem = (id, field, value) => {
    onChange((prev) => ({
      ...prev,
      agenda: (prev.agenda || []).map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }));
  };

  const addAgendaRow = () => {
    onChange((prev) => ({
      ...prev,
      agenda: [...(prev.agenda || []), { id: safeId(), title: '', owner: '', duration: '5 min' }],
    }));
  };

  const removeAgendaRow = (id) => {
    onChange((prev) => ({
      ...prev,
      agenda: (prev.agenda || []).filter((item) => item.id !== id),
    }));
  };

  return (
    <BrainCard className="p-6 shadow-md shadow-emerald-100/60 border-emerald-50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <NotebookPen size={18} className="text-emerald-600" />
          <h3 className="text-lg font-bold text-slate-900">Create Meeting Agenda</h3>
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
          New
        </span>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Title</label>
            <input
              value={form.title}
              onChange={(e) => onChange((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white"
              placeholder="Department meeting focus"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Date</label>
              <input
                type="date"
                value={form.meetingDate}
                onChange={(e) => onChange((prev) => ({ ...prev, meetingDate: e.target.value }))}
                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Time</label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => onChange((prev) => ({ ...prev, startTime: e.target.value }))}
                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white"
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Location</label>
            <input
              value={form.location}
              onChange={(e) => onChange((prev) => ({ ...prev, location: e.target.value }))}
              className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white"
              placeholder="Dept office / online"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">
              Attendees
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={attendeeInputRef}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addAttendee(e.currentTarget.value.trim());
                  }
                }}
                className="flex-1 p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-white"
                placeholder="Type a name + Enter"
              />
              <select
                onChange={(e) => {
                  addAttendee(e.target.value);
                  e.target.value = '';
                }}
                className="p-3 border border-slate-200 rounded-xl bg-white text-sm"
                defaultValue=""
              >
                <option value="" disabled>
                  Add staff
                </option>
                {staff.map((member) => (
                  <option key={member.id} value={member.name}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {(form.attendees || []).map((name) => (
                <span
                  key={name}
                  className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-semibold"
                >
                  {name}
                </span>
              ))}
              {(form.attendees || []).length === 0 && (
                <span className="text-xs text-slate-400">No attendees added yet.</span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-500 uppercase">Agenda</label>
            <button
              type="button"
              onClick={addAgendaRow}
              className="flex items-center gap-1 text-xs font-bold text-emerald-700"
            >
              <Plus size={14} /> Add item
            </button>
          </div>
          <div className="space-y-2">
            {(form.agenda || []).map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1.2fr,0.7fr,0.5fr,auto] gap-2 items-center bg-white border border-slate-100 rounded-xl p-3"
              >
                <input
                  value={item.title}
                  onChange={(e) => updateAgendaItem(item.id, 'title', e.target.value)}
                  className="p-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500"
                  placeholder="Agenda item"
                />
                <input
                  value={item.owner}
                  onChange={(e) => updateAgendaItem(item.id, 'owner', e.target.value)}
                  className="p-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500"
                  placeholder="Owner"
                />
                <input
                  value={item.duration}
                  onChange={(e) => updateAgendaItem(item.id, 'duration', e.target.value)}
                  className="p-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500"
                  placeholder="10 min"
                />
                <button
                  type="button"
                  onClick={() => removeAgendaRow(item.id)}
                  className="text-slate-400 hover:text-rose-500 p-1"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-5 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all"
          >
            Save Agenda
          </button>
        </div>
      </form>
    </BrainCard>
  );
}

function MeetingAccordion({ weeks = [], selectedId, onSelect, loading, renderDetail }) {
  if (loading) {
    return (
      <BrainCard className="p-6">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <ClipboardList size={16} />
          Loading meetings...
        </div>
      </BrainCard>
    );
  }

  if (!weeks.length) {
    return (
      <BrainCard className="p-6">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <ClipboardList size={16} />
          Create an agenda to start logging minutes.
        </div>
      </BrainCard>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {weeks.map((week) => (
        <BrainCard key={week.key} className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                <CalendarDays size={16} />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">{week.label}</div>
                <div className="text-[11px] text-slate-500">{week.rangeLabel}</div>
              </div>
            </div>
            <Badge tone="slate">
              {week.meetings.length} meeting{week.meetings.length === 1 ? '' : 's'}
            </Badge>
          </div>
          <div className="flex flex-col gap-2">
            {week.meetings.map((meeting) => {
              const isSelected = selectedId === meeting.id;
              const hasNotes = hasMinutes(meeting);
              const attachments = meeting.attachments?.length || 0;
              const detail = isSelected && renderDetail ? renderDetail(meeting) : null;
              return (
                <div
                  key={meeting.id}
                  className={clsx(
                    'rounded-xl border bg-white transition-all',
                    isSelected ? 'border-slate-900 shadow-lg shadow-slate-200/60' : 'border-slate-200'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(isSelected ? null : meeting.id)}
                    className="w-full flex items-start justify-between gap-2 p-3 text-left"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-sm text-slate-900">{meeting.title}</div>
                        {meeting.type === 'archive' && <Badge tone="slate">Archive</Badge>}
                      </div>
                      <div className="text-xs flex items-center gap-2 text-slate-500">
                        <CalendarDays size={14} />
                        <span>{meeting.meetingDate || 'No date'}</span>
                        {meeting.startTime && <span>• {meeting.startTime}</span>}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {(meeting.attendees || []).slice(0, 3).join(', ') || 'Attendees TBD'}
                        {meeting.attendees?.length > 3 && ' +'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={hasNotes ? 'emerald' : 'amber'}>
                        {hasNotes ? 'Minutes' : 'Need minutes'}
                      </Badge>
                      {attachments > 0 && <Badge tone="sky">{attachments} file{attachments > 1 ? 's' : ''}</Badge>}
                      <ChevronDown
                        size={16}
                        className={clsx('text-slate-500 transition-transform', isSelected ? 'rotate-180' : '')}
                      />
                    </div>
                  </button>
                  {isSelected && detail && (
                    <div className="border-t border-slate-100 bg-slate-50 rounded-b-xl p-3">{detail}</div>
                  )}
                </div>
              );
            })}
          </div>
        </BrainCard>
      ))}
    </div>
  );
}

function MeetingDetail({
  staff,
  meeting,
  onChange,
  onSave,
  onExport,
  logInteraction,
  saving,
  exporting,
}) {
  const [staffNoteDraft, setStaffNoteDraft] = useState({
    staffId: '',
    staffName: '',
    focus: 'Wellbeing',
    note: '',
  });
  const { addToast } = useToast();
  const minutesSummaryRef = useRef(null);

  const autoGrow = (element) => {
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.max(element.scrollHeight, 180)}px`;
  };

  useEffect(() => {
    autoGrow(minutesSummaryRef.current);
  }, [meeting?.id, meeting?.minutesSummary]);

  if (!meeting) {
    return (
      <BrainCard className="p-6 h-full flex items-center justify-center border-dashed border-2 border-slate-200">
        <div className="text-center space-y-2">
          <h3 className="font-bold text-slate-800">Select or create a meeting</h3>
          <p className="text-sm text-slate-500">
            Agendas, minutes, and wellbeing notes will appear here for the selected meeting.
          </p>
        </div>
      </BrainCard>
    );
  }

  const updateField = (field, value) => onChange((prev) => ({ ...prev, [field]: value }));
  const updateAgendaItem = (id, field, value) => {
    onChange((prev) => ({
      ...prev,
      agenda: (prev.agenda || []).map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }));
  };
  const addAgendaItem = () =>
    onChange((prev) => ({
      ...prev,
      agenda: [...(prev.agenda || []), { id: safeId(), title: '', owner: '', duration: '', minutes: '' }],
    }));
  const updateAction = (id, field, value) =>
    onChange((prev) => ({
      ...prev,
      actions: (prev.actions || []).map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }));
  const addAction = () =>
    onChange((prev) => ({
      ...prev,
      actions: [...(prev.actions || []), { id: safeId(), task: '', owner: '', dueDate: '', status: 'open' }],
    }));
  const toggleActionStatus = (id) =>
    onChange((prev) => ({
      ...prev,
      actions: (prev.actions || []).map((item) =>
        item.id === id
          ? { ...item, status: item.status === 'done' ? 'open' : 'done' }
          : item
      ),
    }));

  const addStaffNote = async () => {
    if (!staffNoteDraft.note || !staffNoteDraft.staffName) return;
    onChange((prev) => ({
      ...prev,
      staffNotes: [
        ...(prev.staffNotes || []),
        { ...staffNoteDraft, id: safeId() },
      ],
    }));
    setStaffNoteDraft({ staffId: '', staffName: '', focus: 'Wellbeing', note: '' });

    if (logInteraction && staffNoteDraft.staffId) {
      try {
        await logInteraction(staffNoteDraft.staffId, {
          date: meeting.meetingDate || new Date().toISOString().slice(0, 10),
          type: 'Meeting',
          summary: staffNoteDraft.note,
          source: 'meeting-minutes',
          buckTag: staffNoteDraft.focus.toLowerCase(),
          interactionType: focusToInteractionType(staffNoteDraft.focus),
          staffName: staffNoteDraft.staffName,
        });
        addToast('success', 'Staff log updated.');
      } catch (err) {
        console.error(err);
        addToast('error', 'Saved note but could not sync to staff log.');
      }
    }
  };

  const actionButtons = (
    <div className="flex flex-wrap gap-2 justify-end relative z-10">
      <button
        onClick={onExport}
        className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-slate-800"
        disabled={exporting}
      >
        <Download size={16} /> {exporting ? 'Exporting...' : 'Export minutes'}
      </button>
      <button
        onClick={onSave}
        className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-emerald-700"
        disabled={saving}
      >
        <CheckCircle2 size={16} /> {saving ? 'Saving...' : 'Save updates'}
      </button>
    </div>
  );

  return (
    <BrainCard className="relative p-0 shadow-lg shadow-slate-200/50 min-w-0 w-full overflow-visible">
      <div className="flex flex-col gap-6 md:gap-8 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <CalendarDays size={14} /> <span>{meeting.meetingDate || 'Date TBD'}</span>
              {meeting.startTime && (
                <>
                  <span className="text-slate-300">•</span>
                  <Clock3 size={14} /> <span>{meeting.startTime}</span>
                </>
              )}
              {meeting.location && (
                <>
                  <span className="text-slate-300">•</span>
                  <MapPin size={14} /> <span>{meeting.location}</span>
                </>
              )}
            </div>
            <input
              value={meeting.title || ''}
              onChange={(e) => updateField('title', e.target.value)}
              className="text-2xl md:text-3xl font-bold text-slate-900 w-full bg-transparent border-b border-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
          {actionButtons}
        </div>

        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
            Attendees
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {(meeting.attendees || []).map((name) => (
              <div
                key={name}
                className="flex items-center gap-2 px-3 py-2 rounded-full bg-slate-50 border border-slate-200"
              >
                <span className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center">
                  {name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </span>
                <span className="text-sm font-semibold text-slate-700">{name}</span>
              </div>
            ))}
            {(meeting.attendees || []).length === 0 && (
              <span className="text-xs text-slate-400">No attendees logged.</span>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <ClipboardList size={16} /> Agenda + Minutes
            </h4>
            <button
              type="button"
              onClick={addAgendaItem}
              className="text-xs font-bold text-emerald-700 flex items-center gap-1"
            >
              <Plus size={14} /> Add item
            </button>
          </div>
          <div className="space-y-3">
            {(meeting.agenda || []).map((item) => (
              <div
                key={item.id}
                className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-[1fr,0.6fr,0.4fr] gap-2">
                  <input
                    value={item.title}
                    onChange={(e) => updateAgendaItem(item.id, 'title', e.target.value)}
                    className="p-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500"
                    placeholder="Agenda item"
                  />
                  <input
                    value={item.owner}
                    onChange={(e) => updateAgendaItem(item.id, 'owner', e.target.value)}
                    className="p-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500"
                    placeholder="Owner"
                  />
                  <input
                    value={item.duration}
                    onChange={(e) => updateAgendaItem(item.id, 'duration', e.target.value)}
                    className="p-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500"
                    placeholder="Duration"
                  />
                </div>
                <textarea
                  value={item.minutes || ''}
                  onChange={(e) => updateAgendaItem(item.id, 'minutes', e.target.value)}
                  onInput={(e) => autoGrow(e.target)}
                  className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 min-h-[140px]"
                  placeholder="Capture discussion / decisions for this agenda line"
                />
              </div>
            ))}
            {(meeting.agenda || []).length === 0 && (
              <div className="text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg p-3">
                No agenda items added for this meeting.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <NotebookPen size={16} /> Minutes summary
          </div>
          <textarea
            value={meeting.minutesSummary || ''}
            ref={minutesSummaryRef}
            onChange={(e) => updateField('minutesSummary', e.target.value)}
            onInput={(e) => autoGrow(e.target)}
            className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:ring-1 focus:ring-emerald-500 min-h-[200px] resize-vertical"
            placeholder="Key decisions, risks, and headlines"
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <AlertTriangle size={14} className="text-amber-500" /> Actions / follow ups
            </div>
            <div className="space-y-2">
              {(meeting.actions || []).map((action) => (
                <div
                  key={action.id}
                  className="bg-white border border-slate-100 rounded-lg p-2 grid grid-cols-1 sm:grid-cols-[1fr,0.7fr,0.5fr,auto] gap-2 items-center"
                >
                  <input
                    value={action.task || ''}
                    onChange={(e) => updateAction(action.id, 'task', e.target.value)}
                    className="p-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500"
                    placeholder="Action"
                  />
                  <input
                    value={action.owner || ''}
                    onChange={(e) => updateAction(action.id, 'owner', e.target.value)}
                    className="p-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500"
                    placeholder="Owner"
                  />
                  <input
                    type="date"
                    value={action.dueDate || ''}
                    onChange={(e) => updateAction(action.id, 'dueDate', e.target.value)}
                    className="p-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => toggleActionStatus(action.id)}
                    className={clsx(
                      'px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 justify-center',
                      action.status === 'done'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-white border border-slate-200 text-slate-600'
                    )}
                  >
                    <CheckSquare size={14} />
                    {action.status === 'done' ? 'Done' : 'Open'}
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addAction}
                className="w-full py-2 border border-dashed border-emerald-300 text-emerald-700 rounded-lg text-sm font-semibold hover:bg-emerald-50"
              >
                Add follow-up
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Users size={16} /> Staff / Wellbeing notes
              </h4>
              <button
                type="button"
                onClick={addStaffNote}
                className="text-xs font-bold text-emerald-700 flex items-center gap-1"
              >
                <Plus size={14} /> Add note
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[0.9fr,0.5fr,1.1fr,auto] gap-2 items-center">
              <select
                value={staffNoteDraft.staffId}
                onChange={(e) => {
                  const member = staff.find((s) => s.id === e.target.value);
                  setStaffNoteDraft((prev) => ({
                    ...prev,
                    staffId: e.target.value,
                    staffName: member?.name || '',
                  }));
                }}
                className="p-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                <option value="">Pick staff member</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
              <select
                value={staffNoteDraft.focus}
                onChange={(e) => setStaffNoteDraft((prev) => ({ ...prev, focus: e.target.value }))}
                className="p-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                {focusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <input
                value={staffNoteDraft.note}
                onChange={(e) => setStaffNoteDraft((prev) => ({ ...prev, note: e.target.value }))}
                className="p-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500"
                placeholder="Capture wellbeing or interaction notes"
              />
              <button
                type="button"
                onClick={addStaffNote}
                className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
              >
                Save
              </button>
            </div>
            <div className="space-y-2">
              {(meeting.staffNotes || []).map((note) => (
                <div
                  key={note.id}
                  className="border border-slate-100 rounded-lg p-3 flex items-start justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
                        {note.staffName || 'Unassigned'}
                      </span>
                      <Badge tone="amber">{note.focus}</Badge>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{note.note}</p>
                  </div>
                </div>
              ))}
              {(meeting.staffNotes || []).length === 0 && (
                <div className="text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg p-3">
                  No staff notes captured yet.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          {actionButtons}
        </div>
      </div>
    </BrainCard>
  );
}

function ImportMinutesModal({ isOpen, onClose, text, onChange, onSubmit, loading, preview }) {
  const textareaRef = useRef(null);

  if (!isOpen) return null;

  const actionsPreview = (preview?.actions || []).slice(0, 3);

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 border-b border-slate-200 p-6 flex items-start justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2">
              <Sparkles size={14} className="text-emerald-500" /> Import meeting minutes
            </div>
            <div className="text-lg font-bold text-slate-900">Paste raw minutes to ingest</div>
            <p className="text-sm text-slate-500">
              We&apos;ll extract the meeting date, attendees, agenda items, and action points.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 flex-shrink-0"
            aria-label="Close import modal"
          >
            X
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            className="w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none h-[200px]"
            placeholder="Paste the rough minutes here..."
          />

          {preview && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase">
                <Sparkles size={14} />
                Draft detected
              </div>
              <div className="text-sm text-emerald-800 mt-1">
                {preview.meetingDate ? `Date: ${preview.meetingDate}` : 'Date not detected yet'}
              </div>
              {preview.attendees?.length > 0 && (
                <div className="text-[11px] text-emerald-800 mt-1">
                  Attendees: {preview.attendees.slice(0, 5).join(', ')}
                  {preview.attendees.length > 5 && ' +'}
                </div>
              )}
              {actionsPreview.length > 0 && (
                <div className="mt-2 space-y-1">
                  {actionsPreview.map((action, idx) => (
                    <div key={action.id || idx} className="text-xs text-emerald-900">
                      • {action.title || 'Action'}{' '}
                      {action.owner ? <span className="text-emerald-700">({action.owner})</span> : ''}
                    </div>
                  ))}
                  {preview.actions?.length > actionsPreview.length && (
                    <div className="text-[11px] text-emerald-700">
                      +{preview.actions.length - actionsPreview.length} more action
                      {preview.actions.length - actionsPreview.length === 1 ? '' : 's'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 border-t border-slate-200 p-4 bg-white flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-70"
          >
            {loading ? 'Parsing...' : 'Run AI import'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MinutesNotebook({ meetings = [], onSave }) {
  const { addToast } = useToast();
  const [openId, setOpenId] = useState(null);
  const [drafts, setDrafts] = useState({});

  const sorted = useMemo(
    () =>
      [...(meetings || [])].sort(
        (a, b) => toMillis(b.meetingDate || b.createdAt) - toMillis(a.meetingDate || a.createdAt)
      ),
    [meetings]
  );

  const initialDrafts = useMemo(() => {
    const map = {};
    sorted.forEach((m) => {
      if (!m?.id) return;
      map[m.id] = {
        minutesSummary: m.minutesSummary || '',
        agendaMinutes: Object.fromEntries(
          ensureIds(m.agenda || []).map((item) => [item.id, item.minutes || ''])
        ),
      };
    });
    return map;
  }, [sorted]);

  const updateDraft = (meetingId, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [meetingId]: { ...(prev[meetingId] || {}), [field]: value },
    }));
  };

  const updateAgendaDraft = (meetingId, itemId, value) => {
    setDrafts((prev) => {
      const draft = prev[meetingId] || { agendaMinutes: {} };
      return {
        ...prev,
        [meetingId]: {
          ...draft,
          agendaMinutes: { ...(draft.agendaMinutes || {}), [itemId]: value },
        },
      };
    });
  };

  const handleSave = async (meeting) => {
    if (!meeting?.id || !onSave) return;
    const draft = drafts[meeting.id] || {};
    const minutesSummary = draft.minutesSummary ?? meeting.minutesSummary ?? '';
    const agenda = ensureIds(meeting.agenda || []).map((item) => ({
      ...item,
      minutes: draft.agendaMinutes?.[item.id] ?? item.minutes ?? '',
    }));
    try {
      await onSave(meeting.id, { minutesSummary, agenda });
      addToast('success', 'Minutes saved.');
    } catch (err) {
      console.error(err);
      addToast('error', 'Could not save minutes.');
    }
  };

  if (!sorted.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
        <NotebookPen size={14} /> Minutes Notebook
      </div>
      {sorted.map((meeting) => {
        const draft = drafts[meeting.id] || initialDrafts[meeting.id] || { agendaMinutes: {} };
        const agenda = ensureIds(meeting.agenda || []);
        const isOpen = openId === meeting.id;
        return (
          <BrainCard key={meeting.id} className="p-4">
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : meeting.id)}
              className="w-full flex items-center justify-between text-left"
            >
              <div>
                <div className="text-sm font-bold text-slate-900">{meeting.title}</div>
                <div className="text-[11px] text-slate-500 flex items-center gap-2">
                  <CalendarDays size={12} /> {meeting.meetingDate || 'No date'}
                </div>
              </div>
              <ChevronDown
                size={16}
                className={clsx('text-slate-500 transition-transform', isOpen ? 'rotate-180' : '')}
              />
            </button>
            {isOpen && (
              <div className="mt-4 space-y-4">
                <textarea
                  value={draft.minutesSummary ?? meeting.minutesSummary ?? ''}
                  onChange={(e) => updateDraft(meeting.id, 'minutesSummary', e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:ring-1 focus:ring-emerald-500 min-h-[140px]"
                  placeholder="Minutes summary for this meeting"
                />
                <div className="space-y-3">
                  {agenda.map((item) => (
                    <div key={item.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50">
                      <div className="text-sm font-semibold text-slate-800">{item.title || 'Agenda item'}</div>
                      <textarea
                        value={draft.agendaMinutes?.[item.id] ?? item.minutes ?? ''}
                        onChange={(e) => updateAgendaDraft(meeting.id, item.id, e.target.value)}
                        className="w-full mt-2 p-2 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-emerald-500 min-h-[120px]"
                        placeholder="Minutes for this agenda line"
                      />
                    </div>
                  ))}
                  {agenda.length === 0 && (
                    <div className="text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg p-3">
                      No agenda items captured for this meeting.
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleSave(meeting)}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700"
                  >
                    Save minutes
                  </button>
                </div>
              </div>
            )}
          </BrainCard>
        );
      })}
    </div>
  );
}

function StatPill({ label, value, tone = 'slate' }) {
  const toneClass = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    sky: 'bg-sky-50 text-sky-700 border-sky-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-100',
  }[tone];
  return (
    <div className={`px-4 py-2 rounded-full border text-sm font-bold ${toneClass}`}>
      {label}: {value}
    </div>
  );
}

function Badge({ children, tone = 'slate' }) {
  const toneClass = {
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    sky: 'bg-sky-100 text-sky-700 border-sky-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold border ${toneClass}`}>
      {children}
    </span>
  );
}

const ensureIds = (items = []) =>
  (Array.isArray(items) ? items : []).map((item) => ({
    id: item.id || safeId(),
    ...item,
  }));

const hasMinutes = (meeting) => {
  if (!meeting) return false;
  if (meeting.minutesSummary && meeting.minutesSummary.trim()) return true;
  return (meeting.agenda || []).some((item) => (item.minutes || '').trim());
};

const toMillis = (value) => {
  try {
    const d =
      typeof value?.toDate === 'function'
        ? value.toDate()
        : value
          ? new Date(value)
          : null;
    if (!d) return 0;
    const ms = d.getTime();
    return Number.isNaN(ms) ? 0 : ms;
  } catch {
    return 0;
  }
};

const formatWeekLabel = (dateValue) => {
  try {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(dateValue);
  } catch {
    return 'Undated';
  }
};

const groupMeetingsByWeek = (meetings = []) => {
  const buckets = new Map();
  (meetings || []).forEach((meeting) => {
    const dateValue = meeting.meetingDate || meeting.createdAt || '';
    const baseDate =
      typeof dateValue?.toDate === 'function' ? dateValue.toDate() : dateValue ? new Date(dateValue) : null;
    const weekStart = baseDate && !Number.isNaN(baseDate.getTime()) ? new Date(baseDate) : null;
    if (weekStart) {
      const diff = (weekStart.getDay() + 6) % 7; // Monday as start
      weekStart.setDate(weekStart.getDate() - diff);
      weekStart.setHours(0, 0, 0, 0);
    }
    const key = weekStart ? weekStart.toISOString().slice(0, 10) : 'undated';
    if (!buckets.has(key)) {
      buckets.set(key, { key, start: weekStart, meetings: [] });
    }
    buckets.get(key).meetings.push(meeting);
  });

  return Array.from(buckets.values())
    .sort((a, b) => {
      if (!a.start) return 1;
      if (!b.start) return -1;
      return b.start.getTime() - a.start.getTime();
    })
    .map((group) => {
      const start = group.start;
      const end = start ? new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000) : null;
      return {
        ...group,
        label: start ? `Week of ${formatWeekLabel(start)}` : 'Undated meetings',
        rangeLabel:
          start && end ? `${formatWeekLabel(start)} – ${formatWeekLabel(end)}` : 'No date captured',
        meetings: group.meetings.sort(
          (a, b) => toMillis(b.meetingDate || b.createdAt) - toMillis(a.meetingDate || a.createdAt)
        ),
      };
    });
};

const escapeHtml = (value = '') =>
  value
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatMultiline = (value = '') => escapeHtml(value || '').replace(/\n/g, '<br />');

function exportMinutes(meeting) {
  const lines = [];
  lines.push(`# ${meeting.title || 'Meeting Minutes'}`);
  lines.push('');
  lines.push(`Date: ${meeting.meetingDate || 'N/A'} ${meeting.startTime ? `at ${meeting.startTime}` : ''}`);
  lines.push(`Location: ${meeting.location || 'N/A'}`);
  lines.push(`Attendees: ${(meeting.attendees || []).join(', ') || 'N/A'}`);
  lines.push('');
  lines.push('## Agenda + Minutes');
  (meeting.agenda || []).forEach((item, idx) => {
    lines.push(`${idx + 1}. ${item.title || 'Agenda item'} (${item.owner || 'Owner TBD'} - ${item.duration || 'N/A'})`);
    lines.push(`   - Notes: ${(item.minutes || '').trim() || 'N/A'}`);
    lines.push('');
  });
  lines.push('## Actions / Follow ups');
  if ((meeting.actions || []).length === 0) {
    lines.push('- None recorded');
  } else {
    (meeting.actions || []).forEach((action) => {
      lines.push(`- [${action.status === 'done' ? 'x' : ' '}] ${action.task || 'Action'} (Owner: ${action.owner || 'TBD'} - Due: ${action.dueDate || 'N/A'})`);
    });
  }
  lines.push('');
  lines.push('## Staff / Wellbeing notes');
  if ((meeting.staffNotes || []).length === 0) {
    lines.push('- No staff notes captured.');
  } else {
    (meeting.staffNotes || []).forEach((note) => {
      lines.push(`- ${note.staffName || 'Unassigned'} [${note.focus || 'Note'}]: ${note.note || ''}`);
    });
  }
  lines.push('');
  lines.push('## Attachments');
  if ((meeting.attachments || []).length === 0) {
    lines.push('- None attached.');
  } else {
    (meeting.attachments || []).forEach((file) => {
      lines.push(`- ${file.name} (${file.meetingDate || 'n/a'}) ${file.url}`);
    });
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = (meeting.title || 'meeting-minutes').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  link.href = url;
  link.download = `${safeName || 'meeting'}-minutes.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function exportMeetingsBook(meetings = []) {
  if (typeof window === 'undefined') return;
  const weeks = groupMeetingsByWeek(meetings);
  const style = `
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 32px; }
    .archive { max-width: 1000px; margin: 0 auto; }
    .week { margin-bottom: 32px; }
    .week:not(:first-of-type) { page-break-before: always; }
    .week-header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px; }
    .week-title { font-size: 16px; font-weight: 700; }
    .week-range { font-size: 12px; color: #475569; }
    .meeting { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 16px; margin-bottom: 12px; box-shadow: 0 8px 30px rgba(15, 23, 42, 0.06); }
    .meeting-title { font-size: 16px; font-weight: 700; margin: 0 0 4px 0; }
    .meta { font-size: 12px; color: #475569; margin-bottom: 4px; }
    .section-title { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #475569; margin: 10px 0 4px; }
    .body-text { font-size: 14px; line-height: 1.5; color: #0f172a; }
    ul { padding-left: 18px; margin: 6px 0; }
    li { margin-bottom: 4px; font-size: 13px; color: #0f172a; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; border: 1px solid #cbd5e1; font-size: 11px; color: #0f172a; background: #f8fafc; }
    @media print {
      body { background: #ffffff; }
      .meeting { box-shadow: none; page-break-inside: avoid; }
      .week { page-break-inside: avoid; }
      button { display: none !important; }
    }
  `;

  const content = weeks
    .map(
      (week) => `
      <section class="week">
        <div class="week-header">
          <div class="week-title">${escapeHtml(week.label)}</div>
          <div class="week-range">${escapeHtml(week.rangeLabel || '')}</div>
        </div>
        ${week.meetings
          .map((meeting) => {
            const agendaList = (meeting.agenda || [])
              .map(
                (item, idx) =>
                  `<li><strong>${idx + 1}. ${escapeHtml(item.title || 'Agenda item')}</strong>${
                    item.owner ? ` (${escapeHtml(item.owner)})` : ''
                  }${item.minutes ? ` – ${formatMultiline(item.minutes)}` : ''}</li>`
              )
              .join('');
            const actionsList = (meeting.actions || [])
              .map(
                (action) =>
                  `<li><span class="badge">${action.status === 'done' ? 'Done' : 'Open'}</span> ${escapeHtml(
                    action.task || 'Action'
                  )}${action.owner ? ` — ${escapeHtml(action.owner)}` : ''}${
                    action.dueDate ? ` (Due ${escapeHtml(action.dueDate)})` : ''
                  }</li>`
              )
              .join('');
            return `
              <article class="meeting">
                <h2 class="meeting-title">${escapeHtml(meeting.title || 'Meeting')}</h2>
                <div class="meta">
                  ${escapeHtml(meeting.meetingDate || 'Date TBD')}
                  ${meeting.startTime ? ` • ${escapeHtml(meeting.startTime)}` : ''}
                  ${meeting.location ? ` • ${escapeHtml(meeting.location)}` : ''}
                  ${meeting.type === 'archive' ? ' • Archive' : ''}
                </div>
                <div class="meta">Attendees: ${escapeHtml((meeting.attendees || []).join(', ') || '—')}</div>
                <div class="section-title">Minutes</div>
                <div class="body-text">${formatMultiline(meeting.minutesSummary || 'No minutes summary recorded.')}</div>
                ${
                  agendaList
                    ? `<div class="section-title">Agenda</div><ul>${agendaList}</ul>`
                    : ''
                }
                ${
                  actionsList
                    ? `<div class="section-title">Actions</div><ul>${actionsList}</ul>`
                    : ''
                }
              </article>
            `;
          })
          .join('')}
      </section>
    `
    )
    .join('');

  const html = `
    <html>
      <head>
        <title>Meeting Minutes Archive</title>
        <style>${style}</style>
      </head>
      <body>
        <div class="archive">
          ${content}
        </div>
      </body>
    </html>
  `;

  const win = window.open('', '_blank');
  if (!win) throw new Error('Blocked by browser');
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}
