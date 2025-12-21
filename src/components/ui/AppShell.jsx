import React from 'react';

export function AppShell({ sidebar, header, children, className }) {
  return (
    <div className={['h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 relative flex flex-col lg:flex-row', className].filter(Boolean).join(' ')}>
      {/* Sidebar - Hidden on mobile, visible on lg+ screens */}
      <div className="hidden lg:flex lg:w-64 h-full lg:flex-shrink-0 border-r border-slate-200 bg-white overflow-y-auto">
        {sidebar}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 h-full flex flex-col">
        {header && (
          <div className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm">
            {header}
          </div>
        )}
        <main className="flex-1 overflow-y-auto relative bg-slate-50">
          <div className="px-4 md:px-8 py-6 max-w-[1600px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
