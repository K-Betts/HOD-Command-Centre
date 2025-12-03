// Utilities for working with academic year boundaries and dates
export function toDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === 'function') {
    try {
      const d = value.toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateInput(value) {
  const d = toDateValue(value);
  if (!d) return '';
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getAcademicYearLabel(date = new Date()) {
  const d = toDateValue(date) || new Date();
  const year = d.getFullYear();
  const month = d.getMonth();
  const startYear = month >= 7 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

export function getAcademicYearStartYear(academicYear) {
  const match = /^(\d{4})/.exec(academicYear || '');
  return match ? Number(match[1]) : null;
}

export function getDefaultBudgetResetDate(academicYear) {
  const startYear = getAcademicYearStartYear(academicYear) ?? getAcademicYearStartYear(getAcademicYearLabel());
  if (!startYear) return null;
  return new Date(startYear, 8, 1); // Sept 1 of the starting year
}

export function normalizeTermDates(termDates = []) {
  return termDates
    .map((term, idx) => {
      const start = toDateValue(term?.start);
      const end = toDateValue(term?.end);
      return {
        name: term?.name || `Term ${idx + 1}`,
        start,
        end,
      };
    })
    .filter((term) => term.name || term.start || term.end);
}

export function getAcademicYearBounds({ termDates = [], budgetResetDate, academicYear }) {
  const normalizedTerms = normalizeTermDates(termDates);
  const starts = normalizedTerms.map((t) => t.start).filter(Boolean);
  const ends = normalizedTerms.map((t) => t.end).filter(Boolean);

  let start = starts.length ? new Date(Math.min(...starts.map((d) => d.getTime()))) : toDateValue(budgetResetDate);
  const startYear = getAcademicYearStartYear(academicYear);
  if (!start && startYear) start = new Date(startYear, 7, 1); // Aug 1 as a safe default

  let end = ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : null;
  if (!end && start) {
    end = new Date(start);
    end.setFullYear(end.getFullYear() + 1);
    end.setDate(end.getDate() - 1);
  } else if (!end && startYear) {
    end = new Date(startYear + 1, 6, 31); // July 31 of the following year
  }

  return { start: start || null, end: end || null, terms: normalizedTerms };
}

export function isWithinAcademicYear(date, { termDates = [], budgetResetDate, academicYear }) {
  const target = toDateValue(date);
  if (!target) return false;
  const { start, end } = getAcademicYearBounds({ termDates, budgetResetDate, academicYear });
  if (start && target < start) return false;
  if (end && target > end) return false;
  return true;
}
