import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { appId } from '../config/appConfig';

export function useStrategy(user) {
  const [plan, setPlan] = useState({ milestones: [], themes: [], raw: '', priorities: [] });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) return undefined;
    const ref = doc(
      db,
      'artifacts',
      appId,
      'users',
      user.uid,
      'settings',
      'strategy'
    );
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
            raw: data.raw || '',
          });
        } else {
          setDoc(ref, { milestones: [], themes: [], priorities: [], raw: '' });
        }
      },
      (err) => {
        console.error(err);
        setError(err.message || 'Unable to load strategy.');
      }
    );
  }, [user]);

  const updatePlan = async (next) => {
    if (!user) return;
    await setDoc(
      doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'strategy'),
      next,
      { merge: true }
    );
  };

  return { plan, updatePlan, error };
}
