import React from 'react';

export function StatPill({ label, value, tone = 'slate' }) {
  const toneClass = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    sky: 'bg-sky-50 text-sky-700 border-sky-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-100',
  }[tone];
  return (
    <div className={`px-4 py-2 rounded-full border text-sm font-bold ${toneClass}`}>
      {label}: {value}
    </div>
  );
}

export function Badge({ children, tone = 'slate' }) {
  const toneClass = {
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    sky: 'bg-sky-100 text-sky-700 border-sky-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold border ${toneClass}`}
    >
      {children}
    </span>
  );
}
