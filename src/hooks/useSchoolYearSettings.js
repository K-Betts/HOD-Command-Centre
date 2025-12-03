import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { appId } from '../config/appConfig';
import {
  getAcademicYearLabel,
  getDefaultBudgetResetDate,
  normalizeTermDates,
  toDateValue,
} from '../utils/academicYear';

const buildDefaults = () => {
  const currentAcademicYear = getAcademicYearLabel();
  const budgetResetDate =
    getDefaultBudgetResetDate(currentAcademicYear) || new Date();
  return { currentAcademicYear, budgetResetDate, termDates: [], budgetSpent: 0 };
};

const normalizeSettings = (payload) => {
  const currentAcademicYear =
    payload?.currentAcademicYear || getAcademicYearLabel();
  const budgetResetDate =
    toDateValue(payload?.budgetResetDate) ||
    getDefaultBudgetResetDate(currentAcademicYear) ||
    null;
  const termDates = normalizeTermDates(payload?.termDates || []);
  const budgetSpent = Number(payload?.budgetSpent) || 0;
  return { currentAcademicYear, budgetResetDate, termDates, budgetSpent };
};

const serializeSettings = (payload) => {
  const normalized = normalizeSettings(payload);
  return {
    currentAcademicYear: normalized.currentAcademicYear,
    budgetResetDate: normalized.budgetResetDate || null,
    termDates: normalized.termDates.map((term, idx) => ({
      name: term.name || `Term ${idx + 1}`,
      start: term.start || null,
      end: term.end || null,
    })),
    budgetSpent: Number(normalized.budgetSpent) || 0,
  };
};

export function useSchoolYearSettings(user) {
  const [settings, setSettings] = useState(buildDefaults());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* eslint-disable react-hooks/set-state-in-effect -- Firestore subscription drives settings state */
  useEffect(() => {
    if (!user) {
      setSettings(buildDefaults());
      setLoading(false);
      return undefined;
    }

    const ref = doc(
      db,
      'artifacts',
      appId,
      'users',
      user.uid,
      'settings',
      'schoolYear'
    );

    setLoading(true);
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        setError(null);
        if (snap.exists()) {
          setSettings(normalizeSettings(snap.data()));
        } else {
          const defaults = buildDefaults();
          setSettings(defaults);
          setDoc(ref, serializeSettings(defaults));
        }
        setLoading(false);
      },
      (err) => {
        console.error('School year settings load failed', err);
        setError(err.message || 'Unable to load school year settings');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const saveSettings = async (next) => {
    if (!user) throw new Error('No user session.');
    const ref = doc(
      db,
      'artifacts',
      appId,
      'users',
      user.uid,
      'settings',
      'schoolYear'
    );
    const payload = serializeSettings(next);
    await setDoc(ref, payload, { merge: true });
  };

  return { settings, saveSettings, loading, error };
}
