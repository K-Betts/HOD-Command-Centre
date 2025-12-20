import { useUserSettings } from './shared/useUserSettings';

export function useBudgetSettings(user) {
  return useUserSettings(user, 'budget', { totalBudget: 5000, currency: 'AED' });
}
