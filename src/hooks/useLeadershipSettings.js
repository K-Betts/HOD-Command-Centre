import { useUserSettings } from './shared/useUserSettings';

export function useLeadershipSettings(user) {
  const { settings, updateSettings, error } = useUserSettings(user, 'leadership', { weeklyIntent: '' });

  // Maintain backward compatibility with the original function name
  const updateLeadershipSettings = updateSettings;

  return { settings, updateLeadershipSettings, error };
}
