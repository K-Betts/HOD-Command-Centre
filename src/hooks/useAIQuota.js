import { useState, useCallback } from 'react';

const STORAGE_KEY = 'ai_quota_state';
const CALL_HISTORY_KEY = 'ai_call_history';
const COOLDOWN_KEY = 'ai_cooldown_until';
const MAX_CALLS_PER_MINUTE = 15;
const TIME_WINDOW_MS = 60000; // 60 seconds

/**
 * Initialize quota state from localStorage
 */
function initializeState() {
  const callHistory = loadCallHistory();
  const cooldownUntil = loadCooldownUntil();
  const state = { callHistory, cooldownUntil };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
  return state;
}

/**
 * Load call history from localStorage
 */
function loadCallHistory() {
  try {
    const stored = localStorage.getItem(CALL_HISTORY_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to parse call history:', e);
  }
  return [];
}

/**
 * Save call history to localStorage
 */
function saveCallHistory(history) {
  try {
    localStorage.setItem(CALL_HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.error('Failed to save call history:', e);
  }
}

/**
 * Get cooldown expiry time from localStorage
 */
function loadCooldownUntil() {
  try {
    const stored = localStorage.getItem(COOLDOWN_KEY);
    if (stored) return parseInt(stored, 10);
  } catch (e) {
    console.error('Failed to parse cooldown:', e);
  }
  return null;
}

/**
 * Save cooldown expiry time to localStorage
 */
function saveCooldownUntil(cooldownUntil) {
  try {
    if (cooldownUntil) {
      localStorage.setItem(COOLDOWN_KEY, cooldownUntil.toString());
    } else {
      localStorage.removeItem(COOLDOWN_KEY);
    }
  } catch (e) {
    console.error('Failed to save cooldown:', e);
  }
}

/**
 * useAIQuota hook - tracks API usage and cooldown
 */
export function useAIQuota() {
  const [state, setState] = useState(() => initializeState());

  /**
   * Filter call history to only include calls within the last 60 seconds
   */
  const getRecentCalls = useCallback(() => {
    const now = Date.now();
    const recentCalls = state.callHistory.filter((timestamp) => now - timestamp < TIME_WINDOW_MS);
    return recentCalls;
  }, [state.callHistory]);

  /**
   * Get remaining API calls available in the current minute
   */
  const getRemainingCalls = useCallback(() => {
    // If in cooldown, return 0
    if (state.cooldownUntil && Date.now() < state.cooldownUntil) {
      return 0;
    }

    // Clean up expired cooldown
    if (state.cooldownUntil && Date.now() >= state.cooldownUntil) {
      setState((prev) => ({
        ...prev,
        cooldownUntil: null,
      }));
      saveCooldownUntil(null);
      return MAX_CALLS_PER_MINUTE;
    }

    const recentCalls = getRecentCalls();
    return Math.max(0, MAX_CALLS_PER_MINUTE - recentCalls.length);
  }, [state.cooldownUntil, getRecentCalls]);

  /**
   * Log a new API call
   */
  const logCall = useCallback(() => {
    setState((prev) => {
      const now = Date.now();
      const recentCalls = prev.callHistory.filter((timestamp) => now - timestamp < TIME_WINDOW_MS);
      const updatedHistory = [...recentCalls, now];
      saveCallHistory(updatedHistory);
      return {
        ...prev,
        callHistory: updatedHistory,
      };
    });
  }, []);

  /**
   * Trigger cooldown when rate limit is hit
   */
  const triggerLimitHit = useCallback(() => {
    const cooldownUntil = Date.now() + TIME_WINDOW_MS;
    setState((prev) => ({
      ...prev,
      cooldownUntil,
    }));
    saveCooldownUntil(cooldownUntil);
  }, []);

  /**
   * Get current quota status as a percentage (0-100)
   */
  const getQuotaPercentage = useCallback(() => {
    const remaining = getRemainingCalls();
    return (remaining / MAX_CALLS_PER_MINUTE) * 100;
  }, [getRemainingCalls]);

  /**
   * Get human-readable status
   */
  const getStatus = useCallback(() => {
    const remaining = getRemainingCalls();
    if (remaining === 0 && state.cooldownUntil && Date.now() < state.cooldownUntil) {
      return 'cooldown';
    }
    if (remaining >= 10) return 'high';
    if (remaining >= 1) return 'low';
    return 'empty';
  }, [getRemainingCalls, state.cooldownUntil]);

  /**
   * Get time remaining in cooldown (in seconds)
   */
  const getCooldownTimeRemaining = useCallback(() => {
    if (!state.cooldownUntil || Date.now() >= state.cooldownUntil) {
      return 0;
    }
    return Math.ceil((state.cooldownUntil - Date.now()) / 1000);
  }, [state.cooldownUntil]);

  return {
    getRemainingCalls,
    getRecentCalls,
    logCall,
    triggerLimitHit,
    getQuotaPercentage,
    getStatus,
    getCooldownTimeRemaining,
    cooldownUntil: state.cooldownUntil,
  };
}

/**
 * Global cooldown function for use in services (writes directly to localStorage)
 */
export function triggerGlobalCooldown() {
  const cooldownUntil = Date.now() + TIME_WINDOW_MS;
  saveCooldownUntil(cooldownUntil);
}

/**
 * Global log call function for use in services (writes directly to localStorage)
 */
export function logGlobalCall() {
  const now = Date.now();
  let callHistory = loadCallHistory();
  const recentCalls = callHistory.filter((timestamp) => now - timestamp < TIME_WINDOW_MS);
  const updatedHistory = [...recentCalls, now];
  saveCallHistory(updatedHistory);
}
