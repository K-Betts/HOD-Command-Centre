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
      typeof dateValue?.toDate === 'function'
        ? dateValue.toDate()
        : dateValue
          ? new Date(dateValue)
          : null;
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

const meetingMatchesQuery = (meeting, query) => {
  if (!meeting || !query) return true;

  const parts = [];

  if (meeting.title) parts.push(meeting.title);
  if (meeting.meetingDate) parts.push(meeting.meetingDate);
  if (meeting.startTime) parts.push(meeting.startTime);
  if (meeting.location) parts.push(meeting.location);
  if (Array.isArray(meeting.attendees)) parts.push(meeting.attendees.join(' '));
  if (meeting.minutesSummary) parts.push(meeting.minutesSummary);

  if (Array.isArray(meeting.agenda)) {
    meeting.agenda.forEach((item) => {
      if (!item) return;
      if (item.title) parts.push(item.title);
      if (item.owner) parts.push(item.owner);
      if (item.minutes) parts.push(item.minutes);
    });
  }

  if (Array.isArray(meeting.actions)) {
    meeting.actions.forEach((action) => {
      if (!action) return;
      if (action.task) parts.push(action.task);
      if (action.owner) parts.push(action.owner);
      if (action.dueDate) parts.push(action.dueDate);
    });
  }

  if (Array.isArray(meeting.staffNotes)) {
    meeting.staffNotes.forEach((note) => {
      if (!note) return;
      if (note.staffName) parts.push(note.staffName);
      if (note.focus) parts.push(note.focus);
      if (note.note) parts.push(note.note);
    });
  }

  const haystack = parts.join(' ').toLowerCase();
  return haystack.includes(query);
};

export {
  defaultAgendaSeed,
  ensureIds,
  focusOptions,
  focusToInteractionType,
  groupMeetingsByWeek,
  hasMinutes,
  meetingMatchesQuery,
  normalize,
  safeId,
  toMillis,
  todayIso,
};
