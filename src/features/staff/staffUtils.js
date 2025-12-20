import { format } from 'date-fns';

const discColorStyles = {
  Red: 'bg-red-100 text-red-700 border-red-200',
  Yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Blue: 'bg-blue-100 text-blue-700 border-blue-200',
};

const discColorHex = {
  Red: '#ef4444',
  Yellow: '#eab308',
  Green: '#22c55e',
  Blue: '#3b82f6',
};

export const getDiscColor = (colorType) =>
  discColorStyles[colorType] || 'bg-gray-100 text-gray-700 border-gray-200';

export const getSecondaryDiscColor = (colorType) => {
  const styles = {
    Red: 'border-red-200',
    Yellow: 'border-yellow-200',
    Green: 'border-emerald-200',
    Blue: 'border-blue-200',
  };
  return styles[colorType] || 'border-gray-200';
};

export const getDiscHex = (colorType) => discColorHex[colorType] || '#e5e7eb';

const interactionTypeMeta = {
  SUPPORT: {
    label: 'Support',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: 'Coaching, wellbeing, praise, listening',
  },
  CHALLENGE: {
    label: 'Challenge',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    description: 'Standards, feedback, accountability, deadlines',
  },
  ADMIN: {
    label: 'Admin',
    badgeClass: 'bg-gray-50 text-gray-600 border-gray-200',
    description: 'Neutral updates or housekeeping',
  },
  OBSERVATION: {
    label: 'Observation',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    description: 'Context, mood, team dynamics, general notes',
  },
};

export const getInteractionTypeMeta = (value) => {
  const key = (value || '').toString().toUpperCase();
  return interactionTypeMeta[key] || interactionTypeMeta.ADMIN;
};

const balanceBadges = {
  challenge: {
    label: 'Risk: High Pressure',
    className: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  support: {
    label: 'Risk: Low Standards',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  optimal: {
    label: 'Optimal Zone',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  neutral: {
    label: 'Slight Tilt',
    className: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  empty: {
    label: 'Log interactions',
    className: 'bg-gray-50 text-gray-600 border-gray-200',
  },
};

export const pickBalanceBadge = (supportRatio, hasLogs) => {
  if (!hasLogs) return balanceBadges.empty;
  const challengeRatio = 1 - supportRatio;
  if (challengeRatio > 0.7) return balanceBadges.challenge;
  if (supportRatio > 0.7) return balanceBadges.support;
  if (supportRatio >= 0.4 && supportRatio <= 0.6) return balanceBadges.optimal;
  return balanceBadges.neutral;
};

export const formatDisplayDate = (value) => {
  if (!value) return '—';
  try {
    const d = value?.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return format(d, 'yyyy-MM-dd');
  } catch {
    return String(value);
  }
};
