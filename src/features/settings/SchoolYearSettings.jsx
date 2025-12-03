import React, { useEffect, useState } from 'react';
import { CalendarDays, Save, Plus, Trash2, Upload, Sparkles, AlertTriangle, RotateCcw } from 'lucide-react';
import { collection, getDocs, query, updateDoc, where, serverTimestamp } from 'firebase/firestore';
import { useSchoolYearSettings } from '../../hooks/useSchoolYearSettings';
import { formatDateInput, getAcademicYearLabel } from '../../utils/academicYear';
import { parseSchoolCalendar } from '../../services/ai';
import { useSchoolCalendarEvents } from '../../hooks/useSchoolCalendarEvents';
import { getCalendarCategoryMeta, normalizeCalendarCategory } from '../../utils/calendarEvents';
import { db } from '../../services/firebase';
import { appId } from '../../config/appConfig';

export function SchoolYearSettings({ user }) {
  const { settings, saveSettings, loading, error } = useSchoolYearSettings(user);
  const {
    events: calendarEvents,
    loading: calendarLoading,
    replaceEvents,
  } = useSchoolCalendarEvents(user);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [calendarStatus, setCalendarStatus] = useState('');
  const [showCalendarImport, setShowCalendarImport] = useState(false);
  const [calendarText, setCalendarText] = useState('');
  const [importingCalendar, setImportingCalendar] = useState(false);
  const [formState, setFormState] = useState({
    currentAcademicYear: getAcademicYearLabel(),
    budgetResetDate: formatDateInput(new Date()),
    termDates: [],
  });
  const [showRolloverModal, setShowRolloverModal] = useState(false);
  const [nextAcademicYear, setNextAcademicYear] = useState('');
  const [rolloverStatus, setRolloverStatus] = useState('');
  const [rollingOver, setRollingOver] = useState(false);

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

  const deriveNextAcademicYear = (label) => {
    if (typeof label === 'string') {
      const match = label.match(/(\d{4})\s*-\s*(\d{4})/);
      if (match) {
        const start = Number(match[2]);
        if (Number.isFinite(start)) {
          return `${start}-${start + 1}`;
        }
      }
    }
    const today = new Date();
    const startYear = today.getMonth() >= 7 ? today.getFullYear() + 1 : today.getFullYear();
    return `${startYear}-${startYear + 1}`;
  };

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

  const archiveTasksForYear = async (academicYear) => {
    if (!user || !academicYear) return;
    try {
      const ref = collection(db, 'artifacts', appId, 'users', user.uid, 'tasks');
      const q = query(ref, where('academicYear', '==', academicYear));
      const snap = await getDocs(q);
      await Promise.all(
        snap.docs.map((docSnap) =>
          updateDoc(docSnap.ref, { archivedAt: serverTimestamp() })
        )
      );
    } catch (err) {
      console.error('Failed to archive tasks during rollover', err);
      throw err;
    }
  };

  const handleStartRollover = () => {
    setNextAcademicYear(deriveNextAcademicYear(formState.currentAcademicYear));
    setRolloverStatus('');
    setShowRolloverModal(true);
  };

  const handleConfirmRollover = async () => {
    if (!nextAcademicYear) return;
    setRollingOver(true);
    setRolloverStatus('');
    const previousYear = settings?.currentAcademicYear || formState.currentAcademicYear;
    try {
      if (previousYear) {
        await archiveTasksForYear(previousYear);
      }
      await saveSettings({
        currentAcademicYear: nextAcademicYear,
        budgetResetDate: formState.budgetResetDate,
        termDates: formState.termDates,
        budgetSpent: 0,
      });
      setFormState((prev) => ({ ...prev, currentAcademicYear: nextAcademicYear }));
      setRolloverStatus('New academic year started and budget reset to 0.');
      setShowRolloverModal(false);
    } catch (err) {
      console.error(err);
      setRolloverStatus(err.message || 'Unable to start the new academic year.');
    } finally {
      setRollingOver(false);
    }
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

  const sanitizeEvents = (rawEvents = []) =>
    rawEvents
      .map((evt, idx) => {
        const date = formatDateInput(evt.date || evt.day || evt.startDate || evt.start);
        if (!date) return null;
        const category = normalizeCalendarCategory(evt.category || evt.type || '');
        return {
          title: evt.title || `Event ${idx + 1}`,
          category,
          date,
        };
      })
      .filter(Boolean);

  const handleImportCalendar = async () => {
    if (!calendarText.trim()) return;
    if (!user) {
      setCalendarStatus('Sign in to import the calendar');
      return;
    }
    setImportingCalendar(true);
    setCalendarStatus('');
    try {
      const parsed = await parseSchoolCalendar(calendarText.trim());
      const cleaned = sanitizeEvents(Array.isArray(parsed) ? parsed : []);
      if (!cleaned.length) {
        throw new Error('No events detected. Try adding dates to your paste.');
      }
      await replaceEvents(cleaned);
      setCalendarStatus(`Imported ${cleaned.length} events`);
      setShowCalendarImport(false);
      setCalendarText('');
    } catch (err) {
      console.error(err);
      setCalendarStatus(err.message || 'Calendar import failed');
    } finally {
      setImportingCalendar(false);
    }
  };

  return (
    <>
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
          {rolloverStatus && (
            <span
              className={`text-sm font-semibold ${
                rolloverStatus.toLowerCase().includes('fail') ? 'text-rose-600' : 'text-emerald-600'
              }`}
            >
              {rolloverStatus}
            </span>
          )}
          {error && (
            <span className="text-sm text-rose-600 font-semibold">Error: {error}</span>
          )}
          <button
            type="button"
            onClick={handleStartRollover}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-rose-200 text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100"
          >
            <RotateCcw className="w-4 h-4" />
            Start New Academic Year
          </button>
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

          <div className="mt-6 border-t border-gray-100 pt-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                School Calendar Settings
              </span>
              <p className="text-xs text-gray-400">
                Import the published term calendar to fuel the Horizon and dashboard density.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {calendarStatus && (
                <span
                  className={`text-sm font-semibold ${
                    calendarStatus.toLowerCase().includes('import') ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {calendarStatus}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowCalendarImport((prev) => !prev);
                  setCalendarStatus('');
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-indigo-200 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
              >
                <Upload className="w-4 h-4" />
                Import School Calendar
              </button>
            </div>
          </div>

          {showCalendarImport && (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500 mt-1" />
                <textarea
                  value={calendarText}
                  onChange={(e) => setCalendarText(e.target.value)}
                  rows={4}
                  className="w-full border border-indigo-100 rounded-xl p-3 text-sm bg-white focus:ring-2 focus:ring-indigo-200 outline-none"
                  placeholder="Paste the raw calendar text or table here. The AI will categorise into Logistics, CPD/QA, Parents, Enrichment."
                />
              </div>
              <div className="flex items-center justify-between gap-3 text-[11px] text-gray-600 flex-wrap">
                <span>
                  Output shape: an array of objects with date, title, and category (Logistics / CPD & QA / Parents / Enrichment).
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCalendarImport(false);
                      setCalendarText('');
                    }}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleImportCalendar}
                    disabled={!calendarText.trim() || importingCalendar}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {importingCalendar ? 'Importing...' : 'Run Parser'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-52 overflow-y-auto custom-scrollbar">
            {calendarLoading && (
              <div className="border border-dashed border-gray-200 rounded-xl p-4 text-sm text-gray-500">
                Loading calendar events...
              </div>
            )}
            {!calendarLoading && calendarEvents.length === 0 && (
              <div className="border border-dashed border-gray-200 rounded-xl p-4 text-sm text-gray-500 col-span-full">
                No calendar events yet. Import your term dates to light up the horizon.
              </div>
            )}
            {calendarEvents.map((evt) => {
              const meta = getCalendarCategoryMeta(evt.category);
              const dateLabel = evt.date || (evt.dateObj ? formatDateInput(evt.dateObj) : '');
              return (
                <div
                  key={evt.id}
                  className="p-3 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-sm font-semibold text-gray-900 line-clamp-1">
                      {evt.title || 'Event'}
                    </div>
                    <div className="text-xs text-gray-500">{dateLabel || 'Date not set'}</div>
                  </div>
                  <span
                    className={`text-[11px] font-semibold px-2 py-1 rounded-full border whitespace-nowrap ${meta.badge}`}
                  >
                    {meta.label}
                  </span>
                </div>
              );
            })}
            </div>
          </div>
        </div>
      </div>

      {showRolloverModal && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowRolloverModal(false)}
        >
          <div
            className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl bg-rose-50 text-rose-700">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  Start New Academic Year
                </h3>
                <p className="text-sm text-slate-500">
                  This will archive current tasks and reset the budget spend tracker.
                </p>
              </div>
            </div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              New Academic Year Label
              <input
                type="text"
                value={nextAcademicYear}
                onChange={(e) => setNextAcademicYear(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
                placeholder="2025-2026"
              />
            </label>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-800 text-sm mb-4">
              All current-year tasks will be archived. Budget spent will reset to 0. You can still view prior data by switching the academic year filter in analytics.
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRolloverModal(false)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRollover}
                disabled={rollingOver || !nextAcademicYear}
                className="px-5 py-2 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 disabled:opacity-50"
              >
                {rollingOver ? 'Starting...' : 'Confirm Rollover'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
