import React, { useEffect, useState } from 'react';
import { CalendarDays, Save, Plus, Trash2 } from 'lucide-react';
import { useSchoolYearSettings } from '../../hooks/useSchoolYearSettings';
import { formatDateInput, getAcademicYearLabel } from '../../utils/academicYear';

export function SchoolYearSettings({ user }) {
  const { settings, saveSettings, loading, error } = useSchoolYearSettings(user);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [formState, setFormState] = useState({
    currentAcademicYear: getAcademicYearLabel(),
    budgetResetDate: formatDateInput(new Date()),
    termDates: [],
  });

  useEffect(() => {
    setFormState({
      currentAcademicYear: settings?.currentAcademicYear || getAcademicYearLabel(),
      budgetResetDate: formatDateInput(settings?.budgetResetDate),
      termDates: (settings?.termDates || []).map((term, idx) => ({
        name: term.name || `Term ${idx + 1}`,
        start: formatDateInput(term.start),
        end: formatDateInput(term.end),
      })),
    });
  }, [settings]);

  const handleTermChange = (index, field, value) => {
    setFormState((prev) => {
      const updated = [...prev.termDates];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, termDates: updated };
    });
  };

  const handleAddTerm = () => {
    setFormState((prev) => ({
      ...prev,
      termDates: [
        ...prev.termDates,
        { name: `Term ${prev.termDates.length + 1}`, start: '', end: '' },
      ],
    }));
  };

  const handleRemoveTerm = (index) => {
    setFormState((prev) => ({
      ...prev,
      termDates: prev.termDates.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatus('');
    try {
      await saveSettings({
        currentAcademicYear: formState.currentAcademicYear || getAcademicYearLabel(),
        budgetResetDate: formState.budgetResetDate,
        termDates: formState.termDates,
      });
      setStatus('Saved');
    } catch (err) {
      console.error(err);
      setStatus(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-indigo-600 uppercase tracking-[0.2em] flex items-center gap-2">
              <CalendarDays className="w-4 h-4" /> Academic Rhythm
            </p>
            <h2 className="text-2xl font-bold text-gray-900 mt-1">
              School Year Settings
            </h2>
            <p className="text-sm text-gray-500 mt-2">
              Define the active academic year, reset date, and term boundaries. New data will
              automatically inherit this academic year tag.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {status && (
              <span
                className={`text-sm font-semibold ${
                  status === 'Saved' ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {status}
              </span>
            )}
            {error && (
              <span className="text-sm text-rose-600 font-semibold">Error: {error}</span>
            )}
            <button
              type="submit"
              form="school-year-form"
              disabled={saving || loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        <form id="school-year-form" onSubmit={handleSave} className="mt-6 grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Current Academic Year
              </span>
              <input
                type="text"
                value={formState.currentAcademicYear}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, currentAcademicYear: e.target.value }))
                }
                className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="2024-2025"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Budget Reset Date
              </span>
              <input
                type="date"
                value={formState.budgetResetDate || ''}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, budgetResetDate: e.target.value }))
                }
                className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <p className="text-xs text-gray-400 mt-1">
                Used as the yearly reset marker for budgets and rollover logic.
              </p>
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Term Dates
                </span>
                <p className="text-xs text-gray-400">
                  These boundaries feed isWithinCurrentYear checks and timeline filters.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddTerm}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:border-indigo-200 hover:text-indigo-700"
              >
                <Plus className="w-4 h-4" /> Add Term
              </button>
            </div>

            <div className="space-y-3">
              {formState.termDates.length === 0 && (
                <div className="border border-dashed border-gray-200 rounded-lg p-4 text-sm text-gray-400">
                  No terms defined yet. Add your first term to anchor the year.
                </div>
              )}
              {formState.termDates.map((term, idx) => (
                <div
                  key={`${term.name}-${idx}`}
                  className="border border-gray-100 rounded-lg p-4 bg-gray-50/50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <input
                      type="text"
                      value={term.name}
                      onChange={(e) => handleTermChange(idx, 'name', e.target.value)}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveTerm(idx)}
                      className="p-2 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-white"
                      aria-label="Remove term"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Start
                      <input
                        type="date"
                        value={term.start || ''}
                        onChange={(e) => handleTermChange(idx, 'start', e.target.value)}
                        className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      End
                      <input
                        type="date"
                        value={term.end || ''}
                        onChange={(e) => handleTermChange(idx, 'end', e.target.value)}
                        className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
