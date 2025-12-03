import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { appId } from '../config/appConfig';

export function useLeadershipSettings(user) {
  const [settings, setSettings] = useState({ weeklyIntent: '' });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) return undefined;
    const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'leadership');
    return onSnapshot(
      ref,
      (snap) => {
        setError(null);
        if (snap.exists()) {
          const data = snap.data();
          setSettings({
            weeklyIntent: data.weeklyIntent || '',
          });
        } else {
          setDoc(ref, { weeklyIntent: '' });
        }
      },
      (err) => {
        console.error('Leadership settings load failed', err);
        setError(err.message || 'Unable to load leadership settings');
      }
    );
  }, [user]);

  const updateLeadershipSettings = async (next) => {
    if (!user) return;
    const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'leadership');
    await setDoc(ref, next, { merge: true });
  };

  return { settings, updateLeadershipSettings, error };
}
