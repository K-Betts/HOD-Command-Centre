import React from 'react';
import { Modal } from './Modal';

export default function ICSPreviewModal({ isOpen, events = [], onConfirm, onClose }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="w-[720px] max-w-full bg-white rounded-2xl p-6">
        <h3 className="text-lg font-bold mb-3">Import Preview</h3>
        <p className="text-sm text-slate-500 mb-4">Review the events parsed from the ICS file. Confirm to import into this staff member's timetable.</p>
        <div className="max-h-72 overflow-y-auto space-y-3 mb-4">
          {events.length === 0 && <div className="text-sm text-slate-400">No events to import.</div>}
          {events.map((e, i) => (
            <div key={i} className="p-3 rounded-xl border border-slate-100 bg-slate-50">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-slate-800">{e.title || 'Untitled'}</div>
                  <div className="text-sm text-slate-600">{e.description}</div>
                  <div className="text-xs text-slate-500 mt-1">{e.location}</div>
                </div>
                <div className="text-right text-sm text-slate-600">
                  <div>{e.startTime ? new Date(e.startTime).toLocaleString() : ''}</div>
                  <div className="text-xs text-slate-500">— {e.endTime ? new Date(e.endTime).toLocaleString() : ''}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-xl bg-indigo-600 text-white">Import {events.length ? `(${events.length})` : ''}</button>
        </div>
      </div>
    </Modal>
  );
}
