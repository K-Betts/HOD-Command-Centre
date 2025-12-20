import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { appId } from '../config/appConfig';

export function useStaffInsights(user, staffName) {
  const [insights, setInsights] = useState([]);

  /* eslint-disable react-hooks/set-state-in-effect -- Firestore subscription keeps insights fresh */
  useEffect(() => {
    if (!user || !staffName) {
      setInsights([]);
      return undefined;
    }
    const ref = collection(db, 'artifacts', appId, 'users', user.uid, 'staffInsights');
    const q = query(ref, where('uid', '==', user.uid));
    return onSnapshot(q, (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((row) => (row.staffName || '').toLowerCase() === staffName.toLowerCase())
        .sort((a, b) => {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return bTime - aTime;
        });
      setInsights(rows);
    });
  }, [user, staffName]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const deleteInsight = async (id) => {
    if (!user || !id) return;
    await deleteDoc(
      doc(db, 'artifacts', appId, 'users', user.uid, 'staffInsights', id)
    );
  };

  return { insights, deleteInsight };
}
