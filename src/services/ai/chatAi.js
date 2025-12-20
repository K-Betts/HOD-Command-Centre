import { httpsCallable } from 'firebase/functions';

import { functions } from '../firebase';
import { appId } from '../../config/appConfig';
import { getClientSessionId } from '../../utils/session';

const geminiGenerateContent = httpsCallable(functions, 'geminiGenerateContent');

function extractTextCandidate(data) {
  const part =
    data?.candidates?.[0]?.content?.parts?.find?.((p) => typeof p?.text === 'string') ||
    (Array.isArray(data?.candidates?.[0]?.content?.parts)
      ? data.candidates[0].content.parts[0]
      : null);
  return typeof part?.text === 'string' ? part.text : '';
}

function extractJsonBlock(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const inner = fenced ? fenced[1].trim() : raw;
  const startArray = inner.indexOf('[');
  const startObj = inner.indexOf('{');
  const start = startArray === -1 ? startObj : startArray === -1 ? startObj : Math.min(startArray === -1 ? Infinity : startArray, startObj === -1 ? Infinity : startObj);
  if (start === -1) return '';
  const openChar = inner[start];
  const closeChar = openChar === '{' ? '}' : ']';
  let depth = 0;
  for (let i = start; i < inner.length; i += 1) {
    const ch = inner[i];
    if (ch === openChar) depth += 1;
    else if (ch === closeChar) depth -= 1;
    if (depth === 0) return inner.slice(start, i + 1).trim();
  }
  return '';
}

async function fetchJson(body, config = {}) {
  try {
    const generationConfig = config?.generationConfig;
    const responseMimeType = config?.responseMimeType;

    const result = await geminiGenerateContent({
      appId,
      clientSessionId: getClientSessionId() || null,
      promptText: body,
      generationConfig,
      responseMimeType,
    });

    return result?.data || {};
  } catch (err) {
    console.error('AI request failed', err);
    throw err;
  }
}

export async function askOmniBot(userQuery = '', contextJson = '{}') {
  const systemPrompt = `You are the Chief of Staff for a School Department.
You have access to the following live data:

TASKS: ${contextJson && typeof contextJson === 'string' ? contextJson : JSON.stringify(contextJson)}

STAFF: [See STAFF key in the provided JSON]

CALENDAR: [See CALENDAR key in the provided JSON]

MEETINGS: [See MEETINGS key in the provided JSON]

User Query: ${userQuery}

Rules:
- Answer based ONLY on the provided data.
- Be concise and actionable.
- If asked 'When is X free?', check the Calendar and their Staff Timetable.
- If asked 'What is X doing?', check Tasks assigned to X.

Return a short, plain-text answer (a few sentences). If you cannot answer from the data, say "I don't have enough information in the provided data to answer that."`;

  // Additional instruction: if proposing actions that change app state, include a JSON array of commands
  // in a fenced ```json block. Example:
  // ```json
  // [ { "action": "reassignTask", "taskId": "abc123", "to": "Colm" } ]
  // ```

  try {
    const fullPrompt =
      systemPrompt +
      "\n\nIf you are proposing any actions that change application state (eg. reassigning a task, creating a task, updating a meeting), include a JSON array called \"commands\" in a fenced code block using triple backticks and the word json. Example:\n```json\n[ { \"action\": \"reassignTask\", \"taskId\": \"abc123\", \"to\": \"Colm\" } ]\n```\nOnly include this JSON if you are proposing actions; otherwise return only plain text. ALWAYS also include one or two short plain-language sentences that explain the outcome or next steps.";

    const data = await fetchJson(`${fullPrompt}`, {
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
    });
    const raw = extractTextCandidate(data) || '';
    const jsonBlock = extractJsonBlock(raw);
    let commands = [];
    if (jsonBlock) {
      try {
        const parsed = JSON.parse(jsonBlock);
        if (Array.isArray(parsed)) commands = parsed;
        else if (parsed && parsed.commands) commands = Array.isArray(parsed.commands) ? parsed.commands : [];
      } catch (e) {
        console.warn('Failed to parse JSON block from AI:', e);
      }
    }
    const cleanedText = raw.replace(/```(?:json)?[\s\S]*?```/i, '').trim();
    return { text: cleanedText, commands };
  } catch (err) {
    console.error('askOmniBot error', err);
    throw err;
  }
}
