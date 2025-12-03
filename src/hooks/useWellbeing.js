import { useMemo } from 'react';
import { useUserCollection } from './shared/useUserCollection';

export function useWellbeing(user) {
  const {
    data,
    add,
    remove,
    loading,
    error,
  } = useUserCollection(user, ['wellbeingLogs'], {
    orderBy: [{ field: 'date', direction: 'desc' }],
    filterByYear: true,
  });

  const wellbeingLogs = useMemo(() => data || [], [data]);

  const addLog = async (log) => {
    if (!user) return;
    await add(log);
  };

  const deleteLog = async (id) => {
    if (!user) return;
    await remove(id);
  };

  return { wellbeingLogs, addLog, deleteLog, loading, error };
}
