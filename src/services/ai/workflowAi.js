const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const modelPath =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent';

const basePrompt =
  'Extract: Date, Attendees, Agenda Items, and Action Points. For Action Points, identify the Owner and Deadline.';

const emptyResult = {
  meetingDate: '',
  attendees: [],
  agenda: [],
  actions: [],
  minutesSummary: '',
};

const fetchJson = async (prompt) => {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
  };
  const res = await fetch(`${modelPath}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`AI request failed with status ${res.status}`);
  }
  return res.json();
};

const extractTextCandidate = (data) => {
  const part =
    data?.candidates?.[0]?.content?.parts?.find?.((p) => typeof p?.text === 'string') ||
    (Array.isArray(data?.candidates?.[0]?.content?.parts)
      ? data.candidates[0].content.parts[0]
      : null);
  return typeof part?.text === 'string' ? part.text : '';
};

const extractJsonBlock = (raw) => {
  if (typeof raw !== 'string') return '';
  const fenced = raw.match(/```(?:json)?\\s*([\\s\\S]*?)```/i);
  const inner = fenced ? fenced[1].trim() : raw.trim();
  const start = inner.indexOf('{');
  const end = inner.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return '';
  return inner.slice(start, end + 1);
};

const normalizeDate = (value) => {
  if (!value) return '';
  try {
    const parsed = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10);
  } catch {
    return '';
  }
};

const normalizeActions = (actions = []) => {
  const list = Array.isArray(actions) ? actions : [];
  return list
    .map((action) => ({
      title: action.title || action.task || action.action || '',
      owner: action.owner || action.assignee || action.lead || '',
      deadline: normalizeDate(action.deadline || action.dueDate),
      status: action.status || 'open',
      notes: action.notes || action.summary || '',
    }))
    .filter((action) => action.title);
};

const normalizeAgenda = (agenda = []) => {
  const list = Array.isArray(agenda) ? agenda : [];
  return list
    .map((item) => ({
      title: item.title || item.agendaItem || '',
      notes: item.notes || item.minutes || item.summary || '',
      owner: item.owner || '',
    }))
    .filter((item) => item.title || item.notes);
};

const fallbackActions = (text = '') => {
  const lines = (text || '')
    .split('\n')
    .map((l) => l.replace(/^[\\-\\d.\\s]+/, '').trim())
    .filter(Boolean);
  return lines.slice(0, 5).map((line) => ({
    title: line.length > 140 ? `${line.slice(0, 137).trim()}…` : line,
    owner: '',
    deadline: '',
    status: 'open',
    notes: '',
  }));
};

const normaliseResult = (parsed, rawText) => {
  if (!parsed || typeof parsed !== 'object') return { ...emptyResult, actions: fallbackActions(rawText) };
  const meetingDate =
    normalizeDate(parsed.meetingDate || parsed.date) ||
    normalizeDate(parsed.meeting_day) ||
    '';
  const attendees = Array.from(
    new Set(
      (Array.isArray(parsed.attendees) ? parsed.attendees : [])
        .filter(Boolean)
        .map((a) => a.toString().trim())
    )
  );
  const agenda = normalizeAgenda(parsed.agenda || parsed.agendaItems);
  const actions = normalizeActions(parsed.actions || parsed.actionPoints || parsed.tasks);
  const minutesSummary =
    parsed.minutesSummary ||
    parsed.summary ||
    (rawText ? rawText.slice(0, 220).trim() : '');

  const safeActions = actions.length ? actions : fallbackActions(rawText);

  return {
    meetingDate,
    attendees,
    agenda,
    actions: safeActions,
    minutesSummary,
  };
};

export async function parseMeetingMinutes(text = '') {
  if (!text || !text.trim()) return { ...emptyResult };

  const prompt = `
${basePrompt}

Return STRICT JSON only in this shape:
{
  "meetingDate": "YYYY-MM-DD or blank",
  "attendees": ["Name", "..."],
  "agenda": [{"title": "Agenda item", "notes": "Key discussion or notes", "owner": "optional"}],
  "actions": [{"title": "Action point", "owner": "Owner name", "deadline": "YYYY-MM-DD or blank", "notes": "optional"}],
  "minutesSummary": "Short headline summary"
}

Input minutes:
"""${text}"""`;

  try {
    const data = await fetchJson(prompt);
    const candidate = extractTextCandidate(data);
    const jsonBlock = extractJsonBlock(candidate) || extractJsonBlock(candidate?.toString() || '');
    const parsed = jsonBlock ? JSON.parse(jsonBlock) : JSON.parse(candidate);
    return normaliseResult(parsed, text);
  } catch (error) {
    console.error('parseMeetingMinutes failed - using fallback', error);
    return { ...emptyResult, actions: fallbackActions(text), minutesSummary: text.slice(0, 220).trim() };
  }
}
