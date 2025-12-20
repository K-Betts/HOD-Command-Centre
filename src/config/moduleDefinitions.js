import {
  LayoutGrid,
  CheckSquare,
  Users,
  Map,
  MessageSquare,
  Mail,
  SlidersHorizontal,
  FileText,
  NotebookPen,
  ClipboardList,
  Calendar,
  Layers,
  Lightbulb,
} from 'lucide-react';

/**
 * Module Definitions
 * Centralized configuration for all application modules
 * Used for navigation, permissions, and user preferences
 */

export const MODULE_DEFINITIONS = {
  dashboard: {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutGrid,
    description: 'Mission control - see your day at a glance with tasks, meetings, and key priorities',
    category: 'EXECUTION',
    defaultEnabled: true,
    note: 'Mission control',
  },
  tasks: {
    id: 'tasks',
    label: 'Tasks',
    icon: CheckSquare,
    description: 'Task cockpit with archive filter, waiting-for tracking, and quick task capture',
    category: 'EXECUTION',
    defaultEnabled: true,
    note: 'Includes archive filter',
  },
  meetings: {
    id: 'meetings',
    label: 'Meetings',
    icon: NotebookPen,
    description: 'Meeting agendas, minutes, and action item tracking',
    category: 'EXECUTION',
    defaultEnabled: true,
    note: 'Agendas + minutes',
  },
  staff: {
    id: 'staff',
    label: 'Staff Room',
    icon: Users,
    description: 'Staff management, interactions tracking, and leadership insights',
    category: 'LEADERSHIP',
    defaultEnabled: true,
    note: 'Leadership tab inside',
    subModules: {
      leadership: {
        id: 'leadership',
        label: 'Leadership',
        description: 'Leadership-specific tools and insights',
        defaultEnabled: true,
      },
    },
  },
  strategy: {
    id: 'strategy',
    label: 'Strategy',
    icon: Map,
    description: 'Map your strategic horizon with SIP priorities, projects, calendar planning, and budget',
    category: 'LEADERSHIP',
    defaultEnabled: false,
    note: 'Horizon + Budget',
    subModules: {
      priorities: {
        id: 'priorities',
        label: 'Priorities (SIP)',
        icon: ClipboardList,
        description: 'School Improvement Plan priorities and strategic focus areas',
        defaultEnabled: true,
      },
      calendar: {
        id: 'calendar',
        label: 'Half-Term Overview',
        icon: Calendar,
        description: 'Department calendar planning and term-by-term horizon view',
        defaultEnabled: true,
      },
      projects: {
        id: 'projects',
        label: 'Projects',
        icon: Layers,
        description: 'Strategic project management with WHY validation and Devil\'s Advocate',
        defaultEnabled: true,
      },
      budget: {
        id: 'budget',
        label: 'Budget',
        icon: Lightbulb,
        description: 'Department budget tracking, allocation, and financial planning',
        defaultEnabled: true,
      },
    },
  },
  reports: {
    id: 'reports',
    label: 'Reports',
    icon: FileText,
    description: 'Generate board reports and department summaries with AI assistance',
    category: 'LEADERSHIP',
    defaultEnabled: false,
    note: 'Board report',
  },
  comms: {
    id: 'comms',
    label: 'Comms',
    icon: MessageSquare,
    description: 'Communication shield for drafting important messages with stakeholder analysis',
    category: 'OUTPUTS',
    defaultEnabled: true,
  },
  weeklyEmail: {
    id: 'weeklyEmail',
    label: 'Weekly Email',
    icon: Mail,
    description: 'Generate weekly email updates for your team with AI assistance',
    category: 'OUTPUTS',
    defaultEnabled: false,
  },
  settings: {
    id: 'settings',
    label: 'Settings',
    icon: SlidersHorizontal,
    description: 'System settings, academic year configuration, schedule, and module preferences',
    category: 'SYSTEM',
    defaultEnabled: true,
    required: true, // System settings cannot be disabled
    note: 'Schedule & timetable',
  },
};

/**
 * Get default module preferences for a new user
 * @returns {Object} Default module preferences object
 */
export function getDefaultModulePreferences() {
  const preferences = { modules: {} };

  Object.keys(MODULE_DEFINITIONS).forEach((moduleId) => {
    const module = MODULE_DEFINITIONS[moduleId];
    preferences.modules[moduleId] = {
      enabled: module.defaultEnabled,
    };

    // Add sub-modules if they exist
    if (module.subModules) {
      preferences.modules[moduleId].subModules = {};
      Object.keys(module.subModules).forEach((subModuleId) => {
        const subModule = module.subModules[subModuleId];
        preferences.modules[moduleId].subModules[subModuleId] = subModule.defaultEnabled;
      });
    }
  });

  return preferences;
}

/**
 * Group modules by category for display
 * @returns {Object} Modules grouped by category
 */
export function getModulesByCategory() {
  const grouped = {};

  Object.values(MODULE_DEFINITIONS).forEach((module) => {
    if (!grouped[module.category]) {
      grouped[module.category] = [];
    }
    grouped[module.category].push(module);
  });

  return grouped;
}
