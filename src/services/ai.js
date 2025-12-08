import { applyContextTags } from '../utils/taskContext';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const modelPath =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent';

let aiErrorNotifier = null;

export function setAiErrorNotifier(fn) {
  aiErrorNotifier = fn;
}

function notifyAiError(message) {
  console.error(message);
  if (typeof aiErrorNotifier === 'function') {
    aiErrorNotifier(message);
  } else if (typeof alert === 'function') {
    alert(message);
  }
}

const fetchWithRetry = async (url, options, retries = 3, backoff = 1000) => {
  try {
    const res = await fetch(url, options);
    if (res.status === 429) throw new Error('RATE_LIMIT');
    if (!res.ok) throw new Error('API_ERROR');
    return res.json();
  } catch (err) {
    if (retries > 0 && err.message === 'RATE_LIMIT') {
      await new Promise(r => setTimeout(r, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw err;
  }
};

async function fetchJson(body, config) {
  const url = `${modelPath}?key=${apiKey}`;
  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: body }] }], ...config }),
  };

  try {
    const data = await fetchWithRetry(url, options);
    return data;
  } catch (err) {
    console.error('AI request failed', err);
    let message = 'AI Service Unavailable - check connection.';
    if (err.message === 'RATE_LIMIT') {
      message = 'AI service is busy, please try again in a moment.';
    }
    notifyAiError(message);
    return {};
  }
}

function extractTextCandidate(data) {
  const part =
    data?.candidates?.[0]?.content?.parts?.find?.((p) => typeof p?.text === 'string') ||
    (Array.isArray(data?.candidates?.[0]?.content?.parts)
      ? data.candidates[0].content.parts[0]
      : null);
  return typeof part?.text === 'string' ? part.text : '';
}

export async function analyzeContext(text, type) {
  const prompt =
    type === 'calendar'
      ? `Extract key school dates from this text. Return JSON: { "events": [{ "date": "YYYY-MM-DD", "event": "Event Name", "type": "Term/Exam/Report" }] }. Text: "${text}"`
      : `Extract strategic goals from this text. Return JSON: { "goals": [{ "title": "Goal Title", "focus": "Brief description" }] }. Text: "${text}"`;

  try {
    const data = await fetchJson(prompt, {
      generationConfig: { responseMimeType: 'application/json' },
    });
    const text = extractTextCandidate(data);
    if (!text) throw new Error('Empty AI response');
    return JSON.parse(text);
  } catch (error) {
    console.error('analyzeContext failed', error);
    notifyAiError('AI Service Unavailable - check connection.');
    return null;
  }
}

export async function analyzeBrainDump(text, staffList = [], context = {}) {
  const staffContext = context.staffDirectory
    ? `Staff Directory (for assignment): ${JSON.stringify(context.staffDirectory)}`
    : `Staff available: ${staffList
        .map((s) => `${s.name} (Teaches: ${s.yearGroups?.join(', ') || 'None'})`)
        .join('; ')}`;

  const currentDateIso = new Date().toISOString();

  const calendarContext = context.todayEvents
    ? `Today's/Tomorrow's Events: ${context.todayEvents.join('; ')}`
    : context.events
    ? `Calendar: ${context.events.map((e) => `${e.date || e.startDateTime}: ${e.event || e.title}`).join('; ')}`
    : 'No calendar data.';

  const goalContext = context.goals
    ? context.goals.map((g) => `${g.title}`).join('; ')
    : 'No specific goals.';
    
  const existingTasksContext = context.existingTaskTitles
    ? `Existing task titles (for de-duplication): ${context.existingTaskTitles.join('; ')}`
    : 'No existing tasks provided.';


  const prompt = `
You are an executive assistant for a British School Head of Department.

TASK: Parse the input into MULTIPLE distinct items and return STRICT JSON. NEVER merge multiple actions into one task. Do not omit items. Infer missing details yourself; do not ask follow-up questions.

CONTEXT:
- Current date: ${currentDateIso}
- ${calendarContext}
- Goals: ${goalContext}
- ${staffContext}
- ${existingTasksContext}

INPUT (messy, multiline):
"""
${text}
"""

OUTPUT JSON SHAPE:
{
  "tasks": [
    {
      "title": "Short actionable title",
      "priority": "High" | "Medium" | "Low",
      "category": "Admin" | "Pastoral" | "Strategic" | "Teaching" | "General",
      "estimatedMinutes": 0,
      "estimatedTime": "5 min" | "15 min" | "30 min" | "1 hr+",
      "energyLevel": "High Focus" | "Low Energy/Admin",
      "isWeeklyWin": true | false,
      "dueDate": "YYYY-MM-DD" | null,
      "assignee": "Name or empty string",
      "summary": "One or two sentences",
      "themeTag": "optional strategy tag if applicable"
    }
  ],
  "wellbeing": {
    "mood": "Tough" | "Okay" | "Great",
    "energy": "Low" | "Medium" | "High",
    "summary": "Short wellbeing snapshot"
  } | null,
  "staffInsights": [
    {
      "staffName": "Name or empty",
      "date": "YYYY-MM-DD" | null,
      "type": "Challenge" | "Support" | "praise" | "concern" | "neutral",
      "interactionType": "Challenge" | "Support",
      "summary": "Single-sentence note",
      "source": "BrainDump"
    }
  ],
  "calendarEvents": [
    {
      "title": "Event title",
      "startDateTime": "YYYY-MM-DDTHH:MM" | "YYYY-MM-DD",
      "endDateTime": "YYYY-MM-DDTHH:MM" | null,
      "description": "Optional description",
      "type": "Parents Evening" | "Exam" | "Meeting" | "CPD" | "Trip" | "Other"
    }
  ],
  "strategyNotes": [
    {
      "theme": "KS3 Mastery / Exam Outcomes / CPD / Reports / Curriculum / Other",
      "note": "Short description",
      "linkedTo": "optional DIP/SDP reference"
    }
  ]
}

RULES:
- Interaction classification (STRICT):
  * CHALLENGE (Red): Deadlines, timescales, standards, corrections/errors, intense meetings, holding to account, performance reviews, observations, asking for change/output/improvement. Ambiguity defaults to CHALLENGE.
  * SUPPORT (Green): Praise, wellbeing checks, listening, empathy, coffee chats, gratitude, pure care with no output requested.
  * ADMIN (Gray): Scheduling, logistics, room bookings, neutral updates.
  Few-shot examples:
    - "Told Sarah she missed the deadline." -> CHALLENGE
    - "Set a deadline for the report." -> CHALLENGE
    - "Meeting was intense." -> CHALLENGE
    - "Asked Bob to redo the marking." -> CHALLENGE
    - "Had a coffee with Jane to check on her mood." -> SUPPORT
    - "Sent the weekly timetable." -> ADMIN
- Split EVERY distinct action into its own task.
- Always return estimatedTime using only the allowed options and set energyLevel to "High Focus" or "Low Energy/Admin" (admin/email = Low, deep work/analysis/strategy = High Focus). Set isWeeklyWin = true only for strategic/high-impact work.
- Smart due date rules (use current date as reference):
  A) If the task involves a request from a Stakeholder or VIP -> dueDate today or tomorrow.
  B) If estimatedTime is under 30 mins -> dueDate today or within the next 2 days.
  C) Otherwise default to 7 days from today.
- Extract date/time lines into calendarEvents.
- Make a best inference for dueDate/assignee/staff.
- Use British English. Keep JSON valid.`;

  try {
    const data = await fetchJson(prompt, {
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        maxOutputTokens: 6144,
      },
    });

    const parsed = safeParseCandidate(data);
    let safe = normalizeBrainDumpOutput(parsed, text);
    safe.rawText = parsed.__rawText || text;

    const needsFallback =
      (safe.tasks?.length || 0) <= 1 && (text.split('\n').length >= 8 || text.length > 400);

    if (needsFallback) {
      const fallbackPrompt = `
You must output STRICT JSON only. Do not include prose.
Extract EVERY dated line as a calendarEvents item and EVERY instruction sentence as a separate task.
Do NOT merge multiple actions into one task. Make a best-effort guess instead of asking clarifying questions.
Current date: ${currentDateIso}. Apply the same smart due date rules (Stakeholder/VIP = today/tomorrow, quick admin under 30 mins = today or within 2 days, everything else = 7 days out).

INPUT:
"""
${text}
"""

OUTPUT JSON SHAPE (same as primary): see earlier schema.`;

      const fallbackData = await fetchJson(fallbackPrompt, {
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.05,
          maxOutputTokens: 6144,
        },
      });

      const fallbackParsed = safeParseCandidate(fallbackData);
      const fallbackSafe = normalizeBrainDumpOutput(fallbackParsed, text);
      fallbackSafe.rawText = fallbackParsed.__rawText || safe.rawText || text;

      safe = mergeBetterPayloads(safe, fallbackSafe);
    }

    return safe;
  } catch (error) {
    console.error('AI Analysis Failed:', error);
    const fallback = normalizeBrainDumpOutput({}, text);
    return { ...fallback, rawText: text };
  }
}

function safeParseCandidate(data) {
  const rawParts = Array.isArray(data?.candidates?.[0]?.content?.parts)
    ? data.candidates[0].content.parts.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('\n')
    : data?.candidates?.[0]?.content?.parts?.[0]?.text;
  const trimmedRaw = typeof rawParts === 'string' ? rawParts.trim() : '';
  if (!trimmedRaw) return { __rawText: '' };

  const jsonSnippet = extractJsonBlock(trimmedRaw);
  if (!jsonSnippet) return { __rawText: trimmedRaw };

  // Try the snippet as-is, then a trimmed/balanced version.
  const attempts = [jsonSnippet, trimToBalancedBraces(jsonSnippet)];
  for (const attempt of attempts) {
    try {
      const parsed = JSON.parse(attempt);
      return { ...parsed, __rawText: trimmedRaw };
    } catch {
      // continue to next attempt
    }
  }

  return { __rawText: trimmedRaw };
}

function extractJsonBlock(raw) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const inner = fenced ? fenced[1].trim() : trimmed;
  const start = inner.indexOf('{');
  const end = inner.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return '';
  return inner.slice(start, end + 1);
}

function trimToBalancedBraces(str) {
  // Walk through the string to find the longest balanced prefix.
  let depth = 0;
  let lastBalanced = -1;
  for (let i = 0; i < str.length; i += 1) {
    const ch = str[i];
    if (ch === '{' || ch === '[') depth += 1;
    else if (ch === '}' || ch === ']') depth -= 1;
    if (depth === 0) lastBalanced = i;
  }
  return lastBalanced !== -1 ? str.slice(0, lastBalanced + 1) : str;
}

function mergeBetterPayloads(primary, fallback) {
  const merged = { ...primary };

  if ((fallback.tasks?.length || 0) > (primary.tasks?.length || 0)) {
    merged.tasks = fallback.tasks;
  }
  if ((fallback.calendarEvents?.length || 0) > (primary.calendarEvents?.length || 0)) {
    merged.calendarEvents = fallback.calendarEvents;
  }
  if ((fallback.staffInsights?.length || 0) > (primary.staffInsights?.length || 0)) {
    merged.staffInsights = fallback.staffInsights;
  }
  if ((fallback.strategyNotes?.length || 0) > (primary.strategyNotes?.length || 0)) {
    merged.strategyNotes = fallback.strategyNotes;
  }
  if (!merged.rawText && fallback.rawText) merged.rawText = fallback.rawText;

  if (!primary.wellbeing && fallback.wellbeing) merged.wellbeing = fallback.wellbeing;

  return merged;
}

function normalizeBrainDumpOutput(parsed, rawText) {
  const today = new Date();
  const fallbackDue =
    rawText?.toLowerCase().includes('tomorrow')
      ? isoDayOffset(today, 1)
      : rawText?.toLowerCase().includes('today') || rawText?.toLowerCase().includes('end of day')
      ? isoDayOffset(today, 0)
      : null;

  let tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
  if (!tasks.length && rawText?.trim()) {
    const trimmedTitle =
      rawText.length > 80 ? rawText.slice(0, 77).trimEnd() + '…' : rawText.trim();
    tasks = [
      {
        title: trimmedTitle || 'Captured note',
        priority: 'Medium',
        category: 'General',
        estimatedMinutes: 0,
        dueDate: fallbackDue,
        assignee: '',
        summary: rawText.trim(),
      },
    ];
  }

  const calendarEvents = Array.isArray(parsed.calendarEvents) ? parsed.calendarEvents : [];
  const staffInsights = Array.isArray(parsed.staffInsights) ? parsed.staffInsights : [];
  const strategyNotes = Array.isArray(parsed.strategyNotes) ? parsed.strategyNotes : [];

  const wellbeing =
    parsed.wellbeing ||
    (parsed.wellbeing === null
      ? null
      : {
          mood: 'Okay',
          energy: 'Medium',
          summary: 'Default wellbeing entry (model did not return one).',
        });

  const normalizedTasks = tasks.map((task) => {
    const withContext = applyContextTags(task);
    const dueDate = deriveSmartDueDate(withContext, today, fallbackDue);
    return { ...withContext, dueDate };
  });

  // Basic dedupe within the returned payload using simple fingerprints
  const taskFp = new Set();
  const dedupedTasks = normalizedTasks.filter((t) => {
    const fp = `${(t.title || '').trim().toLowerCase()}|${(t.dueDate || '').toString().slice(0, 10)}`;
    if (!fp.trim()) return false;
    if (taskFp.has(fp)) return false;
    taskFp.add(fp);
    return true;
  });

  const eventFp = new Set();
  const dedupedEvents = calendarEvents.filter((e) => {
    const fp = `${(e.title || '').trim().toLowerCase()}|${(e.startDateTime || e.date || '')
      .toString()
      .slice(0, 10)}`;
    if (!fp.trim()) return false;
    if (eventFp.has(fp)) return false;
    eventFp.add(fp);
    return true;
  });

  const insightFp = new Set();
  const dedupedInsights = staffInsights.filter((s) => {
    const fp = `${(s.staffName || '').trim().toLowerCase()}|${(s.date || '')
      .toString()
      .slice(0, 10)}|${(s.summary || '').trim().toLowerCase()}`;
    if (!fp.trim()) return false;
    if (insightFp.has(fp)) return false;
    insightFp.add(fp);
    return true;
  });

  const strategyFp = new Set();
  const dedupedStrategy = strategyNotes.filter((s) => {
    const fp = `${(s.theme || '').trim().toLowerCase()}|${(s.note || '').trim().toLowerCase()}`;
    if (!fp.trim()) return false;
    if (strategyFp.has(fp)) return false;
    strategyFp.add(fp);
    return true;
  });

  return {
    tasks: dedupedTasks,
    wellbeing,
    staffInsights: dedupedInsights,
    calendarEvents: dedupedEvents,
    strategyNotes: dedupedStrategy,
  };
}

function isoDayOffset(baseDate, offset) {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function normalizeDateInput(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

function estimatedMinutesFromTask(task = {}) {
  if (typeof task.estimatedMinutes === 'number' && task.estimatedMinutes > 0) {
    return task.estimatedMinutes;
  }

  const timeMap = {
    '5 min': 5,
    '15 min': 15,
    '30 min': 30,
    '1 hr+': 60,
  };
  const key = (task.estimatedTime || '').trim().toLowerCase();
  return timeMap[key] || 0;
}

function isStakeholderTask(task = {}) {
  const text = `${task.title || ''} ${task.summary || ''} ${task.assignee || ''}`.toLowerCase();
  const keywords = [
    'stakeholder',
    'vip',
    'headteacher',
    'head teacher',
    'principal',
    'ceo',
    'governor',
    'trust lead',
    'executive',
    'senior leader',
    'slg',
    'parent',
    'ofsted',
    'inspector',
  ];
  return keywords.some((kw) => text.includes(kw));
}

function deriveSmartDueDate(task = {}, today = new Date(), fallbackDue) {
  const normalizedExisting = normalizeDateInput(task.dueDate);
  if (normalizedExisting) return normalizedExisting;
  if (fallbackDue) return fallbackDue;

  if (isStakeholderTask(task)) {
    return isoDayOffset(today, 0);
  }

  const estMinutes = estimatedMinutesFromTask(task);
  if (estMinutes > 0 && estMinutes < 30) {
    return estMinutes <= 15 ? isoDayOffset(today, 0) : isoDayOffset(today, 2);
  }

  return isoDayOffset(today, 7);
}

export async function analyzeStaffProfile(interactions) {
  try {
    const history =
      Array.isArray(interactions) && interactions.length
        ? interactions
            .map(
              (i) =>
                `Date: ${i.date || 'unknown'} | Type: ${i.type || 'Neutral'} | Interaction: ${i.interactionType || i.buckTag || 'Admin'} | Summary: ${i.summary || ''}`
            )
            .join('\n')
        : 'No interaction history provided.';

    const data = await fetchJson(
      `You are profiling a staff member using the "Surrounded by Idiots" (DISC) framework.

Interaction logs:
${history}

TASK: Derive a personalised profile that combines DISC colours with specific behaviours in the logs.
- Analyse the pattern of "Challenge" vs "Support" interactions and state if the mix is balanced.
- If the most recent interaction is older than 21 days, set relationshipRisk to "Relationship Drift".
- Provide one specific coachingTip on how to rebalance challenge vs support with this person.
RETURN STRICT JSON:
{
  "primaryColor": "Red|Yellow|Green|Blue",
  "secondaryColor": "Red|Yellow|Green|Blue" | "",
  "summary": "1-2 sentences on style and behaviours",
  "strengths": ["DISC strengths plus any explicit skills from the logs (e.g. Loves SQL)", "..."],
  "developmentAreas": ["DISC blind spots plus avoidances from logs (e.g. Avoids public speaking)", "..."],
  "communicationTips": ["Actionable tips for working with this person", "..."],
  "balanceAssessment": "Challenge-heavy|Support-heavy|Balanced|Unknown",
  "relationshipRisk": "Relationship Drift" | "",
  "coachingTip": "Concrete action to rebalance challenge vs support"
}

Rules:
- Use UK English.
- Only include a secondaryColor if clear from the logs; otherwise leave blank.
- Strengths and developmentAreas should blend DISC traits with any explicit skills/avoidances seen.`,
      { generationConfig: { responseMimeType: 'application/json' } }
    );
    const text = extractTextCandidate(data);
    if (!text) throw new Error('Empty AI response');
    const parsed = JSON.parse(text);

    // Map the AI payload to the shape expected by the UI
    const primaryColor = (parsed.primaryColor || parsed.colorType || '').trim();
    const secondaryColor = (parsed.secondaryColor || parsed.secondary || '').trim();

    const summary =
      typeof parsed.summary === 'string' && parsed.summary.trim()
        ? parsed.summary
        : parsed.delegationAdvice ||
          (Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 2).join('; ') : '') ||
          '';

    const strengths = Array.isArray(parsed.strengths) ? parsed.strengths : [];
    const developmentAreas = Array.isArray(parsed.developmentAreas)
      ? parsed.developmentAreas
      : Array.isArray(parsed.areasForDevelopment)
      ? parsed.areasForDevelopment
      : [];
    const communicationTips = Array.isArray(parsed.communicationTips)
      ? parsed.communicationTips
      : [];
    const balanceAssessment =
      typeof parsed.balanceAssessment === 'string' && parsed.balanceAssessment
        ? parsed.balanceAssessment
        : typeof parsed.challengeSupportBalance === 'string'
        ? parsed.challengeSupportBalance
        : '';
    const relationshipRisk =
      typeof parsed.relationshipRisk === 'string' && parsed.relationshipRisk
        ? parsed.relationshipRisk
        : parsed.riskFlag || '';
    const coachingTip =
      typeof parsed.coachingTip === 'string'
        ? parsed.coachingTip
        : parsed.rebalanceTip || '';

    return {
      ...parsed,
      primaryColor,
      secondaryColor,
      summary,
      communicationTips,
      strengths,
      developmentAreas,
      balanceAssessment,
      relationshipRisk,
      coachingTip,
    };
  } catch (e) {
    console.error('analyzeStaffProfile failed', e);
    notifyAiError('AI Service Unavailable - check connection.');
    return null;
  }
}

export async function validateStrategicWhy(title, whyText) {
  if (!whyText) return null;
  const prompt = `You are a critical leadership coach applying Simon Sinek's "Start With Why".

Project title: ${title || 'Untitled'}
Stated WHY: """${whyText}"""

TASK:
1) Decide if this WHY is purpose-led (beliefs/values/impact) or result-led (outputs/targets).
2) If it is weak/result-led, rewrite it to centre beliefs/values and the change it will create for people.
3) Keep the tone direct, challenging, and concise.

Return STRICT JSON ONLY with this shape:
{
  "verdict": "purpose-led" | "result-led",
  "score": 1-5,
  "reason": "Why you judged it this way in one punchy sentence",
  "rewrite": "Improved purpose-led WHY (even if original was good)",
  "headline": "A 6-10 word belief-led headline"
}`;

  try {
    const data = await fetchJson(prompt, {
      generationConfig: { responseMimeType: 'application/json', temperature: 0.25 },
    });
    const text = extractTextCandidate(data);
    if (!text) throw new Error('Empty AI response');
    const parsed = JSON.parse(text);
    return {
      verdict: parsed.verdict || parsed.type || 'result-led',
      score: Number(parsed.score) || 0,
      reason: parsed.reason || parsed.feedback || '',
      rewrite: parsed.rewrite || parsed.suggestion || whyText,
      headline: parsed.headline || parsed.summary || '',
    };
  } catch (e) {
    console.error('validateStrategicWhy failed', e);
    notifyAiError('AI Service Unavailable - check connection.');
    return {
      verdict: 'result-led',
      score: 0,
      reason: 'Unable to validate WHY statement right now.',
      rewrite: whyText,
      headline: '',
    };
  }
}

export async function analyzeProjectWhy(whyText, title = '') {
  if (!whyText) return null;
  const result = await validateStrategicWhy(title, whyText);
  const verdict = (result?.verdict || '').toLowerCase();
  const isStrong = verdict === 'purpose-led' || (result?.score || 0) >= 4;
  const weakMessage =
    'This sounds like a result, not a purpose. Try focusing on the belief behind it.';
  const strongMessage = "Great 'Why' statement!";

  return {
    ...result,
    strength: isStrong ? 'strong' : 'weak',
    message: result?.reason || (isStrong ? strongMessage : weakMessage),
  };
}

export async function generateAgenda(topic, staffContext) {
  try {
    const data = await fetchJson(
      `Generate 3-point agenda for HoD meeting. Topic: ${topic}. Context: ${JSON.stringify(
        staffContext
      )}.`
    );
    const text = extractTextCandidate(data);
    if (!text) throw new Error('Empty AI response');
    return text;
  } catch (e) {
    console.error('generateAgenda failed', e);
    notifyAiError('AI Service Unavailable - check connection.');
    return 'Error generating agenda.';
  }
}

export async function rewriteCommunication(text, tone, audienceContext) {
  try {
    const contextDetails = (() => {
      if (!audienceContext) return '';
      if (typeof audienceContext === 'string') return audienceContext;
      if (typeof audienceContext === 'object') {
        const {
          type,
          name,
          role,
          team,
          notes,
          aiProfile,
          expectations,
          tips,
        } = audienceContext;
        const lines = [];
        if (type) lines.push(`Audience type: ${type}`);
        if (name) lines.push(`Name: ${name}`);
        if (role) lines.push(`Role: ${role}`);
        if (team) lines.push(`Team: ${team}`);
        if (expectations) lines.push(`Expectations: ${expectations}`);
        if (notes) lines.push(`Notes: ${notes}`);
        if (tips?.length) lines.push(`Audience tips: ${tips.join('; ')}`);
        if (aiProfile?.primaryColor) {
          lines.push(
            `Personality profile: ${aiProfile.primaryColor}${
              aiProfile.secondaryColor ? `/${aiProfile.secondaryColor}` : ''
            }`
          );
        }
        if (aiProfile?.communicationTips?.length) {
          lines.push(
            `Suggested communication styles: ${aiProfile.communicationTips.join('; ')}`
          );
        }
        return lines.join('\n');
      }
      return String(audienceContext);
    })();

    const data = await fetchJson(
      `Rewrite this message for the specified audience.
Tone: ${tone || 'Professional'}.
Audience context:
${contextDetails || 'Not provided'}

Original draft:
"""${text}"""

Keep meaning intact, make it concise, respectful, and practical. Use UK English. Return only the rewritten message.`
    );
    const rewritten = extractTextCandidate(data);
    return rewritten || 'Error generating response.';
  } catch (e) {
    console.error('rewriteCommunication failed', e);
    notifyAiError('AI Service Unavailable - check connection.');
    return 'Error generating response.';
  }
}

export async function suggestSubtasks(task) {
  try {
    const data = await fetchJson(
      `Break down task "${task.title}" into 3-5 checklist items.`
    );
    const text = extractTextCandidate(data);
    if (!text) throw new Error('Empty AI response');
    return text;
  } catch (e) {
    console.error('suggestSubtasks failed', e);
    notifyAiError('AI Service Unavailable - check connection.');
    return 'Error generating steps.';
  }
}

export async function auditBudget(expenses, totalBudget, currency) {
  try {
    const baseCurrency = 'AED';

    const totalInAED = (expenses || []).reduce((sum, e) => {
      const value =
        typeof e.aedAmount === 'number'
          ? e.aedAmount
          : typeof e.amount === 'number'
          ? e.amount
          : 0;
      return sum + value;
    }, 0);

    const summary = (expenses || [])
      .slice(0, 30)
      .map((e) => {
        const hasOriginal =
          typeof e.originalAmount === 'number' && e.originalCurrency;
        if (hasOriginal && typeof e.aedAmount === 'number') {
          return `${e.item}: ${e.originalAmount} ${e.originalCurrency} (≈ ${e.aedAmount} ${baseCurrency})`;
        }
        if (typeof e.aedAmount === 'number') {
          return `${e.item}: ${e.aedAmount} ${baseCurrency}`;
        }
        return `${e.item}: ${e.amount} ${currency || baseCurrency}`;
      })
      .join(', ');

    const data = await fetchJson(
      `You are auditing a Head of Department's annual budget.
Base currency is ${baseCurrency}.
Total budget (in ${baseCurrency}): ${totalBudget}.
Current recorded spend (in ${baseCurrency}): ${totalInAED}.
Expenses sample: ${summary}.

Provide a short, practical summary in UK English: comment on pace of spend, categories that might be over- or under-used if visible, and one or two concrete suggestions for next steps.`
    );
    const text = extractTextCandidate(data);
    if (!text) throw new Error('Empty AI response');
    return text;
  } catch (e) {
    console.error('auditBudget AI summary failed', e);
    notifyAiError('AI Service Unavailable - check connection.');
    return 'Error auditing budget.';
  }
}

export async function analyzeStrategicPlan(planText) {
  try {
    const data = await fetchJson(
      `You are a strategic planner. Analyze DIP: "${planText}". Return JSON: { "milestones": [{ "week": 1, "action": "...", "owner": "..." }], "themes": [] }`,
      { generationConfig: { responseMimeType: 'application/json' } }
    );
    const text = extractTextCandidate(data);
    if (!text) throw new Error('No AI response');
    return JSON.parse(text);
  } catch (error) {
    console.error('analyzeStrategicPlan failed', error);
    return { milestones: [], themes: [] };
  }
}

export async function parseSchoolCalendar(rawText) {
  const prompt = `Extract events and strictly categorize them into:
- Academic Logistics (Exams, Reports, Deadlines)
- CPD & QA (Training, Observations, Reviews)
- Parents (Evenings, Coffee mornings)
- Enrichment/Trips (Sports, Visits, Events)

Input (messy text or pasted table):
${rawText}

Return ONLY valid JSON in this exact shape (no prose):
[{"date":"YYYY-MM-DD","title":"Event name","category":"One of the categories above"}]

Rules:
- Force dates into ISO (YYYY-MM-DD). If month/day missing, infer nearest sensible date this academic year.
- Map every row/line you can; do not drop events.
- Category must exactly match one of the four labels above.`;

  try {
    const data = await fetchJson(prompt, {
      generationConfig: { responseMimeType: 'application/json' },
    });
    const text = extractTextCandidate(data);
    if (!text) throw new Error('No AI response');
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.events)) return parsed.events;
    return [];
  } catch (error) {
    console.error('parseSchoolCalendar failed', error);
    notifyAiError('AI Service Unavailable - check connection.');
    return [];
  }
}

export async function parsePriorityImport(rawText) {
  const schemaHint = `Return JSON with this shape:
{
  "priorities": [
    {
      "vision": "String | optional",
      "objective": "String",
      "action": "String",
      "lead": "Initials or name",
      "reviewDate": "Date string if present",
      "reviewFrequency": "Weekly/Monthly/etc if present",
      "evidence": "How success will be evidenced",
      "rag": "Green/Amber/Red"
    }
  ]
}`;

  try {
    const data = await fetchJson(
      `You are parsing a School Improvement Plan pasted as messy text or tables. Extract the hierarchy (Vision -> Objectives -> Actions) and return a flat list of actions that can be tracked.

Input:
${rawText}

Rules:
- Keep objective text on each action under "objective".
- Keep the main vision statement if visible on each action under "vision".
- Lead should be initials or short name from any "Lead" column.
- reviewDate can be any date-like string (eg "Dec-25", "15 Jan", "w/b 2 Sep").
- If cadence is provided (eg "Weekly", "Half termly"), return it under reviewFrequency.
- Evidence/success measures go under "evidence".
- Add rag if you see R/A/G or colour labels; otherwise leave empty.
- ${schemaHint}`,
      { generationConfig: { responseMimeType: 'application/json' } }
    );
    const text = extractTextCandidate(data);
    if (!text) throw new Error('No AI response');
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed.priorities)) return parsed;
    return { priorities: [] };
  } catch (error) {
    console.error('parsePriorityImport failed', error);
    notifyAiError('AI Service Unavailable - check connection.');
    return { priorities: [] };
  }
}

export async function devilAdvocateCritique(idea, context = {}) {
  try {
    const data = await fetchJson(
      `You are a supportive but challenging SLT partner (Deputy Head). Your job is to help refine the idea by probing WHY, staff wellbeing impact, and alignment to school and department priorities. Keep the tone collaborative but forthright.
Idea: "${idea}"

Context:
- Strategy priorities: ${JSON.stringify(context.priorities || [])}
- Strategy themes: ${JSON.stringify(context.themes || [])}
- Goals / department priorities: ${JSON.stringify(context.goals || [])}
- School WHY statement: ${context.whyStatement || 'Not set'}
- Overloaded staff (risk if more work added): ${JSON.stringify(context.overloadedStaff || [])}
- Upcoming events (risk of clash): ${JSON.stringify(context.upcomingEvents || [])}
- Recent wellbeing signal (0-10, lower = fatigue): ${context.wellbeingScore ?? 'Unknown'}

Return concise bullet points under these headings:
- Why & Intent: challenge the purpose and success measure.
- Staff Wellbeing: flag load/energy risks and propose mitigations.
- Alignment: check fit with school/department priorities and timing vs events.
- Risks & Unknowns: identify blockers, data needed, or stakeholders.
- Supportive Next Step: one action to de-risk or validate quickly.`
    );
    const text = extractTextCandidate(data);
    if (!text) throw new Error('Empty AI response');
    return text;
  } catch (error) {
    console.error('devilAdvocateCritique failed', error);
    notifyAiError('AI Service Unavailable - check connection.');
    return 'I cannot critique this right now.';
  }
}

export async function generateWeeklyEmail(existingContextData = {}, userInputs = {}) {
  try {
    const deadlines = Array.isArray(existingContextData.deadlines)
      ? existingContextData.deadlines
      : [];
    const events = Array.isArray(existingContextData.events)
      ? existingContextData.events
      : [];

    const prompt = `You are drafting a weekly department email using this template:
1) Welcome Message
2) Upcoming Deadlines (bullet list)
3) CPD Session Agenda (bullets)
4) Department Meeting Agenda (bullets)

Known context (deadlines/events):
${deadlines
  .map((d) => `- ${d.title || d.name || 'Deadline'} | ${d.date || ''} | ${d.owner || ''}`)
  .join('\n') || '- none'}
${events
  .map((e) => `- ${e.title || e.event || 'Event'} | ${e.date || e.startDateTime || ''}`)
  .join('\n') || ''}

User inputs (may be rough):
- Welcome: ${userInputs.welcomeMessage || ''}
- CPD agenda (raw): ${userInputs.cpdAgendaRaw || ''}
- Dept agenda (raw): ${userInputs.deptAgendaRaw || ''}

Rules:
- Refine raw user text into concise, professional UK English bullets.
- Keep deadlines only in the deadlines section; do not duplicate elsewhere.
- If a section is empty, leave a clear "[Pending]" marker.
- Return a single plain-text email with four sections titled as per the template.`;

    const data = await fetchJson(prompt);
    const text = extractTextCandidate(data);
    return text || 'Unable to draft the email right now.';
  } catch (error) {
    console.error('generateWeeklyEmail failed', error);
    notifyAiError('AI Service Unavailable - check connection.');
    return 'Unable to draft the email right now.';
  }
}
