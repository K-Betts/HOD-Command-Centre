import React from 'react';
import clsx from 'clsx';

const toneStyles = {
  challenge: 'bg-rose-50 text-rose-700 border-rose-200',
  support: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  strategy: 'bg-sky-50 text-sky-700 border-sky-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
};

export function StatusBadge({ tone = 'neutral', label, className, children, ...props }) {
  const badgeTone = toneStyles[tone] || toneStyles.neutral;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border',
        badgeTone,
        className
      )}
      {...props}
    >
      {label || children}
    </span>
  );
}
