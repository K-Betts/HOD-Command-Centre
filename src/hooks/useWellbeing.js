import { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { appId } from '../config/appConfig';

export function useWellbeing(user) {
  const [wellbeingLogs, setWellbeingLogs] = useState([]);

  useEffect(() => {
    if (!user) return undefined;

    const q = query(
      collection(db, 'artifacts', appId, 'users', user.uid, 'wellbeingLogs'),
      orderBy('date', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setWellbeingLogs(data);
    });
  }, [user]);

  const addLog = async (log) => {
    if (!user) return;
    await addDoc(
      collection(db, 'artifacts', appId, 'users', user.uid, 'wellbeingLogs'),
      log
    );
  };

  const deleteLog = async (id) => {
    if (!user) return;
    await deleteDoc(
      doc(db, 'artifacts', appId, 'users', user.uid, 'wellbeingLogs', id)
    );
  };

  return { wellbeingLogs, addLog, deleteLog };
}
