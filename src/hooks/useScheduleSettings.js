import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { appId } from '../config/appConfig';

export function useScheduleSettings(user) {
  const [settings, setSettings] = useState({ timetable: {} });
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
      'schedule'
    );
    return onSnapshot(
      ref,
      (d) => {
        setError(null);
        if (d.exists()) setSettings(d.data());
        else setDoc(ref, { timetable: {} });
      },
      (err) => {
        console.error(err);
        setError(err.message || 'Unable to load schedule.');
      }
    );
  }, [user]);

  const updateSettings = async (next) => {
    if (!user) return;
    await setDoc(
      doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'schedule'),
      next,
      { merge: true }
    );
  };

  return { settings, updateSettings, error };
}
