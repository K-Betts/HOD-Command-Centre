import React from 'react';
import clsx from 'clsx';
import { Plus } from 'lucide-react';

export function ActionFab({
  label = 'Quick Capture',
  icon: Icon = Plus,
  className,
  ...props
}) {
  return (
    <button
      className={clsx(
        'fixed bottom-8 right-8 z-50 w-16 h-16 rounded-full',
        'bg-indigo-600 text-white shadow-2xl shadow-indigo-300/60 backdrop-blur-lg',
        'flex items-center justify-center text-sm font-semibold tracking-tight',
        'ring-4 ring-indigo-500/20 hover:ring-indigo-500/30 hover:-translate-y-1 transition-all',
        className
      )}
      {...props}
    >
      <span className="sr-only">{label}</span>
      <Icon size={24} strokeWidth={2.5} />
    </button>
  );
}
