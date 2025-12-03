import { useMemo } from 'react';
import { useUserCollection } from './shared/useUserCollection';

export function useScheduleEvents(user) {
  const {
    data,
    add,
    update,
    remove,
    loading,
    error,
  } = useUserCollection(user, ['scheduleEvents'], {
    orderBy: [{ field: 'startTime', direction: 'asc' }],
    filterByYear: true,
  });

  const events = useMemo(
    () =>
      (data || []).map((event) => ({
        ...event,
        startTime: event.startTime?.toDate ? event.startTime.toDate() : event.startTime,
        endTime: event.endTime?.toDate ? event.endTime.toDate() : event.endTime,
      })),
    [data]
  );

  const addEvent = (eventData) => {
    if (!user) return;
    return add(eventData);
  };

  const updateEvent = (eventId, eventData) => {
    if (!user) return;
    return update(eventId, eventData);
  };

  const deleteEvent = (eventId) => {
    if (!user) return;
    return remove(eventId);
  };

  return { events, addEvent, updateEvent, deleteEvent, loading, error };
}
