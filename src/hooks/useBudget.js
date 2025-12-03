import { useMemo } from 'react';
import { useUserCollection } from './shared/useUserCollection';

export function useBudget(user) {
  const {
    data,
    add,
    remove,
    update,
    error,
    loading,
  } = useUserCollection(user, ['budgetItems'], {
    orderBy: [{ field: 'date', direction: 'desc' }],
    filterByYear: true,
  });

  const expenses = useMemo(() => data || [], [data]);

  const addExpense = async (expense) => {
    if (!user) return;
    await add(expense);
  };

  const deleteExpense = async (id) => {
    if (!user) return;
    await remove(id);
  };

  const updateExpense = async (id, updates) => {
    if (!user) return;
    await update(id, updates);
  };

  return { expenses, addExpense, deleteExpense, updateExpense, error, loading };
}
