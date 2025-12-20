import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { appId } from '../config/appConfig';
import { getDefaultModulePreferences } from '../config/moduleDefinitions';

/**
 * Hook to manage user module preferences in Firebase
 * @param {Object} user - Firebase auth user object
 * @returns {Object} preferences, loading state, save function, and reset function
 */
export function useModulePreferences(user) {
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load preferences from Firebase
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const loadPreferences = async () => {
      try {
        setLoading(true);
        setError(null);
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'modulePreferences');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setPreferences(docSnap.data());
        } else {
          // First time user - set defaults
          const defaults = getDefaultModulePreferences();
          setPreferences(defaults);
          // Save defaults to Firebase
          await setDoc(docRef, {
            ...defaults,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.error('Error loading module preferences:', err);
        setError(err.message);
        // Fall back to defaults if there's an error
        setPreferences(getDefaultModulePreferences());
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [user?.uid]);

  /**
   * Save module preferences to Firebase
   * @param {Object} newPreferences - Updated preferences object
   */
  const savePreferences = async (newPreferences) => {
    if (!user?.uid) {
      throw new Error('User not authenticated');
    }

    try {
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'modulePreferences');
      await setDoc(docRef, {
        ...newPreferences,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      
      setPreferences(newPreferences);
      return true;
    } catch (err) {
      console.error('Error saving module preferences:', err);
      setError(err.message);
      throw err;
    }
  };

  /**
   * Reset preferences to defaults
   */
  const resetToDefaults = async () => {
    const defaults = getDefaultModulePreferences();
    await savePreferences(defaults);
  };

  /**
   * Check if a module is enabled
   * @param {string} moduleId - The module ID to check
   * @returns {boolean} Whether the module is enabled
   */
  const isModuleEnabled = (moduleId) => {
    if (!preferences?.modules) return false;
    return preferences.modules[moduleId]?.enabled ?? false;
  };

  /**
   * Check if a sub-module is enabled
   * @param {string} moduleId - The parent module ID
   * @param {string} subModuleId - The sub-module ID to check
   * @returns {boolean} Whether the sub-module is enabled
   */
  const isSubModuleEnabled = (moduleId, subModuleId) => {
    if (!preferences?.modules) return false;
    const module = preferences.modules[moduleId];
    if (!module?.enabled) return false; // Parent must be enabled
    return module.subModules?.[subModuleId] ?? false;
  };

  /**
   * Toggle a module on/off
   * @param {string} moduleId - The module ID to toggle
   */
  const toggleModule = async (moduleId) => {
    if (!preferences?.modules) return;
    
    const newPreferences = {
      ...preferences,
      modules: {
        ...preferences.modules,
        [moduleId]: {
          ...preferences.modules[moduleId],
          enabled: !preferences.modules[moduleId]?.enabled,
        },
      },
    };
    
    await savePreferences(newPreferences);
  };

  /**
   * Toggle a sub-module on/off
   * @param {string} moduleId - The parent module ID
   * @param {string} subModuleId - The sub-module ID to toggle
   */
  const toggleSubModule = async (moduleId, subModuleId) => {
    if (!preferences?.modules) return;
    
    const newPreferences = {
      ...preferences,
      modules: {
        ...preferences.modules,
        [moduleId]: {
          ...preferences.modules[moduleId],
          subModules: {
            ...preferences.modules[moduleId]?.subModules,
            [subModuleId]: !preferences.modules[moduleId]?.subModules?.[subModuleId],
          },
        },
      },
    };
    
    await savePreferences(newPreferences);
  };

  return {
    preferences,
    loading,
    error,
    savePreferences,
    resetToDefaults,
    isModuleEnabled,
    isSubModuleEnabled,
    toggleModule,
    toggleSubModule,
  };
}
