import React from 'react';
import clsx from 'clsx';

export function AppShell({ sidebar, header, children, className }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-28 w-80 h-80 bg-sky-100 rounded-full blur-3xl opacity-60" />
        <div className="absolute top-24 right-[-120px] w-96 h-96 bg-emerald-100 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-[-160px] left-1/3 w-96 h-96 bg-indigo-100 rounded-full blur-3xl opacity-40" />
        <div className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-white via-white/40 to-transparent" />
      </div>

      <div
        className={clsx(
          'relative flex min-h-screen',
          'backdrop-blur-md',
          className
        )}
      >
        {sidebar}
        <div className="flex-1 flex flex-col bg-white/70 backdrop-blur-xl border-l border-white/60 shadow-inner shadow-slate-200/40">
          {header && (
            <div className="sticky top-0 z-30 border-b border-white/60 bg-white/80 backdrop-blur-xl shadow-sm">
              {header}
            </div>
          )}
          <main className="flex-1 overflow-y-auto px-8 py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
