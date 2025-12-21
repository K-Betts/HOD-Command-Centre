import React, { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import { Zap, MessageCircle, MessageSquare } from 'lucide-react';

export function ActionFab({
  label = 'Action',
  className,
  onQuickCapture,
  onAskOmni,
  onFeedback,
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
      {/* Fan menu items - positioned directly above FAB */}
      {open && (
        <>
          {/* Feedback - closest */}
          <button
            className="absolute bottom-20 right-0 h-12 px-4 rounded-full bg-white text-slate-700 shadow-lg hover:scale-105 hover:shadow-xl transition-all flex items-center justify-center gap-2 font-medium text-sm"
            style={{
              animation: 'fadeIn 0.2s ease-out',
            }}
            onClick={() => {
              setOpen(false);
              onFeedback();
            }}
            aria-label="Share feedback or report an issue"
          >
            <span>Feedback</span>
            <MessageSquare className="text-blue-500" size={20} />
          </button>

          {/* Ask Orbit - middle */}
          <button
            className="absolute bottom-36 right-0 h-12 px-4 rounded-full bg-white text-slate-700 shadow-lg hover:scale-105 hover:shadow-xl transition-all flex items-center justify-center gap-2 font-medium text-sm"
            style={{
              animation: 'fadeIn 0.25s ease-out',
            }}
            onClick={() => {
              setOpen(false);
              onAskOmni();
            }}
            aria-label="Ask Orbit an AI question"
          >
            <span>Ask Orbit</span>
            <MessageCircle className="text-emerald-500" size={20} />
          </button>

          {/* Quick Capture - farthest */}
          <button
            className="absolute bottom-52 right-0 h-12 px-4 rounded-full bg-white text-slate-700 shadow-lg hover:scale-105 hover:shadow-xl transition-all flex items-center justify-center gap-2 font-medium text-sm"
            style={{
              animation: 'fadeIn 0.3s ease-out',
            }}
            onClick={() => {
              setOpen(false);
              onQuickCapture();
            }}
            aria-label="Quick capture a note or task"
          >
            <span>Quick Capture</span>
            <Zap className="text-amber-500" size={20} />
          </button>
        </>
      )}

      {/* Main FAB button */}
      <button
        className={clsx(
          'w-16 h-16 rounded-full',
          'bg-indigo-600 text-white shadow-2xl shadow-indigo-300/60 backdrop-blur-lg',
          'flex items-center justify-center text-sm font-semibold tracking-tight',
          'ring-4 ring-indigo-500/25 hover:ring-indigo-500/40 hover:-translate-y-1 hover:bg-indigo-700 transition-all',
          'relative z-10',
          className
        )}
        onClick={() => setOpen((s) => !s)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={open ? 'Close action menu' : 'Open action menu (Quick Capture, Ask AI, Feedback)'}
        {...props}
      >
        <span className="sr-only">{label}</span>
        <Zap 
          size={24} 
          strokeWidth={2.5} 
          className={clsx(
            'transition-transform duration-300 ease-out',
            open && 'rotate-90'
          )}
        />
      </button>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
