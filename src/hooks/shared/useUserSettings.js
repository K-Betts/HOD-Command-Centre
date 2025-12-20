import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { appId } from '../../config/appConfig';

/**
 * Generic hook for fetching and updating user settings
 * @param {Object} user - Firebase user object with uid
 * @param {string} settingsKey - The settings document name (e.g., 'schedule', 'budget', 'leadership')
 * @param {Object} defaultValue - Default settings value if document doesn't exist
 * @returns {Object} { settings, updateSettings, error }
 */
export function useUserSettings(user, settingsKey, defaultValue = {}) {
  const [settings, setSettings] = useState(defaultValue);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.uid) return undefined;

    const ref = doc(
      db,
      'artifacts',
      appId,
      'users',
      user.uid,
      'settings',
      settingsKey
    );

    return onSnapshot(
      ref,
      (snapshot) => {
        setError(null);
        if (snapshot.exists()) {
          setSettings(snapshot.data());
        } else {
          // Create default document if it doesn't exist
          setDoc(ref, defaultValue).catch((err) => {
            console.error(`Failed to initialize ${settingsKey} settings:`, err);
          });
        }
      },
      (err) => {
        console.error(`${settingsKey} settings load failed:`, err);
        setError(err.message || `Unable to load ${settingsKey} settings`);
      }
    );
  }, [user?.uid, settingsKey, defaultValue]);

  const updateSettings = async (next) => {
    if (!user?.uid) return;
    try {
      const ref = doc(
        db,
        'artifacts',
        appId,
        'users',
        user.uid,
        'settings',
        settingsKey
      );
      await setDoc(ref, next, { merge: true });
    } catch (err) {
      console.error(`Failed to update ${settingsKey} settings:`, err);
      throw err;
    }
  };

  return { settings, updateSettings, error };
}
