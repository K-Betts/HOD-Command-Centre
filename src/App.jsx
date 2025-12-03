import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Map,
  MessageSquare,
  Sparkles,
  Mail,
  Zap,
  X,
  Sunset,
  SlidersHorizontal,
  FileText,
} from 'lucide-react';
import { TaskBoard } from './features/tasks/TaskBoard';
import { DashboardView } from './features/dashboard/DashboardView';
import { StaffView } from './features/staff/StaffView';
import { ScheduleView } from './features/schedule/ScheduleView';
import { BrainDumpInput } from './features/brain-dump/BrainDumpInput';
import { StrategyView } from './features/strategy/StrategyView';
import { CommunicationShield } from './features/comms/CommunicationShield';
import { DevilsAdvocate } from './features/advocate/DevilsAdvocate';
import { WeeklyEmailGenerator } from './features/email/WeeklyEmailGenerator';
import { EndDayModal } from './features/wellbeing/EndDayModal';
import { TaskDetailModal } from './features/tasks/TaskDetailModal';
import { useTasks } from './hooks/useTasks';
import { useStaff } from './hooks/useStaff';
import { useContextData } from './hooks/useContextData';
import { ToastProvider } from './context/ToastContext';
import { useToast } from './context/ToastContext';
import { AcademicYearProvider } from './context/AcademicYearContext';
import { setAiErrorNotifier } from './services/ai';
import { SchoolYearSettings } from './features/settings/SchoolYearSettings';
import { AppShell } from './components/ui/AppShell';
import { Sidebar } from './layout/Sidebar';
import { ActionFab } from './components/ui/ActionFab';
import { AuthGate } from './layout/AuthGate';
import { DepartmentReport } from './features/reports/DepartmentReport';

// --- Main App Component ---
export default function App() {
  return (
    <AuthGate>
      {(user) => (
        <ToastProvider>
          <AiToastBridge />
          <AcademicYearProvider user={user}>
            <AuthedAppShell user={user} />
          </AcademicYearProvider>
        </ToastProvider>
      )}
    </AuthGate>
  );
}

function AuthedAppShell({ user }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [editingTask, setEditingTask] = useState(null);
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [showDebrief, setShowDebrief] = useState(false);
  const { updateTask, deleteTask } = useTasks(user);
  const { staff } = useStaff(user);
  const { context, updateContext } = useContextData(user);

  const headerMeta = {
    dashboard: { icon: LayoutDashboard, label: 'Command Dashboard' },
    tasks: { icon: CheckSquare, label: 'Task Cockpit' },
    staff: { icon: Users, label: 'Staff Room' },
    strategy: { icon: Map, label: 'Strategy War Room' },
    comms: { icon: MessageSquare, label: 'Comms' },
    advocate: { icon: Sparkles, label: 'Idea Refiner' },
    reports: { icon: FileText, label: 'Board Report' },
    weeklyEmail: { icon: Mail, label: 'Weekly Email' },
    settings: { icon: SlidersHorizontal, label: 'System Settings' },
  };

  const activeHeader = headerMeta[activeTab] || headerMeta.dashboard;
  const HeaderIcon = activeHeader.icon;

  const header = (
    <div className="px-8 py-5 flex justify-between items-center">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
          Second Brain
        </p>
        <div className="mt-2 flex items-center gap-3">
          <HeaderIcon className="text-slate-700" size={20} />
          <h1 className="text-xl font-bold text-slate-900">{activeHeader.label}</h1>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowDebrief(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white text-xs font-semibold tracking-wide shadow-md hover:bg-slate-800 transition-all"
        >
          <Sunset size={16} className="text-amber-300" />
          End Day
        </button>
        <div className="text-xs font-bold text-slate-500 font-mono bg-white px-3 py-1.5 rounded-full border border-slate-200">
          USER: {user.uid.slice(0, 6)}
        </div>
      </div>
    </div>
  );

  return (
    <AppShell
      sidebar={<Sidebar activeTab={activeTab} onChange={setActiveTab} />}
      header={header}
    >
      <div className="max-w-[1600px] mx-auto pb-24">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
          {activeTab === 'dashboard' && (
            <DashboardView user={user} setActiveTab={setActiveTab} />
          )}
          {activeTab === 'tasks' && (
            <TaskBoard user={user} onEditTask={setEditingTask} />
          )}
          {activeTab === 'strategy' && <StrategyView user={user} staff={staff} />}
          {activeTab === 'staff' && <StaffView user={user} setActiveTab={setActiveTab} />}
          {activeTab === 'comms' && <CommunicationShield staff={staff} />}
          {activeTab === 'advocate' && <DevilsAdvocate user={user} />}
          {activeTab === 'reports' && <DepartmentReport user={user} />}
          {activeTab === 'weeklyEmail' && <WeeklyEmailGenerator user={user} />}
          {activeTab === 'settings' && <SettingsHub user={user} />}
        </div>
      </div>

      <ActionFab onClick={() => setShowQuickCapture(true)} />

      {showQuickCapture && (
        <div
          className="fixed inset-0 bg-slate-900/25 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowQuickCapture(false)}
        >
          <div
            className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Zap className="text-amber-500" /> Quick Capture
              </h2>
              <button
                onClick={() => setShowQuickCapture(false)}
                className="p-2 hover:bg-slate-50 rounded-full transition-colors"
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
        </div>
      )}

      {showDebrief && (
        <EndDayModal
          user={user}
          staff={staff}
          context={context}
          updateContext={updateContext}
          onClose={() => setShowDebrief(false)}
        />
      )}

      {editingTask && (
        <TaskDetailModal
          task={editingTask}
          user={user}
          onSave={updateTask}
          onDelete={deleteTask}
          onClose={() => setEditingTask(null)}
        />
      )}
    </AppShell>
  );
}

function SettingsHub({ user }) {
  const [activeSection, setActiveSection] = useState('system');
  const sections = [
    { id: 'system', label: 'System Rhythm' },
    { id: 'timetable', label: 'Schedule / Timetable' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            System
          </p>
          <h2 className="text-2xl font-bold text-slate-900">Settings & Schedule</h2>
          <p className="text-sm text-slate-500">
            Configure the year rhythm and manage timetable data from a single control room.
          </p>
        </div>
        <div className="bg-slate-100 border border-slate-200 rounded-full p-1 flex items-center gap-1">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                activeSection === section.id
                  ? 'bg-white shadow text-slate-900'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>

      {activeSection === 'system' ? (
        <SchoolYearSettings user={user} />
      ) : (
        <div className="bg-white/80 backdrop-blur-sm border border-slate-100 rounded-2xl shadow-sm p-6">
          <ScheduleView user={user} />
        </div>
      )}
    </div>
  );
}

function AiToastBridge() {
  const { addToast } = useToast();
  useEffect(() => {
    setAiErrorNotifier((msg) => addToast('error', msg));
    return () => setAiErrorNotifier(null);
  }, [addToast]);
  return null;
}
