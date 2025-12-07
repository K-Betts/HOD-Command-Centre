import React, { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { Zap, MessageCircle } from 'lucide-react';

export function ActionFab({
  label = 'Action',
  className,
  onQuickCapture,
  onAskOmni,
  ...props
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div ref={wrapperRef} className="fixed bottom-8 right-8 z-50">
      <button
        className={clsx(
          'w-16 h-16 rounded-full',
          'bg-indigo-600 text-white shadow-2xl shadow-indigo-300/60 backdrop-blur-lg',
          'flex items-center justify-center text-sm font-semibold tracking-tight',
          'ring-4 ring-indigo-500/25 hover:ring-indigo-500/40 hover:-translate-y-1 hover:bg-indigo-700 transition-all',
          className
        )}
        onClick={() => setOpen((s) => !s)}
        aria-haspopup="true"
        aria-expanded={open}
        {...props}
      >
        <span className="sr-only">{label}</span>
        <Zap size={24} strokeWidth={2.5} />
      </button>

      {open && (
        <div className="mb-3 flex flex-col items-end">
          <div className="bg-white rounded-xl shadow-lg py-2 px-1 w-48 mt-2">
            <button
              className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-md flex items-center gap-3"
              onClick={() => {
                setOpen(false);
                if (typeof onQuickCapture === 'function') onQuickCapture();
              }}
            >
              <Zap className="text-amber-500" size={18} />
              <div className="flex-1">
                <div className="text-sm font-semibold">⚡️ Quick Capture</div>
                <div className="text-xs text-slate-500">Open Brain Dump</div>
              </div>
            </button>

            <button
              className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-md flex items-center gap-3 mt-1"
              onClick={() => {
                setOpen(false);
                if (typeof onAskOmni === 'function') onAskOmni();
              }}
            >
              <MessageCircle className="text-emerald-500" size={18} />
              <div className="flex-1">
                <div className="text-sm font-semibold">💬 Ask Orbit</div>
                <div className="text-xs text-slate-500">Context-aware Chief of Staff</div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
