import React from 'react';

const join = (...classes) => classes.filter(Boolean).join(' ');

/**
 * Strategy-style tab bar used across modules.
 * - Matches Strategy page look: subtle container, rounded pills, compact height.
 * - Optional icon per tab.
 */
export function TabBar({ tabs = [], activeId, onChange, className, wrapClassName }) {
  return (
    <div
      className={join(
        'bg-white border border-slate-200 rounded-3xl shadow-sm p-2 flex items-center gap-2 flex-wrap',
        wrapClassName
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange?.(tab.id)}
            className={join(
              'px-4 py-2 rounded-2xl text-sm font-semibold flex items-center gap-2 transition-all',
              isActive ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:text-slate-900',
              className
            )}
          >
            {Icon && <Icon size={16} className="flex-shrink-0" />}
            <span className="truncate">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
