import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { appId } from '../config/appConfig';

/**
 * Hook to manage strategy data scoped to the academic year level.
 * 
 * Data structure:
 * - schoolPriorities: Year-long mandates (SIP). NOT filtered by term. Persists across all terms.
 * - priorities: Term-specific actions. These are now stored in departmentPlan/ subcollection.
 *   This is kept for backward compatibility but should migrate to departmentPlan soon.
 * - milestones, themes, raw: General strategy metadata (year-level).
 * 
 * Note: Do NOT scope these to terms or half-terms.
 * Only the Department Calendar and its actions are term-specific (stored in strategy/departmentPlan).
 */
export function useStrategy(user) {
  const [plan, setPlan] = useState({
    milestones: [],
    themes: [],
    raw: '',
    priorities: [],
    schoolPriorities: [],
  });
  const [error, setError] = useState(null);
  const ref = useMemo(
    () =>
      user
        ? doc(
            db,
            'artifacts',
            appId,
            'users',
            user.uid,
            'settings',
            'strategy'
          )
        : null,
    [user]
  );

  useEffect(() => {
    if (!ref) return undefined;
    return onSnapshot(
      ref,
      (d) => {
        setError(null);
        if (d.exists()) {
          const data = d.data();
          setPlan({
            milestones: data.milestones || [],
            themes: data.themes || [],
            priorities: data.priorities || [],
            // IMPORTANT: schoolPriorities are fetched based on academicYear ONLY (no term filter)
            // They represent year-long mandates and should persist across all terms
            schoolPriorities: data.schoolPriorities || [],
            raw: data.raw || '',
          });
        } else {
          setDoc(ref, {
            milestones: [],
            themes: [],
            priorities: [],
            schoolPriorities: [],
            raw: '',
          });
        }
      },
      (err) => {
        console.error(err);
        setError(err.message || 'Unable to load strategy.');
      }
    );
  }, [ref]);

  const updatePlan = async (next) => {
    if (!ref) return;
    await setDoc(ref, next, { merge: true });
  };

  const savePriorities = async (priorities) => {
    if (!ref) return;
    await setDoc(ref, { priorities }, { merge: true });
  };

  const saveSchoolPriorities = async (schoolPriorities) => {
    if (!ref) return;
    // Save school priorities at year level (NOT term-specific)
    await setDoc(ref, { schoolPriorities }, { merge: true });
  };

  return { plan, updatePlan, savePriorities, saveSchoolPriorities, error };
}
