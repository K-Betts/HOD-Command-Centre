import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { appId } from '../config/appConfig';

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
    await setDoc(ref, { schoolPriorities }, { merge: true });
  };

  return { plan, updatePlan, savePriorities, saveSchoolPriorities, error };
}
