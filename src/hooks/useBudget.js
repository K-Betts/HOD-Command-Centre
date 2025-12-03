import { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { appId } from '../config/appConfig';

export function useBudget(user) {
  const [expenses, setExpenses] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) return undefined;
    const q = query(
      collection(db, 'artifacts', appId, 'users', user.uid, 'budget'),
      orderBy('date', 'desc')
    );
    return onSnapshot(
      q,
      (s) => {
        setError(null);
        setExpenses(s.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error(err);
        setError(err.message || 'Unable to load budget.');
      }
    );
  }, [user]);

  const addExpense = async (expense) => {
    if (!user) return;
    await addDoc(
      collection(db, 'artifacts', appId, 'users', user.uid, 'budget'),
      expense
    );
  };

  const deleteExpense = async (id) => {
    if (!user) return;
    await deleteDoc(
      doc(db, 'artifacts', appId, 'users', user.uid, 'budget', id)
    );
  };

  const updateExpense = async (id, updates) => {
    if (!user) return;
    await updateDoc(
      doc(db, 'artifacts', appId, 'users', user.uid, 'budget', id),
      updates
    );
  };

  return { expenses, addExpense, deleteExpense, updateExpense, error };
}
