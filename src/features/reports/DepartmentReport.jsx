import React, { useMemo } from 'react';
import { FileText, Printer, Target, PiggyBank } from 'lucide-react';
import { useSchoolYearSettings } from '../../hooks/useSchoolYearSettings';
import { useStrategy } from '../../hooks/useStrategy';
import { useBudget } from '../../hooks/useBudget';
import { useBudgetSettings } from '../../hooks/useBudgetSettings';
import { useContextData } from '../../hooks/useContextData';

const formatMoney = (value, currency) => {
  if (!Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency || 'AED',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency || ''} ${Math.round(value).toLocaleString()}`.trim();
  }
};

const getExpenseValue = (expense = {}) => {
  if (expense.finalAmountAED !== undefined && expense.finalAmountAED !== null) {
    const val = Number(expense.finalAmountAED);
    if (!Number.isNaN(val)) return val;
  }
  const rate = Number(expense.exchangeRateUsed) || 1;
  const raw =
    Number(expense.originalAmount) ||
    Number(expense.amount) ||
    Number(expense.value) ||
    0;
  return raw * rate;
};

export function DepartmentReport({ user }) {
  const { settings } = useSchoolYearSettings(user);
  const { plan } = useStrategy(user);
  const { expenses } = useBudget(user);
  const { settings: budgetSettings } = useBudgetSettings(user);
  const { context } = useContextData(user);

  const header = {
    schoolName: context?.schoolName || 'School Name',
    departmentName: context?.departmentName || 'Department',
    academicYear: settings?.currentAcademicYear || 'Academic Year',
  };

  const sipRows = useMemo(() => {
    return (plan?.priorities || []).map((p, idx) => ({
      id: p.id || `priority-${idx}`,
      priority: p.priorityName || p.priorityId || p.vision || `Priority ${idx + 1}`,
      objective: p.objective || p.action || p.vision || 'Objective not set',
      rag: p.rag || 'Amber',
    }));
  }, [plan?.priorities]);

  const budgetSummary = useMemo(() => {
    const currency =
      budgetSettings?.currency ||
      (budgetSettings?.totalBudgetAED ? 'AED' : budgetSettings?.currency) ||
      'AED';
    const total =
      Number(budgetSettings?.totalBudgetAED ?? budgetSettings?.totalBudget ?? 0) || 0;
    const spent = (expenses || []).reduce((sum, ex) => sum + getExpenseValue(ex), 0);
    const remaining = total - spent;
    return { currency, total, spent, remaining };
  }, [budgetSettings, expenses]);

  return (
    <div className="space-y-6 department-report">
      <div className="flex items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-300/60">
            <FileText size={20} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
              Formal Report
            </p>
            <h2 className="text-2xl font-bold text-slate-900">Board / Governors Pack</h2>
            <p className="text-sm text-slate-500">
              Clean, print-friendly briefing for SLT and link governors.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow-sm hover:bg-indigo-700"
        >
          <Printer size={16} />
          Print Report
        </button>
      </div>

      <div className="report-card rounded-3xl bg-white border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              School
            </p>
            <h3 className="text-xl font-bold text-slate-900">{header.schoolName}</h3>
            <p className="text-sm text-slate-600">{header.departmentName}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Academic Year
            </p>
            <div className="text-lg font-bold text-slate-900">{header.academicYear}</div>
            <p className="text-xs text-slate-500">Auto-updates from settings</p>
          </div>
        </div>
      </div>

      <div className="report-card report-section page-break rounded-3xl bg-white border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Target className="text-emerald-600" size={18} />
            <h3 className="text-lg font-bold text-slate-900">SIP Priorities</h3>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {sipRows.length} priorities
          </span>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[11px]">
              <tr>
                <th className="text-left px-4 py-3 font-semibold tracking-wide">Priority</th>
                <th className="text-left px-4 py-3 font-semibold tracking-wide">Objective</th>
                <th className="text-left px-4 py-3 font-semibold tracking-wide">RAG</th>
              </tr>
            </thead>
            <tbody>
              {sipRows.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                    No priorities captured yet.
                  </td>
                </tr>
              )}
              {sipRows.map((row, idx) => (
                <tr
                  key={row.id}
                  className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}
                >
                  <td className="px-4 py-3 font-semibold text-slate-900">{row.priority}</td>
                  <td className="px-4 py-3 text-slate-700">{row.objective}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full border text-[11px] font-bold ${
                        row.rag === 'Green'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : row.rag === 'Red'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {row.rag}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="report-card report-section rounded-3xl bg-white border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <PiggyBank className="text-indigo-600" size={18} />
            <h3 className="text-lg font-bold text-slate-900">Budget Summary</h3>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {budgetSummary.currency} view
          </span>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 uppercase text-[11px]">
              <tr>
                <th className="text-left px-4 py-3 font-semibold tracking-wide">Total</th>
                <th className="text-left px-4 py-3 font-semibold tracking-wide">Spent</th>
                <th className="text-left px-4 py-3 font-semibold tracking-wide">Remaining</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-4 py-3 font-semibold text-slate-900">
                  {formatMoney(budgetSummary.total, budgetSummary.currency)}
                </td>
                <td className="px-4 py-3 text-slate-900">
                  {formatMoney(budgetSummary.spent, budgetSummary.currency)}
                </td>
                <td
                  className={`px-4 py-3 font-semibold ${
                    budgetSummary.remaining < 0 ? 'text-rose-700' : 'text-emerald-700'
                  }`}
                >
                  {formatMoney(Math.max(budgetSummary.remaining, 0), budgetSummary.currency)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-500 mt-3">
          Spent amount pulls from this year&apos;s expense log; remaining auto-calculates.
        </p>
      </div>

      <style>
        {`
        @media print {
          body, #root {
            background: #ffffff !important;
            color: #000000 !important;
          }
          aside, nav, .no-print, .ActionFab, button {
            display: none !important;
          }
          .department-report button {
            display: none !important;
          }
          .report-card {
            box-shadow: none !important;
            border: 1px solid #000 !important;
            background: #ffffff !important;
          }
          .report-section {
            page-break-inside: avoid;
          }
          .page-break {
            page-break-after: always;
          }
          .page-break:last-child {
            page-break-after: auto;
          }
        }
        `}
      </style>
    </div>
  );
}
