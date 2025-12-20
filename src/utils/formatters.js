import { format } from 'date-fns';

function formatDate(value, pattern = 'yyyy-MM-dd') {
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
