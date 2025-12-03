import React from 'react';
import clsx from 'clsx';

export function BrainCard({ children, className, ...props }) {
  return (
    <div
      className={clsx(
        'bg-white rounded-2xl shadow-sm hover:shadow-md transition-all border border-slate-100',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
