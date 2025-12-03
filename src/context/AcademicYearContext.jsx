import React, { createContext, useContext, useMemo } from 'react';
import { useSchoolYearSettings } from '../hooks/useSchoolYearSettings';
import {
  getAcademicYearBounds,
  isWithinAcademicYear,
  normalizeTermDates,
} from '../utils/academicYear';

const AcademicYearContext = createContext({
  currentAcademicYear: '',
  terms: [],
  budgetResetDate: null,
  loading: true,
  error: null,
  isWithinCurrentYear: () => false,
});

export function AcademicYearProvider({ user, children }) {
  const { settings, loading, error } = useSchoolYearSettings(user);

  const terms = useMemo(
    () => normalizeTermDates(settings?.termDates || []),
    [settings?.termDates]
  );

  const bounds = useMemo(
    () =>
      getAcademicYearBounds({
        termDates: terms,
        budgetResetDate: settings?.budgetResetDate,
        academicYear: settings?.currentAcademicYear,
      }),
    [terms, settings?.budgetResetDate, settings?.currentAcademicYear]
  );

  const value = useMemo(
    () => ({
      currentAcademicYear: settings?.currentAcademicYear || '',
      terms,
      budgetResetDate: settings?.budgetResetDate || bounds.start || null,
      loading,
      error,
      isWithinCurrentYear: (date) =>
        isWithinAcademicYear(date, {
          termDates: terms,
          budgetResetDate: bounds.start || settings?.budgetResetDate,
          academicYear: settings?.currentAcademicYear,
        }),
    }),
    [
      settings?.currentAcademicYear,
      settings?.budgetResetDate,
      terms,
      bounds.start,
      loading,
      error,
    ]
  );

  return (
    <AcademicYearContext.Provider value={value}>
      {children}
    </AcademicYearContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- hook export is intentional
export function useAcademicYear() {
  return useContext(AcademicYearContext);
}
