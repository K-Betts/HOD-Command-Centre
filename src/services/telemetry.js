import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';
import { appId } from '../config/appConfig';
import { getClientSessionId } from '../utils/session';

const TELEMETRY_RETENTION_DAYS = 30;

/**
 * Unified telemetry writer (admin-only readable, client-writable).
 * Stored in: artifacts/{appId}/telemetry
 *
 * @param {string} category - Event category (e.g. 'Navigation', 'Session', 'AI', 'Error')
 * @param {string} action - Action performed (e.g. 'View', 'Start', 'End', 'Call')
 * @param {string} label - Additional context (e.g. 'tasks', sessionId)
 * @param {object} metadata - Additional fields; will be spread onto the root doc
 */
export async function logEvent(category, action, label, metadata = {}) {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const sessionId = getClientSessionId();
    const expiresAt = new Date(Date.now() + TELEMETRY_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const eventDoc = {
      uid: user.uid,
      timestamp: serverTimestamp(),
      sessionId: sessionId || null,
      expiresAt,
      category,
      action,
      label,
      userAgent: navigator.userAgent,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      ...metadata,
    };

    const telemetryRef = collection(db, 'artifacts', appId, 'telemetry');
    await addDoc(telemetryRef, eventDoc);

    if (import.meta.env.DEV) {
      console.log('[Telemetry]', { category, action, label, metadata });
    }
  } catch (error) {
    // Silent fail to avoid breaking the app if telemetry fails
    if (import.meta.env.DEV) {
      console.error('[Telemetry] Failed to log event:', error);
    }
  }
}

export function logNavigation(path) {
  return logEvent('Navigation', 'View', path);
}

