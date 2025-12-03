import { useEffect, useMemo, useState, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { appId } from '../../config/appConfig';

/**
 * Generic Firestore doc hook scoped to the current user.
 * Creates the doc with defaults if missing (opt-in).
 */
export function useUserDoc(user, segments = [], options = {}) {
  const { defaultValue = {}, createIfMissing = true, mapDoc } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const docRef = useMemo(() => {
    if (!user) return null;
    return doc(db, 'artifacts', appId, 'users', user.uid, ...segments);
  }, [user, segments]);

  /* eslint-disable react-hooks/set-state-in-effect -- Firestore subscription drives local state */
  useEffect(() => {
    if (!docRef) {
      setData(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(
      docRef,
      async (snap) => {
        setError(null);
        if (snap.exists()) {
          const row = { id: snap.id, ...snap.data() };
          setData(mapDoc ? mapDoc(row) : row);
          setLoading(false);
          return;
        }

        if (createIfMissing) {
          const payload = { ...defaultValue, uid: user.uid };
          await setDoc(docRef, payload, { merge: true });
          setData({ id: snap.id, ...payload });
        } else {
          setData(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('useUserDoc snapshot error', err);
        setError(err.message || 'Failed to load document.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [docRef, createIfMissing, defaultValue, mapDoc, user]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const save = useCallback(
    async (updates) => {
      if (!docRef || !user) throw new Error('No user session.');
      await setDoc(docRef, { ...updates, uid: user.uid }, { merge: true });
    },
    [docRef, user]
  );

  return { data, loading, error, save };
}
