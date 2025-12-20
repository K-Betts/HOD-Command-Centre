import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { appId } from '../config/appConfig';

export function useContextData(user) {
  const [context, setContext] = useState({ events: [], goals: [] });
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
      'context'
    );

    let unsubscribe;
    let cancelled = false;

    const seedAndSubscribe = async () => {
      try {
        await setDoc(ref, { uid: user.uid }, { merge: true });
        if (cancelled) return;

        unsubscribe = onSnapshot(
          ref,
          (d) => {
            setError(null);
            if (d.exists()) setContext(d.data());
            else setDoc(ref, { uid: user.uid, events: [], goals: [] });
          },
          (err) => {
            console.error(err);
            setError(err.message || 'Unable to load context.');
          }
        );
      } catch (err) {
        console.error(err);
        setError(err.message || 'Unable to load context.');
      }
    };

    seedAndSubscribe();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  const updateContext = async (next) => {
    if (!user?.uid) return;
    await setDoc(
      doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'context'),
      { ...next, uid: user.uid },
      { merge: true }
    );
  };

  return { context, updateContext, error };
}
