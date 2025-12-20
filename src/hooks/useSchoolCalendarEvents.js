import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { appId } from '../config/appConfig';

const buildRef = (user) =>
  user
    ? collection(
        db,
        'artifacts',
        appId,
        'users',
        user.uid,
        'settings',
        'schoolYear',
        'calendarEvents'
      )
    : null;

const toIsoDay = (value) => {
  if (!value) return '';
  const date = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const normalizeEvent = (snapshot) => {
  const data = snapshot.data();
  const iso = toIsoDay(data.date || data.day || data.startDate || data.start);
  return {
    id: snapshot.id,
    title: data.title || data.name || '',
    category: data.category || data.type || '',
    date: iso,
    dateObj: iso ? new Date(`${iso}T00:00:00`) : null,
  };
};

export function useSchoolCalendarEvents(user) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* eslint-disable react-hooks/set-state-in-effect -- Firestore subscription drives local state updates */
  useEffect(() => {
    const ref = buildRef(user);
    if (!ref) {
      setEvents([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
      const q = query(ref, where('uid', '==', user.uid), orderBy('date', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setError(null);
        const next = snap.docs.map(normalizeEvent);
        setEvents(next);
        setLoading(false);
      },
      (err) => {
        console.error('School calendar events load failed', err);
        setError(err.message || 'Unable to load calendar events');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const replaceEvents = async (items = []) => {
    if (!user) throw new Error('No user session.');

    // Security: Validate items is an array
    if (!Array.isArray(items)) {
      console.warn('replaceEvents: items must be an array, received:', typeof items);
      return;
    }

    const ref = buildRef(user);
    if (!ref) return;

    const snap = await getDocs(ref);
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));

    items.forEach((evt) => {
      // Security: Validate evt is a valid object before accessing properties
      if (!evt || typeof evt !== 'object') {
        console.warn('replaceEvents: skipping invalid event item:', evt);
        return;
      }

      const iso = toIsoDay(evt.date || evt.dateObj);
      if (!iso) return;

      const docRef = doc(ref);
      batch.set(docRef, {
        uid: user.uid,
        title: evt.title || 'Calendar event',
        category: evt.category || 'Academic Logistics',
        date: iso,
        createdAt: serverTimestamp(),
      });
    });

    await batch.commit();
  };

  return { events, loading, error, replaceEvents };
}
