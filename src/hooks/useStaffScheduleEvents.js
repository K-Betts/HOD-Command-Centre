import { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
    where,
} from 'firebase/firestore';
import { appId } from '../config/appConfig';

export function useStaffScheduleEvents(user, staffId) {
  const [events, setEvents] = useState([]);

  /* eslint-disable react-hooks/set-state-in-effect -- Firestore subscription keeps events synced */
  useEffect(() => {
    if (!user || !staffId) {
      setEvents([]);
      return;
    }

    const eventsCollection = collection(db, 'artifacts', appId, 'users', user.uid, 'staff', staffId, 'scheduleEvents');
      const q = query(eventsCollection, where('uid', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventsData = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        startTime: d.data().startTime?.toDate(),
        endTime: d.data().endTime?.toDate(),
      }));
      setEvents(eventsData);
    });

    return () => unsubscribe();
  }, [user, staffId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const addEvent = (eventData) => {
    const eventsCollection = collection(db, 'artifacts', appId, 'users', user.uid, 'staff', staffId, 'scheduleEvents');
     return addDoc(eventsCollection, { ...eventData, uid: user.uid, createdAt: serverTimestamp() });
  };

  const updateEvent = (eventId, eventData) => {
    const eventRef = doc(db, 'artifacts', appId, 'users', user.uid, 'staff', staffId, 'scheduleEvents', eventId);
    return updateDoc(eventRef, eventData);
  };

  const deleteEvent = (eventId) => {
    const eventRef = doc(db, 'artifacts', appId, 'users', user.uid, 'staff', staffId, 'scheduleEvents', eventId);
    return deleteDoc(eventRef);
  };

  return { events, addEvent, updateEvent, deleteEvent };
}
