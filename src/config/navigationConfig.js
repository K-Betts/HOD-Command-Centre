import { Heart } from 'lucide-react';
import { MODULE_DEFINITIONS } from './moduleDefinitions';

/**
 * Centralized navigation configuration for Sidebar and Mobile Nav.
 * Ensures consistent labels, order, icons, and badge rules across all nav surfaces.
 */

export const getMainNavGroups = () => [
  {
    title: 'EXECUTION',
    items: [
      { id: 'dashboard', label: MODULE_DEFINITIONS.dashboard.label, icon: MODULE_DEFINITIONS.dashboard.icon, note: MODULE_DEFINITIONS.dashboard.note },
      { id: 'tasks', label: MODULE_DEFINITIONS.tasks.label, icon: MODULE_DEFINITIONS.tasks.icon, note: MODULE_DEFINITIONS.tasks.note },
      { id: 'meetings', label: MODULE_DEFINITIONS.meetings.label, icon: MODULE_DEFINITIONS.meetings.icon, note: MODULE_DEFINITIONS.meetings.note },
    ],
  },
  {
    title: 'LEADERSHIP',
    items: [
      { id: 'staff', label: MODULE_DEFINITIONS.staff.label, icon: MODULE_DEFINITIONS.staff.icon, note: MODULE_DEFINITIONS.staff.note },
      { id: 'strategy', label: MODULE_DEFINITIONS.strategy.label, icon: MODULE_DEFINITIONS.strategy.icon, note: MODULE_DEFINITIONS.strategy.note },
      { id: 'reports', label: MODULE_DEFINITIONS.reports.label, icon: MODULE_DEFINITIONS.reports.icon, note: MODULE_DEFINITIONS.reports.note },
    ],
  },
  {
    title: 'OUTPUTS',
    items: [
      { id: 'comms', label: MODULE_DEFINITIONS.comms.label, icon: MODULE_DEFINITIONS.comms.icon },
      { id: 'weeklyEmail', label: MODULE_DEFINITIONS.weeklyEmail.label, icon: MODULE_DEFINITIONS.weeklyEmail.icon },
    ],
  },
  {
    title: 'WELLNESS',
    items: [
      { id: 'wellbeing', label: 'Wellbeing', icon: Heart },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      { id: 'settings', label: MODULE_DEFINITIONS.settings.label, icon: MODULE_DEFINITIONS.settings.icon, note: MODULE_DEFINITIONS.settings.note },
    ],
  },
];

/**
 * Mobile nav primary items (bottom tab bar)
 */
export const getMobileNavPrimaryItems = () => [
  { id: 'dashboard', label: 'Dashboard', icon: MODULE_DEFINITIONS.dashboard.icon },
  { id: 'tasks', label: 'Tasks', icon: MODULE_DEFINITIONS.tasks.icon },
  { id: 'staff', label: 'Staff', icon: MODULE_DEFINITIONS.staff.icon },
  { id: 'settings', label: 'Settings', icon: MODULE_DEFINITIONS.settings.icon },
];

/**
 * Mobile nav "More" menu items (secondary)
 */
export const getMobileNavMoreItems = () => [
  { id: 'meetings', label: 'Meetings', icon: MODULE_DEFINITIONS.meetings.icon },
  { id: 'strategy', label: 'Strategy', icon: MODULE_DEFINITIONS.strategy.icon },
  { id: 'comms', label: 'Comms', icon: MODULE_DEFINITIONS.comms.icon },
  { id: 'weeklyEmail', label: 'Email', icon: MODULE_DEFINITIONS.weeklyEmail.icon },
  { id: 'reports', label: 'Reports', icon: MODULE_DEFINITIONS.reports.icon },
  { id: 'wellbeing', label: 'Wellbeing', icon: Heart },
];

/**
 * Flatten main nav groups into a single array for easy lookup.
 */
export const getAllNavItems = () => {
  const groups = getMainNavGroups();
  return groups.reduce((acc, group) => [...acc, ...group.items], []);
};

/**
 * Get badge count for nav item (e.g., waiting count for tasks).
 */
export const getNavItemBadge = (itemId, context = {}) => {
  if (itemId === 'tasks' && context.waitingCount !== undefined) {
    return context.waitingCount > 0 ? context.waitingCount : null;
  }
  return null;
};
