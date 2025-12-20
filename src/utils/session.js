export const SESSION_STORAGE_KEY = 'hod_session_id';

export function getClientSessionId() {
  try {
    return window.sessionStorage?.getItem?.(SESSION_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setClientSessionId(sessionId) {
  try {
    if (!sessionId) return;
    window.sessionStorage?.setItem?.(SESSION_STORAGE_KEY, sessionId);
  } catch {
    // ignore
  }
}
