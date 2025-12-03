import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { appId } from '../config/appConfig';

export function useBudgetSettings(user) {
  const [settings, setSettings] = useState({ totalBudget: 5000, currency: 'AED' });

  useEffect(() => {
    if (!user) return undefined;
    const ref = doc(
      db,
      'artifacts',
      appId,
      'users',
      user.uid,
      'settings',
      'budget'
    );
    return onSnapshot(ref, (d) => {
      if (d.exists()) setSettings(d.data());
      else setDoc(ref, { totalBudget: 5000, currency: 'AED' });
    });
  }, [user]);

  const updateSettings = async (next) => {
    if (!user) return;
    await setDoc(
      doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'budget'),
      next,
      { merge: true }
    );
  };

  return { settings, updateSettings };
}
