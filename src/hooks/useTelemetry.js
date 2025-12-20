import { useCallback, useRef } from 'react';
import { auth } from '../services/firebase';
import { logEvent as writeTelemetryEvent } from '../services/telemetry';

/**
 * Custom hook for telemetry tracking across the application
 * Provides a unified interface for logging user events to Firestore
 * 
 * @returns {Object} Telemetry functions
 */
export function useTelemetry() {
  const isLoggingRef = useRef(false);

  /**
   * Log an event to the telemetry system
   * @param {string} category - Event category (e.g., 'Navigation', 'Feature', 'Interaction')
   * @param {string} action - Action performed (e.g., 'Click', 'View', 'Submit')
   * @param {string} label - Additional context (e.g., '/tasks', 'Export Report')
   * @param {Object} metadata - Optional additional metadata to include
   */
  const logEvent = useCallback(async (category, action, label, metadata = {}) => {
    // Prevent duplicate logging if already in progress
    if (isLoggingRef.current) return;

    try {
      isLoggingRef.current = true;
      
      const user = auth.currentUser;
      if (!user) {
        if (import.meta.env.DEV) {
          console.warn('[Telemetry] No authenticated user, skipping event log');
        }
        return;
      }

      await writeTelemetryEvent(category, action, label, metadata);
    } catch (error) {
      // Fail silently to avoid disrupting user experience
      if (import.meta.env.DEV) {
        console.error('[Telemetry] Failed to log event:', error);
      }
    } finally {
      isLoggingRef.current = false;
    }
  }, []);

  /**
   * Log a navigation event (page view)
   * @param {string} path - The route or tab name
   */
  const logNavigation = useCallback((path) => {
    logEvent('Navigation', 'View', path);
  }, [logEvent]);

  /**
   * Log a feature interaction
   * @param {string} featureName - Name of the feature
   * @param {string} action - Action taken
   * @param {Object} metadata - Additional context
   */
  const logFeatureUse = useCallback((featureName, action, metadata = {}) => {
    logEvent('Feature', action, featureName, metadata);
  }, [logEvent]);

  /**
   * Log an error or exception
   * @param {string} errorMessage - Error message
   * @param {Object} errorDetails - Error details and stack trace
   */
  const logError = useCallback((errorMessage, errorDetails = {}) => {
    logEvent('Error', 'Exception', errorMessage, {
      ...errorDetails,
      url: window.location.href,
    });
  }, [logEvent]);

  return {
    logEvent,
    logNavigation,
    logFeatureUse,
    logError,
  };
}

