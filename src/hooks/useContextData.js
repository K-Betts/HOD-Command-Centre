import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { appId } from '../config/appConfig';

export function useContextData(user) {
  const [context, setContext] = useState({ events: [], goals: [] });
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
      'context'
    );
    return onSnapshot(
      ref,
      (d) => {
        setError(null);
        if (d.exists()) setContext(d.data());
        else setDoc(ref, { events: [], goals: [] });
      },
      (err) => {
        console.error(err);
        setError(err.message || 'Unable to load context.');
      }
    );
  }, [user]);

  const updateContext = async (next) => {
    if (!user) return;
    await setDoc(
      doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'context'),
      next,
      { merge: true }
    );
  };

  return { context, updateContext, error };
}
