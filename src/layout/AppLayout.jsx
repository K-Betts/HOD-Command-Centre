import React, { useState } from 'react';
import { Zap, X } from 'lucide-react';
import { AppShell } from '../components/ui/AppShell';
import { ActionFab } from '../components/ui/ActionFab';
import { ChatInterface } from '../features/chat/ChatInterface';
import { BrainDumpInput } from '../features/brain-dump/BrainDumpInput';
import { Modal, SlideOverModal } from '../components/ui/Modal';

export function AppLayout({
  sidebar,
  header,
  children,
  user,
  staff,
  context,
  updateContext,
}) {
  const [showBrainDump, setShowBrainDump] = useState(false);
  const [showChat, setShowChat] = useState(false);

  return (
    <AppShell sidebar={sidebar} header={header}>
      {children}

      <ActionFab
        onQuickCapture={() => setShowBrainDump(true)}
        onAskOmni={() => setShowChat(true)}
      />

      <Modal isOpen={showBrainDump} onClose={() => setShowBrainDump(false)}>
        <div className="bg-white rounded-3xl p-8 w-full max-w-2xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
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
    </AppShell>
  );
}
