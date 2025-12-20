import React, { useState } from 'react';
import { Zap, X } from 'lucide-react';
import { AppShell } from '../components/ui/AppShell';
import { ActionFab } from '../components/ui/ActionFab';
import { ChatInterface } from '../features/chat/ChatInterface';
import { BrainDumpInput } from '../features/brain-dump/BrainDumpInput';
import { Modal, SlideOverModal } from '../components/ui/Modal';
import { MobileNav } from './MobileNav';

export function AppLayout({
  sidebar,
  header,
  children,
  user,
  staff,
  context,
  updateContext,
  activeTab,
  onActiveTabChange,
  waitingCount = 0,
}) {
  const [showBrainDump, setShowBrainDump] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  return (
    <>
      <AppShell sidebar={sidebar} header={header}>
        {children}

        <ActionFab
          onQuickCapture={() => setShowBrainDump(true)}
          onAskOmni={() => setShowChat(true)}
          onFeedback={() => setShowFeedback(true)}
        />

        <Modal isOpen={showBrainDump} onClose={() => setShowBrainDump(false)}>
          <div className="bg-white rounded-3xl p-8 md:p-10 w-[90vw] max-w-6xl min-h-[50vh] md:min-h-[60vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-3">
                <Zap className="text-amber-500" size={24} /> Quick Capture
              </h2>
              <button
                onClick={() => setShowBrainDump(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <BrainDumpInput
              user={user}
              staff={staff}
              context={context}
              updateContext={updateContext}
            />
          </div>
        </Modal>

        <SlideOverModal isOpen={showChat} onClose={() => setShowChat(false)} position="right">
          <ChatInterface user={user} onClose={() => setShowChat(false)} />
        </SlideOverModal>

        <Modal isOpen={showFeedback} onClose={() => setShowFeedback(false)}>
          <div className="bg-white rounded-3xl p-8 md:p-10 w-[90vw] max-w-5xl min-h-[50vh] md:min-h-[60vh]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl md:text-2xl font-bold text-slate-900">Share Feedback</h2>
              <button
                onClick={() => setShowFeedback(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              <textarea
                className="w-full min-h-[200px] md:min-h-[320px] p-4 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Share your suggestions, bugs, or feedback..."
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowFeedback(false)}
                  className="px-4 py-2 rounded-full bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowFeedback(false);
                  }}
                  className="px-4 py-2 rounded-full bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
                >
                  Send Feedback
                </button>
              </div>
            </div>
          </div>
        </Modal>
      </AppShell>

      {/* Mobile Navigation */}
      <MobileNav activeTab={activeTab} onChange={onActiveTabChange} waitingCount={waitingCount} />
    </>
  );
}
