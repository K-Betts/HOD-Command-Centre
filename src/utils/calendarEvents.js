const CATEGORY_KEYS = [
  'Academic Logistics',
  'CPD & QA',
  'Parents',
  'Enrichment/Trips',
];

export const calendarCategoryMeta = {
  'Academic Logistics': {
    label: 'Academic Logistics',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    dot: 'bg-indigo-500',
  },
  'CPD & QA': {
    label: 'CPD & QA',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
  Parents: {
    label: 'Parents',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
  },
  'Enrichment/Trips': {
    label: 'Enrichment/Trips',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
};

export const normalizeCalendarCategory = (raw = '') => {
  const lower = raw.toString().toLowerCase();
  const found = CATEGORY_KEYS.find((key) => lower.includes(key.toLowerCase()));
  return found || 'Academic Logistics';
};

export const getCalendarCategoryMeta = (category) => {
  const key = normalizeCalendarCategory(category);
  return calendarCategoryMeta[key] || calendarCategoryMeta['Academic Logistics'];
};
