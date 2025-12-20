import React, { useRef } from 'react';
import { Sparkles } from 'lucide-react';

export function ImportMinutesModal({ isOpen, onClose, text, onChange, onSubmit, loading, preview }) {
  const textareaRef = useRef(null);

  if (!isOpen) return null;

  const actionsPreview = (preview?.actions || []).slice(0, 3);

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 border-b border-slate-200 p-6 flex items-start justify-between">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2">
              <Sparkles size={14} className="text-emerald-500" /> Import meeting minutes
            </div>
            <div className="text-lg font-bold text-slate-900">Paste raw minutes to ingest</div>
            <p className="text-sm text-slate-500">
              We&apos;ll extract the meeting date, attendees, agenda items, and action points.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 flex-shrink-0"
            aria-label="Close import modal"
          >
            X
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            className="w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none h-[200px]"
            placeholder="Paste the rough minutes here..."
          />

          {preview && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase">
                <Sparkles size={14} />
                Draft detected
              </div>
              <div className="text-sm text-emerald-800 mt-1">
                {preview.meetingDate ? `Date: ${preview.meetingDate}` : 'Date not detected yet'}
              </div>
              {preview.attendees?.length > 0 && (
                <div className="text-[11px] text-emerald-800 mt-1">
                  Attendees: {preview.attendees.slice(0, 5).join(', ')}
                  {preview.attendees.length > 5 && ' +'}
                </div>
              )}
              {actionsPreview.length > 0 && (
                <div className="mt-2 space-y-1">
                  {actionsPreview.map((action, idx) => (
                    <div key={action.id || idx} className="text-xs text-emerald-900">
                      • {action.title || 'Action'}{' '}
                      {action.owner ? <span className="text-emerald-700">({action.owner})</span> : ''}
                    </div>
                  ))}
                  {preview.actions?.length > actionsPreview.length && (
                    <div className="text-[11px] text-emerald-700">
                      +{preview.actions.length - actionsPreview.length} more action
                      {preview.actions.length - actionsPreview.length === 1 ? '' : 's'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 border-t border-slate-200 p-4 bg-white flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-70"
          >
            {loading ? 'Parsing...' : 'Run AI import'}
          </button>
        </div>
      </div>
    </div>
  );
}
