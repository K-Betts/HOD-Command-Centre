import { format } from 'date-fns';

export function formatDate(value, pattern = 'yyyy-MM-dd') {
  if (!value) return '';
  try {
    const d = value?.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return format(d, pattern);
  } catch {
    return '';
  }
}

export function formatFriendlyDate(value) {
  return formatDate(value, 'MMM d');
}

export function formatShortDate(value) {
  return formatDate(value, 'EEE d MMM');
}
