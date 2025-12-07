import React, { useEffect, useMemo, useState, useRef } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { format, differenceInCalendarWeeks, addWeeks } from 'date-fns';
import { Calendar, Loader2, Save, Download, Sparkles, RefreshCw } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { db } from '../../services/firebase';
import { appId } from '../../config/appConfig';
import { useAcademicYear } from '../../context/AcademicYearContext';
import { useToast } from '../../context/ToastContext';
import { BrainCard } from '../../components/ui/BrainCard';
import { useDepartmentCalendarData } from '../../hooks/useDepartmentCalendarData';

const COLUMN_KEYS = ['keyEvents', 'assessments', 'deadlines', 'cpdFocus', 'qaFocus', 'deptTime'];
const COLUMN_LABELS = ['Key Events', 'Assessments', 'Deadlines', 'CPD Focus', 'QA Focus', 'Dept Time'];

function getTermLabel(termIndex) {
  const labels = ['Autumn 1', 'Autumn 2', 'Spring 1', 'Spring 2', 'Summer 1', 'Summer 2'];
  return labels[termIndex] || `Term ${termIndex + 1}`;
}

function calculateWeeks(termStart, termEnd) {
  if (!termStart || !termEnd) return [];
  const weeksCount = Math.max(1, differenceInCalendarWeeks(termEnd, termStart) + 1);
  const weeks = [];
  for (let i = 0; i < weeksCount; i++) {
    const weekStart = addWeeks(termStart, i);
    weeks.push({
      index: i + 1,
      start: weekStart,
      end: addWeeks(weekStart, 1),
    });
  }
  return weeks;
}

export function DepartmentCalendar({ user }) {
  const { currentAcademicYear, terms } = useAcademicYear();
  const { addToast } = useToast();
  const [departmentPlan, setDepartmentPlan] = useState({});
  const [saving, setSaving] = useState(false);
  const [selectedTermIndex, setSelectedTermIndex] = useState(0);
  const [autoFilling, setAutoFilling] = useState(false);
  const tableRef = useRef(null);

  // Calculate selected term and weeks
  const selectedTerm = useMemo(() => {
    if (!terms || terms.length === 0) return null;
    return terms[selectedTermIndex];
  }, [terms, selectedTermIndex]);

  const weeks = useMemo(() => {
    if (!selectedTerm?.start || !selectedTerm?.end) return [];
    return calculateWeeks(selectedTerm.start, selectedTerm.end);
  }, [selectedTerm]);

  const docKey = useMemo(() => {
    if (!currentAcademicYear || !selectedTerm) return null;
    const termLabel = getTermLabel(selectedTermIndex);
    return `${currentAcademicYear}_${termLabel}`;
  }, [currentAcademicYear, selectedTermIndex, selectedTerm]);

  // Get aggregated data from all sources
  const weeklyData = useDepartmentCalendarData(user, selectedTerm, currentAcademicYear);

  // Load department plan from Firestore
  useEffect(() => {
    if (!user || !docKey) return undefined;

    const ref = doc(
      db,
      'artifacts',
      appId,
      'users',
      user.uid,
      'strategy',
      'departmentPlan',
      'plans',
      docKey
    );

    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        if (snapshot.exists()) {
          setDepartmentPlan(snapshot.data());
        } else {
          setDepartmentPlan({});
        }
      },
      (err) => {
        console.error('Failed to load department plan:', err);
      }
    );

    return unsubscribe;
  }, [user, docKey]);

  const handleCellChange = (weekIndex, columnKey, value) => {
    setDepartmentPlan((prev) => {
      const weekKey = `week_${weekIndex}`;
      return {
        ...prev,
        [weekKey]: {
          ...(prev[weekKey] || {}),
          [columnKey]: value,
        },
      };
    });
  };

  const handleSave = async () => {
    if (!user || !docKey) {
      addToast('error', 'Academic year or term not set.');
      return;
    }

    setSaving(true);
    try {
      const ref = doc(
        db,
        'artifacts',
        appId,
        'users',
        user.uid,
        'strategy',
        'departmentPlan',
        'plans',
        docKey
      );

      await setDoc(ref, departmentPlan, { merge: true });
      addToast('success', `Department plan saved for ${getTermLabel(selectedTermIndex)}`);
    } catch (err) {
      console.error('Failed to save department plan:', err);
      addToast('error', 'Failed to save department plan.');
    } finally {
      setSaving(false);
    }
  };

  const handleAutoFill = () => {
    setAutoFilling(true);
    try {
      const updatedPlan = { ...departmentPlan };
      
      weeks.forEach((week) => {
        const weekData = weeklyData.find(w => w.weekNumber === week.index);
        if (weekData) {
          const weekKey = `week_${week.index}`;
          updatedPlan[weekKey] = {
            ...(updatedPlan[weekKey] || {}),
            ...weekData.autoFilledData,
          };
        }
      });

      setDepartmentPlan(updatedPlan);
      addToast('success', 'Calendar auto-filled with data from tasks, events, and priorities!');
    } catch (err) {
      console.error('Auto-fill failed:', err);
      addToast('error', 'Failed to auto-fill calendar.');
    } finally {
      setAutoFilling(false);
    }
  };

  const handleExportPDF = async () => {
    if (!tableRef.current) return;

    try {
      setSaving(true);
      const canvas = await html2canvas(tableRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 10;

      // Add title
      pdf.setFontSize(16);
      pdf.text(`Department Plan - ${getTermLabel(selectedTermIndex)}`, 10, 8);
      pdf.setFontSize(10);
      pdf.text(
        `${currentAcademicYear} | ${format(selectedTerm.start, 'MMM d, yyyy')} - ${format(selectedTerm.end, 'MMM d, yyyy')}`,
        10,
        15
      );

      position = 25;

      // Add image
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - 35;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight - 20;
      }

      pdf.save(`Department_Plan_${getTermLabel(selectedTermIndex)}_${currentAcademicYear}.pdf`);
      addToast('success', 'PDF downloaded successfully!');
    } catch (err) {
      console.error('PDF export failed:', err);
      addToast('error', 'Failed to export PDF.');
    } finally {
      setSaving(false);
    }
  };

  if (!selectedTerm) {
    return (
      <BrainCard className="p-6 text-center">
        <p className="text-slate-600">No term data available. Please set up your academic year.</p>
      </BrainCard>
    );
  }

  return (
    <div className="space-y-3 h-full flex flex-col">
      <BrainCard className="p-4 flex-1 flex flex-col overflow-hidden">
        {/* Header and Controls */}
        <div className="mb-3">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-indigo-600" />
              <span className="text-lg font-bold text-slate-900">Department Matrix</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAutoFill}
                disabled={autoFilling || saving}
                title="Auto-fill from tasks, events, and priorities"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold shadow-sm hover:bg-emerald-700 disabled:opacity-60 whitespace-nowrap"
              >
                {autoFilling ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                <span className="hidden sm:inline">Auto-Fill</span>
              </button>
              <button
                onClick={handleExportPDF}
                disabled={saving}
                title="Export to PDF"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold shadow-sm hover:bg-blue-700 disabled:opacity-60 whitespace-nowrap"
              >
                {saving ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                <span className="hidden sm:inline">PDF</span>
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                title="Save changes"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold shadow-sm hover:bg-indigo-700 disabled:opacity-60 whitespace-nowrap"
              >
                {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                <span className="hidden sm:inline">Save</span>
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-500 mb-2">
            Auto-fill pulls tasks, events, and priorities. Edit any cell, then save.
          </p>

          {/* Term Selection */}
          <div className="flex flex-wrap gap-1.5">
            {terms.map((term, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedTermIndex(idx)}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  selectedTermIndex === idx
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {getTermLabel(idx)}
              </button>
            ))}
          </div>
        </div>

        {/* Department Matrix Grid */}
        <div className="flex-1 overflow-auto border border-slate-200 rounded-xl flex flex-col" ref={tableRef}>
          <table className="w-full text-xs bg-white border-collapse">
            <thead className="sticky top-0 z-20">
              <tr className="bg-gradient-to-r from-indigo-100 to-slate-100 border-b border-slate-300">
                <th className="sticky left-0 z-20 bg-indigo-100 px-3 py-2 text-left font-bold text-slate-900 min-w-[90px]">
                  Week
                </th>
                {COLUMN_LABELS.map((label) => (
                  <th
                    key={label}
                    className="px-2 py-2 text-left font-bold text-slate-700 whitespace-nowrap min-w-[130px]"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {weeks.length === 0 ? (
                <tr>
                  <td colSpan={COLUMN_LABELS.length + 1} className="px-4 py-8 text-center text-slate-400">
                    No weeks available for this term.
                  </td>
                </tr>
              ) : (
                weeks.map((week) => {
                  const weekKey = `week_${week.index}`;
                  const weekData = departmentPlan[weekKey] || {};
                  return (
                    <tr key={weekKey} className="hover:bg-blue-50/30">
                      <td className="sticky left-0 z-10 bg-slate-50 px-3 py-2 font-semibold text-slate-900 border-r border-slate-200">
                        <div className="flex flex-col">
                          <span className="text-xs">W{week.index}</span>
                          <span className="text-[10px] text-slate-500 leading-tight">
                            {format(week.start, 'MMM d')}
                          </span>
                        </div>
                      </td>
                      {COLUMN_KEYS.map((colKey) => (
                        <td key={colKey} className="px-2 py-1.5 align-top">
                          <textarea
                            value={weekData[colKey] || ''}
                            onChange={(e) => handleCellChange(week.index, colKey, e.target.value)}
                            placeholder="+"
                            rows={2}
                            className="w-full p-1.5 border border-slate-200 rounded text-xs leading-tight focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 outline-none resize-none bg-white hover:bg-blue-50"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </BrainCard>
    </div>
  );
}
