import React, { useEffect, useState } from 'react';
import { DollarSign, ArrowRightLeft, Download, BarChart, Pencil, Trash2 } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useBudget } from '../../hooks/useBudget';
import { useBudgetSettings } from '../../hooks/useBudgetSettings';
import { auditBudget } from '../../services/ai';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

async function fetchExchangeRate(fromCurrency) {
  if (!fromCurrency || fromCurrency === 'AED') return { rate: 1, isFallback: false };
  try {
    const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${fromCurrency}`);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data = await response.json();
    return { rate: data.rates.AED || 1, isFallback: false };
  } catch (error) {
    console.error('Failed to fetch exchange rate:', error);
    // Fallback for API failure
    const FALLBACK_RATES_TO_AED = { USD: 3.67, GBP: 4.6, EUR: 4.0, AUD: 2.4, CAD: 2.7, INR: 0.044 };
    return { rate: FALLBACK_RATES_TO_AED[fromCurrency] || 1, isFallback: true };
  }
}

const getAcademicYear = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-indexed (0 for Jan, 7 for Aug)
  return month >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const initialExpenseState = {
  item: '',
  originalAmount: '',
  originalCurrency: 'GBP',
  exchangeRateUsed: 1,
  finalAmountAED: '',
  date: getTodayDateString(),
  category: '',
  notes: '',
  isLocked: false,
};

export function BudgetView({ user }) {
  const { expenses, addExpense, deleteExpense, updateExpense } = useBudget(user);
  const { settings, updateSettings } = useBudgetSettings(user);

  const [totalBudgetAED, setTotalBudgetAED] = useState(0);
  const [savingBudget, setSavingBudget] = useState(false);
  const [auditSummary, setAuditSummary] = useState('');
  const [editingExpense, setEditingExpense] = useState(null); // State to hold the expense being edited
  const [selectedYear, setSelectedYear] = useState(getAcademicYear(new Date()));

  const [newExpense, setNewExpense] = useState(initialExpenseState);
  const [isConverting, setIsConverting] = useState(false);
  const [usingFallbackRate, setUsingFallbackRate] = useState(false);
  const [isLocked, setIsLocked] = useState(initialExpenseState.isLocked);

  const currencies = ['AED', 'GBP', 'USD', 'EUR', 'AUD', 'CAD', 'INR'];

  useEffect(() => {
    const initial =
      (settings && (settings.totalBudgetAED ?? settings.totalBudget)) || 18000;
    setTotalBudgetAED(initial);
  }, [settings]);

  const handleSaveBudget = async () => {
    setSavingBudget(true);
    try {
      await updateSettings({
        totalBudgetAED: Number(totalBudgetAED) || 0,
      });
    } finally {
      setSavingBudget(false);
    }
  };

  useEffect(() => {
    const handleAutoConvert = async () => {
      if (isLocked) return;
      if (!newExpense.originalAmount || !newExpense.originalCurrency) return;
      setIsConverting(true);
      try {
        const { rate, isFallback } = await fetchExchangeRate(newExpense.originalCurrency);
        const aed = Number(newExpense.originalAmount || 0) * rate;
        setUsingFallbackRate(isFallback);
        setNewExpense((prev) => ({
          ...prev,
          exchangeRateUsed: rate,
          finalAmountAED: aed.toFixed(2),
        }));
      } finally {
        setIsConverting(false);
      }
    };
    handleAutoConvert();
  }, [newExpense.originalCurrency, newExpense.originalAmount, isLocked]);

  // When editingExpense changes, populate the form
  useEffect(() => {
    if (editingExpense) {
      setNewExpense({
        item: editingExpense.item || '',
        originalAmount: editingExpense.originalAmount || '',
        originalCurrency: editingExpense.originalCurrency || 'GBP',
        exchangeRateUsed: editingExpense.exchangeRateUsed || 1,
        finalAmountAED: editingExpense.finalAmountAED || '',
        date: editingExpense.date || '',
        category: editingExpense.category || '',
        notes: editingExpense.notes || '',
        isLocked: editingExpense.isLocked ?? editingExpense.lockedAed ?? true,
      });
      setIsLocked(editingExpense.isLocked ?? editingExpense.lockedAed ?? true);
      setUsingFallbackRate(Boolean(editingExpense.usingFallbackRate));
    }
  }, [editingExpense]);

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!newExpense.item || !newExpense.date) {
      alert('Please fill in at least the item/vendor and date.');
      return;
    }

    const rate = Number(newExpense.exchangeRateUsed) || 1;
    const finalAED =
      Number(newExpense.finalAmountAED) ||
      (Number(newExpense.originalAmount) || 0) * rate;

    const payload = {
      ...newExpense,
      originalAmount: Number(newExpense.originalAmount) || null,
      exchangeRateUsed: rate,
      finalAmountAED: finalAED,
      isLocked,
      lockedAed: isLocked,
      usingFallbackRate,
    };

    if (editingExpense) {
      await updateExpense(editingExpense.id, payload);
    } else {
      await addExpense(payload);
    }

    // Reset form and editing state
    setNewExpense(initialExpenseState);
    setIsLocked(initialExpenseState.isLocked);
    setEditingExpense(null);
  };

  const handleAudit = async () => {
    const summary = await auditBudget(filteredExpenses, totalBudgetAED, settings.currency);
    setAuditSummary(summary);
  };

  const academicYears = Array.from(new Set(expenses.map(e => getAcademicYear(e.date)))).sort().reverse();
  if (!academicYears.includes(selectedYear)) {
    academicYears.unshift(selectedYear);
  }

  const filteredExpenses = filterByYearMode(expenses, selectedYear);

  const totalSpentAED = filteredExpenses.reduce((sum, e) => sum + getFinalAED(e), 0);
  const remaining = (Number(totalBudgetAED) || 0) - totalSpentAED;

  const spendByCategory = filteredExpenses.reduce((acc, e) => {
    const cat = e.category || 'Uncategorised';
    const amount = getFinalAED(e);
    if (!acc[cat]) {
      acc[cat] = { name: cat, value: 0 };
    }
    acc[cat].value += amount;
    return acc;
  }, {});
  const categoryChartData = Object.values(spendByCategory);

  const downloadCSV = () => {
    const headers = ['Date', 'Vendor', 'Category', 'Original Amount', 'Currency', 'Rate Used', 'AED Amount', 'Notes'];
    const rows = filteredExpenses.map(ex => [
      ex.date,
      ex.item, // Vendor
      ex.category,
      ex.originalAmount,
      ex.originalCurrency,
      ex.exchangeRateUsed,
      getFinalAED(ex),
      ex.notes
    ].join(','));

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `budget_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCancelEdit = () => {
    setEditingExpense(null);
    setNewExpense(initialExpenseState);
    setIsLocked(initialExpenseState.isLocked);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 h-[calc(100vh-140px)]">
      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-200 p-6 sm:p-8 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
            <DollarSign size={24} />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-xl">Annual Budget</h3>
            <p className="text-gray-400 text-sm">Base currency: AED</p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
            Total Budget (AED)
          </label>
          <input
            type="number"
            min="0"
            value={totalBudgetAED}
            onChange={(e) => setTotalBudgetAED(e.target.value)}
            className="w-full p-4 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-indigo-100 outline-none text-lg font-bold"
          />
          <button
            onClick={handleSaveBudget}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-60"
            disabled={savingBudget}
          >
            {savingBudget ? 'Saving...' : 'Save Budget'}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-gray-500 uppercase">
            Academic Year
          </label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="flex-1 px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 text-gray-500"
          >
            {academicYears.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div className="text-gray-500 font-semibold">Spent</div>
            <div className="text-2xl font-black text-gray-800 mt-1">
              AED {totalSpentAED.toFixed(2)}
            </div>
          </div>
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
            <div className="text-emerald-600 font-semibold">Remaining</div>
            <div className="text-2xl font-black text-emerald-700 mt-1">
              AED {remaining.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleAudit}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 hover:border-indigo-200 hover:text-indigo-700 transition-colors"
          >
            <ArrowRightLeft size={18} /> Analyze Spend
          </button>
          <button
            onClick={downloadCSV}
            disabled={!filteredExpenses.length}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 hover:border-indigo-200 hover:text-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={18} /> Download CSV
          </button>
        </div>

        {auditSummary && (
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 text-sm text-gray-700">
            {auditSummary}
          </div>
        )}
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-200 p-6 sm:p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800 text-lg">
            {editingExpense ? 'Edit Transaction' : 'Log Expense / Transaction'}
          </h3>
          {editingExpense && (
            <button onClick={handleCancelEdit} className="text-sm font-bold text-gray-500 hover:text-gray-800">Cancel</button>
          )}
        </div>

        <form className="space-y-4" onSubmit={handleSaveExpense}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-wide">
                Vendor / Item
              </label>
              <input
                value={newExpense.item}
                onChange={(e) =>
                  setNewExpense((prev) => ({ ...prev, item: e.target.value }))
                }
                className="w-full p-3.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-gray-100 outline-none text-sm"
                placeholder="e.g. Textbooks"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-wide">
                Date
              </label>
              <input
                type="date"
                value={newExpense.date}
                onChange={(e) =>
                  setNewExpense((prev) => ({ ...prev, date: e.target.value }))
                }
                className="w-full p-3.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-gray-100 outline-none text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-wide">
                Original Amount
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newExpense.originalAmount}
                  onChange={(e) =>
                    setNewExpense((prev) => ({
                      ...prev,
                      originalAmount: e.target.value,
                    }))
                  }
                  className="flex-1 p-3.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-gray-100 outline-none text-sm"
                  placeholder="Amount"
                />
                <select
                  value={newExpense.originalCurrency}
                  onChange={(e) =>
                    setNewExpense((prev) => ({
                      ...prev,
                      originalCurrency: e.target.value,
                    }))
                  }
                  className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:ring-4 focus:ring-gray-100 outline-none"
                >
                  {currencies.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="sm:col-span-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Rate to AED
                </label>
                <div className="flex items-center gap-2">
                  {usingFallbackRate && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                      Fallback
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsLocked((prev) => !prev)}
                    className="text-[11px] font-semibold px-3 py-1 rounded-lg border border-gray-200 bg-white hover:border-indigo-200"
                  >
                    {isLocked ? 'Unlock Rate' : 'Lock Rate'}
                  </button>
                </div>
              </div>
              <input
                type="number"
                step="0.0001"
                min="0"
                value={newExpense.exchangeRateUsed}
                disabled={isLocked}
                onChange={(e) =>
                  setNewExpense((prev) => {
                    const rate = Number(e.target.value) || 0;
                    const shouldRecalc = !isLocked;
                    const final =
                      shouldRecalc && rate && newExpense.originalAmount
                        ? Number(newExpense.originalAmount) * rate
                        : prev.finalAmountAED;
                    return { ...prev, exchangeRateUsed: e.target.value, finalAmountAED: final };
                  })
                }
                className="w-full p-3.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-gray-100 outline-none text-sm"
                placeholder="e.g. 4.60"
              />
              <p className="text-[11px] text-gray-400 mt-1 whitespace-normal break-words leading-snug">
                {isLocked
                  ? 'AED amount locked; rate changes will not overwrite it.'
                  : isConverting
                  ? 'Fetching live rate…'
                  : usingFallbackRate
                  ? 'Using fallback rate (offline).'
                  : 'Live rate is fetched automatically.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-wide">
                Final Amount (AED)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={newExpense.finalAmountAED}
                onChange={(e) =>
                  setNewExpense((prev) => ({ ...prev, finalAmountAED: e.target.value }))
                }
                className="w-full p-3.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-gray-100 outline-none text-sm"
                placeholder="Auto or manual"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-wide">
                Category
              </label>
              <input
                value={newExpense.category}
                onChange={(e) =>
                  setNewExpense((prev) => ({ ...prev, category: e.target.value }))
                }
                className="w-full p-3.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-gray-100 outline-none text-sm"
                placeholder="e.g. Textbooks"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-wide">
              Notes (Optional)
            </label>
            <textarea
              value={newExpense.notes}
              onChange={(e) =>
                setNewExpense((prev) => ({ ...prev, notes: e.target.value }))
              }
              className="w-full p-3.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-4 focus:ring-gray-100 outline-none text-sm"
              placeholder="e.g. For Year 10 curriculum"
            />
          </div>

          <button
            className={`w-full py-3.5 text-white rounded-xl font-bold text-sm sm:text-base transition-all mt-2 ${editingExpense ? 'bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200' : 'bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-200'}`}
          >
            {editingExpense ? 'Update Transaction' : 'Log Transaction'}
          </button>
        </form>
      </div>

      <div className="xl:col-span-1 bg-white rounded-[2rem] shadow-sm border border-gray-200 p-6 sm:p-8 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 text-lg sm:text-xl">
            Recent Transactions
          </h3>
          <p className="text-xs text-gray-400">
            Showing {selectedYear} spend in <span className="font-semibold">AED</span>
          </p>
        </div>
        <div className="flex-1 overflow-y-auto rounded-2xl border border-gray-100">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-gray-50 text-gray-400 text-[11px] uppercase tracking-[0.15em] font-bold">
              <tr>
                <th className="p-3 sm:p-4 rounded-l-2xl">Item</th>
                <th className="p-3 sm:p-4 text-right hidden sm:table-cell">Original</th>
                <th className="p-3 sm:p-4 text-right">AED</th>
                <th className="p-3 sm:p-4 text-right rounded-r-2xl"></th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              {filteredExpenses.map((ex) => {
                const original =
                  ex.originalAmount != null && ex.originalCurrency
                    ? `${ex.originalCurrency} ${Number(ex.originalAmount).toFixed(2)}`
                    : ex.amount != null
                    ? `AED ${Number(ex.amount).toFixed(2)}`
                    : '-';

                const aedValue = getFinalAED(ex).toFixed(2);
                const tags = [];
                const lockedFlag = ex.isLocked ?? ex.lockedAed;
                if (lockedFlag) tags.push('Locked');
                if (ex.usingFallbackRate) tags.push('Fallback');

                return (
                  <tr
                    key={ex.id}
                    className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/60 transition-colors"
                  >
                    <td className="p-3 sm:p-4 align-middle">
                      <div className="font-semibold">{ex.item}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {ex.date || 'No date'}
                      </div>
                    </td>
                    <td className="p-3 sm:p-4 text-right text-gray-500 align-middle hidden sm:table-cell">
                      {original}
                    </td>
                    <td className="p-3 sm:p-4 text-right font-mono text-gray-800 align-middle">
                      <div className="flex flex-col items-end gap-1">
                        <div>AED {aedValue}</div>
                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 justify-end">
                            {tags.map((tag) => (
                              <span
                                key={`${ex.id}-${tag}`}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  tag === 'Fallback'
                                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                                    : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                }`}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3 sm:p-4 text-right align-middle flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setEditingExpense(ex)}
                        className="text-gray-400 hover:text-indigo-600"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteExpense(ex.id)}
                        className="text-gray-400 hover:text-rose-500"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!filteredExpenses.length && (
                <tr>
                  <td
                    colSpan="4"
                    className="p-8 text-center text-gray-400 italic text-sm"
                  >
                    No history yet – log your first transaction.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6">
          <h4 className="font-bold text-gray-800 text-sm mb-2 flex items-center gap-2">
            <BarChart size={16} /> Where is it going?
          </h4>
          <div className="h-64 w-full">
            {categoryChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `AED ${Number(value).toFixed(2)}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 italic">
                No data for chart.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getFinalAED(expense) {
  if (!expense) return 0;
  if (expense.finalAmountAED != null) return Number(expense.finalAmountAED) || 0;
  if (expense.aedAmount != null) return Number(expense.aedAmount) || 0;
  if (expense.amount != null) return Number(expense.amount) || 0;
  return 0;
}

function filterByYearMode(expenses, academicYear) {
  if (!Array.isArray(expenses)) return [];
  if (!academicYear) return [];

  return expenses.filter((e) => {
    if (!e.date) return false;
    return getAcademicYear(e.date) === academicYear;
  });
}
