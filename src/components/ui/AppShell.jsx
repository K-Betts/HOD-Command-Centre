import React from 'react';

export function AppShell({ sidebar, header, children, className }) {
  return (
    <div className={['h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 relative flex', className].filter(Boolean).join(' ')}>
      {/* Sidebar - Fixed */}
      <div className="w-64 h-full flex-shrink-0 border-r border-slate-200 bg-white overflow-y-auto">
        {sidebar}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 h-full flex flex-col">
        {header && (
          <div className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm">
            {header}
          </div>
        )}
        <main className="flex-1 overflow-y-auto relative p-6 bg-slate-50">
          <div className="max-w-[1600px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
