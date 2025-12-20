import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { GoogleGenerativeAI } from '@google/generative-ai';
import crypto from 'node:crypto';

initializeApp();

const db = getFirestore();

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

const DEFAULT_APP_ID = process.env.ARTIFACT_APP_ID || 'hod-production-v1';

function normalizeEmail(email) {
  return (email || '').toString().trim().toLowerCase();
}

async function getRoleForUid(uid) {
  if (!uid) return null;
  const snap = await db.collection('roles').doc(uid).get();
  if (!snap.exists) return null;
  const role = snap.data()?.role;
  return typeof role === 'string' ? role : null;
}

function isValidRole(role) {
  return role === 'user' || role === 'admin' || role === 'superadmin';
}

function hashUid(uid) {
  if (!uid) return '';
  return crypto.createHash('sha256').update(String(uid)).digest('hex').slice(0, 12);
}

function safeInt(value, fallback) {
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : fallback;
}

async function assertAuthorized(auth) {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Sign-in required.');
  }

  const uid = auth.uid;
  const role = await getRoleForUid(uid);
  if (!role || !isValidRole(role)) {
    throw new HttpsError('permission-denied', 'User role not provisioned.');
  }

  return { uid, role };
}

export const ensureUserRole = onCall(
  {
    cors: true,
    invoker: 'public',
    region: process.env.FUNCTION_REGION || 'europe-west2',
    timeoutSeconds: 30,
    memory: '128MiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign-in required.');
    }

    const uid = request.auth.uid;
    const uidHash = hashUid(uid);
    const requestId = crypto.randomUUID();
    const email = normalizeEmail(request.auth.token?.email);
    if (!email) {
      throw new HttpsError('permission-denied', 'Email not available on auth token.');
    }

    // Super Admin Bypass: owner email is auto-provisioned without whitelist dependency.
    const superAdminEmail = normalizeEmail(process.env.SUPER_ADMIN_EMAIL);
    if (superAdminEmail && email === superAdminEmail) {
      await db.collection('roles').doc(uid).set(
        {
          role: 'superadmin',
          upgradedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      console.log(
        JSON.stringify({
          severity: 'INFO',
          event: 'ROLE_BOOTSTRAP_SUPERADMIN',
          requestId,
          uidHash,
        })
      );

      return { role: 'superadmin' };
    }

    const existingRole = await getRoleForUid(uid);
    if (existingRole && isValidRole(existingRole)) {
      console.log(
        JSON.stringify({
          severity: 'INFO',
          event: 'ROLE_EXISTS',
          requestId,
          uidHash,
          role: existingRole,
        })
      );
      return { role: existingRole };
    }

    // Bootstrap path: allow users who are on the legacy whitelist to be upgraded to a role.
    const whitelistedSnap = await db.collection('whitelistedUsers').doc(email).get();
    if (!whitelistedSnap.exists) {
      console.log(
        JSON.stringify({
          severity: 'WARN',
          event: 'ROLE_BOOTSTRAP_DENIED',
          requestId,
          uidHash,
        })
      );
      throw new HttpsError('permission-denied', 'User is not authorized.');
    }

    const whitelistData = whitelistedSnap.data() || {};
    const roleToGrant = isValidRole(whitelistData.role) ? whitelistData.role : 'user';

    await db.collection('roles').doc(uid).set(
      {
        role: roleToGrant,
        upgradedAt: new Date().toISOString(),
        whitelistedAt: whitelistData.invitedAt || new Date().toISOString(),
        whitelistedBy: whitelistData.invitedBy || null,
      },
      { merge: true }
    );

    console.log(
      JSON.stringify({
        severity: 'INFO',
        event: 'ROLE_BOOTSTRAP_USER',
        requestId,
        uidHash,
        role: roleToGrant,
      })
    );

    return { role: roleToGrant };
  }
);

const DEFAULT_MODEL_NAME = 'gemini-2.5-flash-preview-09-2025';

const DEFAULT_ALLOWED_MODELS = [DEFAULT_MODEL_NAME];
const DEFAULT_MAX_PROMPT_CHARS = 60_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 4096;

function getAllowedModels() {
  const raw = (process.env.AI_ALLOWED_MODELS || '').trim();
  if (!raw) return DEFAULT_ALLOWED_MODELS;
  const list = raw
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  return list.length ? list : DEFAULT_ALLOWED_MODELS;
}

function getGeminiApiKey() {
  const fromSecret = GEMINI_API_KEY.value();
  return fromSecret || process.env.GEMINI_API_KEY || '';
}

function mapGeminiError(err) {
  const message = err?.message || String(err);
  const status = err?.status || err?.code;

  if (status === 429 || /rate limit/i.test(message) || /RESOURCE_EXHAUSTED/i.test(message)) {
    return new HttpsError('resource-exhausted', 'RATE_LIMIT');
  }

  if (status === 400) {
    return new HttpsError('invalid-argument', message);
  }

  return new HttpsError('internal', message);
}

function normalizeCallablePayload(data) {
  const { promptText, generationConfig, responseMimeType, model } = data || {};
  if (!promptText || typeof promptText !== 'string') {
    throw new HttpsError('invalid-argument', 'promptText must be a non-empty string.');
  }

  const trimmedPrompt = promptText.trim();
  if (!trimmedPrompt) {
    throw new HttpsError('invalid-argument', 'promptText must not be blank.');
  }

  const maxPromptChars = safeInt(process.env.AI_MAX_PROMPT_CHARS, DEFAULT_MAX_PROMPT_CHARS);
  if (trimmedPrompt.length > maxPromptChars) {
    throw new HttpsError('invalid-argument', `promptText exceeds ${maxPromptChars} characters.`);
  }

  const mergedGenerationConfig = {
    ...(generationConfig && typeof generationConfig === 'object' ? generationConfig : {}),
  };

  if (responseMimeType && typeof responseMimeType === 'string') {
    mergedGenerationConfig.responseMimeType = responseMimeType;
  }

  const requestedModel = typeof model === 'string' && model.trim() ? model.trim() : DEFAULT_MODEL_NAME;
  const allowedModels = getAllowedModels();
  if (!allowedModels.includes(requestedModel)) {
    throw new HttpsError('invalid-argument', 'Requested model is not allowed.');
  }

  // Clamp generation config to safe limits.
  const maxOutputTokens = safeInt(process.env.AI_MAX_OUTPUT_TOKENS, DEFAULT_MAX_OUTPUT_TOKENS);
  if (mergedGenerationConfig.maxOutputTokens != null) {
    const requested = Number(mergedGenerationConfig.maxOutputTokens);
    if (!Number.isFinite(requested) || requested <= 0) {
      throw new HttpsError('invalid-argument', 'generationConfig.maxOutputTokens must be a positive number.');
    }
    mergedGenerationConfig.maxOutputTokens = Math.min(requested, maxOutputTokens);
  }

  if (mergedGenerationConfig.temperature != null) {
    const requested = Number(mergedGenerationConfig.temperature);
    if (!Number.isFinite(requested) || requested < 0 || requested > 2) {
      throw new HttpsError('invalid-argument', 'generationConfig.temperature must be between 0 and 2.');
    }
    mergedGenerationConfig.temperature = requested;
  }

  const mimeType = mergedGenerationConfig.responseMimeType;
  if (mimeType != null) {
    const allowedMimeTypes = ['application/json', 'text/plain'];
    if (typeof mimeType !== 'string' || !allowedMimeTypes.includes(mimeType)) {
      throw new HttpsError('invalid-argument', 'generationConfig.responseMimeType must be application/json or text/plain.');
    }
  }

  return {
    promptText: trimmedPrompt,
    model: requestedModel,
    generationConfig: mergedGenerationConfig,
  };
}

function getQuotaLimitsForRole(role) {
  const perDayDefault = role === 'user' ? 60 : role === 'admin' ? 200 : 500;
  const perMinuteDefault = role === 'user' ? 6 : role === 'admin' ? 20 : 60;

  return {
    perDay: safeInt(process.env.AI_QUOTA_PER_DAY, perDayDefault),
    perMinute: safeInt(process.env.AI_QUOTA_PER_MINUTE, perMinuteDefault),
  };
}

function getUtcDayKey(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function getUtcMinuteKey(date = new Date()) {
  const ymd = getUtcDayKey(date);
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${ymd}${hh}${mm}`;
}

async function enforceAndRecordAiQuota({ uid, role, appId }) {
  const now = new Date();
  const dayKey = getUtcDayKey(now);
  const minuteKey = getUtcMinuteKey(now);
  const { perDay, perMinute } = getQuotaLimitsForRole(role);

  const baseRef = db.collection('artifacts').doc(appId).collection('aiQuota').doc(uid);
  const dayRef = baseRef.collection('days').doc(dayKey);
  const minuteRef = baseRef.collection('minutes').doc(minuteKey);

  const result = await db.runTransaction(async (tx) => {
    const [daySnap, minuteSnap] = await Promise.all([tx.get(dayRef), tx.get(minuteRef)]);

    const dayUsed = (daySnap.exists ? daySnap.data()?.count : 0) || 0;
    const minuteUsed = (minuteSnap.exists ? minuteSnap.data()?.count : 0) || 0;

    const nextDayUsed = dayUsed + 1;
    const nextMinuteUsed = minuteUsed + 1;

    if (nextDayUsed > perDay) {
      throw new HttpsError('resource-exhausted', 'QUOTA_EXCEEDED', {
        window: 'day',
        limit: perDay,
        used: dayUsed,
        dayKey,
      });
    }

    if (nextMinuteUsed > perMinute) {
      throw new HttpsError('resource-exhausted', 'RATE_LIMIT', {
        window: 'minute',
        limit: perMinute,
        used: minuteUsed,
        minuteKey,
      });
    }

    tx.set(
      dayRef,
      {
        uid,
        dayKey,
        count: nextDayUsed,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: daySnap.exists ? daySnap.data()?.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    tx.set(
      minuteRef,
      {
        uid,
        minuteKey,
        count: nextMinuteUsed,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: minuteSnap.exists ? minuteSnap.data()?.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return {
      dayKey,
      minuteKey,
      usedDay: nextDayUsed,
      limitDay: perDay,
      remainingDay: Math.max(0, perDay - nextDayUsed),
      usedMinute: nextMinuteUsed,
      limitMinute: perMinute,
      remainingMinute: Math.max(0, perMinute - nextMinuteUsed),
    };
  });

  return result;
}

async function handleGenerateAIResponse(request) {
  const requestId = crypto.randomUUID();
  const { uid, role } = await assertAuthorized(request.auth);
  const uidHash = hashUid(uid);

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new HttpsError(
      'failed-precondition',
      'Missing GEMINI_API_KEY on server. Set via `firebase functions:secrets:set GEMINI_API_KEY`.'
    );
  }

  const { promptText, model, generationConfig } = normalizeCallablePayload(request.data);
  const clientSessionId =
    typeof request.data?.clientSessionId === 'string' && request.data.clientSessionId.trim()
      ? request.data.clientSessionId.trim()
      : null;

  const appId = typeof request.data?.appId === 'string' && request.data.appId.trim()
    ? request.data.appId.trim()
    : DEFAULT_APP_ID;

  const quota = await enforceAndRecordAiQuota({ uid, role, appId });

  console.log(
    JSON.stringify({
      severity: 'INFO',
      event: 'AI_CALL_START',
      requestId,
      uidHash,
      role,
      model,
      appId,
      clientSessionId,
      quota,
    })
  );

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const generativeModel = genAI.getGenerativeModel({ model });

    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      ...(generationConfig && Object.keys(generationConfig).length
        ? { generationConfig }
        : {}),
    });

    const rawResponse = result?.response;
    const serializable = rawResponse && typeof rawResponse?.toJSON === 'function' ? rawResponse.toJSON() : rawResponse;
    const safeData = serializable && typeof serializable === 'object' ? serializable : {};

    console.log(
      JSON.stringify({
        severity: 'INFO',
        event: 'AI_CALL_SUCCESS',
        requestId,
        uidHash,
        role,
        model,
        appId,
        clientSessionId,
        quota,
      })
    );

    // Keep frontend compatibility (candidates/usageMetadata) and attach quota summary.
    return { ...safeData, quota };
  } catch (err) {
    console.error(
      JSON.stringify({
        severity: 'ERROR',
        event: 'AI_CALL_FAILURE',
        requestId,
        uidHash,
        role,
        model,
        appId,
        clientSessionId,
        error: err?.message || String(err),
      })
    );
    throw mapGeminiError(err);
  }
}

export const generateAIResponse = onCall(
  {
    cors: true,
    invoker: 'public',
    region: process.env.FUNCTION_REGION || 'europe-west2',
    timeoutSeconds: 60,
    memory: '256MiB',
    secrets: [GEMINI_API_KEY],
  },
  handleGenerateAIResponse
);

export const geminiGenerateContent = onCall(
  {
    cors: true,
    invoker: 'public',
    region: process.env.FUNCTION_REGION || 'europe-west2',
    timeoutSeconds: 60,
    memory: '256MiB',
    secrets: [GEMINI_API_KEY],
  },
  handleGenerateAIResponse
);
