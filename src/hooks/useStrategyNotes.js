import { useMemo } from 'react';
import { useUserCollection } from './shared/useUserCollection';

export function useStrategyNotes(user) {
  const {
    data: notes,
    remove,
    loading,
    error,
  } = useUserCollection(user, ['strategyNotes']);

  const sortedNotes = useMemo(() => {
    const list = Array.isArray(notes) ? notes.slice() : [];
    return list.sort((a, b) => {
      const aDate = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
      const bDate = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
      return bDate - aDate;
    });
  }, [notes]);

  const deleteNote = async (id) => {
    if (!id) return;
    await remove(id);
  };

  return { notes: sortedNotes, deleteNote, loading, error };
}
