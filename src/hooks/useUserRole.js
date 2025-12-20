import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { db } from '../services/firebase';

export function useUserRole(user) {
  const uid = user?.uid || null;
  const [state, setState] = useState({ uid: null, role: null, loading: true });

  useEffect(() => {
    if (!uid) return undefined;

    const unsubscribe = onSnapshot(
      doc(db, 'roles', uid),
      (snap) => {
        const value = snap.exists() ? snap.data()?.role : null;
        setState({ uid, role: typeof value === 'string' ? value : null, loading: false });
      },
      () => {
        setState({ uid, role: null, loading: false });
      }
    );

    return unsubscribe;
  }, [uid]);

  const role = state.uid === uid ? state.role : null;
  const loading = uid ? (state.uid === uid ? state.loading : true) : false;

  return {
    role,
    loading,
    isUser: role === 'user' || role === 'admin' || role === 'superadmin',
    isAdmin: role === 'admin' || role === 'superadmin',
    isSuperAdmin: role === 'superadmin',
  };
}
