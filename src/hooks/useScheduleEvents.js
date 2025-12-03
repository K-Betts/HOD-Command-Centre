import { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { appId } from '../config/appConfig';

export function useScheduleEvents(user) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!user) {
      setEvents([]);
      return;
    }

    const eventsCollection = collection(db, 'artifacts', appId, 'users', user.uid, 'scheduleEvents');
    const q = query(eventsCollection);

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
  }, [user]);

  const addEvent = (eventData) => {
    const eventsCollection = collection(db, 'artifacts', appId, 'users', user.uid, 'scheduleEvents');
    return addDoc(eventsCollection, { ...eventData, createdAt: serverTimestamp() });
  };

  const updateEvent = (eventId, eventData) => {
    const eventRef = doc(db, 'artifacts', appId, 'users', user.uid, 'scheduleEvents', eventId);
    return updateDoc(eventRef, eventData);
  };

  const deleteEvent = (eventId) => {
    const eventRef = doc(db, 'artifacts', appId, 'users', user.uid, 'scheduleEvents', eventId);
    return deleteDoc(eventRef);
  };

  return { events, addEvent, updateEvent, deleteEvent };
}