import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Map,
  MessageSquare,
  Sparkles,
  Mail,
  Sunset,
  SlidersHorizontal,
  FileText,
  NotebookPen,
} from 'lucide-react';
import { TaskBoard } from './features/tasks/TaskBoard';
import { DashboardView } from './features/dashboard/DashboardView';
import { StaffView } from './features/staff/StaffView';
import { ScheduleView } from './features/schedule/ScheduleView';
import { StrategyView } from './features/strategy/StrategyView';
import { CommunicationShield } from './features/comms/CommunicationShield';
import { DevilsAdvocate } from './features/advocate/DevilsAdvocate';
import { WeeklyEmailGenerator } from './features/email/WeeklyEmailGenerator';
import { EndDayModal } from './features/wellbeing/EndDayModal';
import { LiveClock } from './components/ui/LiveClock';
import { TaskDetailModal } from './features/tasks/TaskDetailModal';
import { useTasks } from './hooks/useTasks';
import { useStaff } from './hooks/useStaff';
import { useContextData } from './hooks/useContextData';
import { ToastProvider } from './context/ToastContext';
import { useToast } from './context/ToastContext';
import { AcademicYearProvider } from './context/AcademicYearContext';
import { setAiErrorNotifier } from './services/ai';
import { SchoolYearSettings } from './features/settings/SchoolYearSettings';
import { Sidebar } from './layout/Sidebar';
import { AppLayout } from './layout/AppLayout';
import { AuthGate } from './layout/AuthGate';
import { DepartmentReport } from './features/reports/DepartmentReport';
import { MeetingsView } from './features/meetings/MeetingsView';

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
  const [showDebrief, setShowDebrief] = useState(false);
  const { updateTask, deleteTask, addTask, tasks } = useTasks(user);
  const waitingCount = useMemo(
    () =>
      (tasks || []).filter(
        (t) =>
          t.isWaitingFor &&
          !t.archivedAt &&
          (t.status || '').toString().toLowerCase() !== 'done'
      ).length,
    [tasks]
  );

  const { staff, logInteraction } = useStaff(user);
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
  meetings: { icon: NotebookPen, label: 'Meetings' },
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
        <LiveClock />
        <button
          onClick={() => setShowDebrief(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white text-xs font-semibold tracking-wide shadow-md hover:bg-slate-800 transition-all"
        >
          <Sunset size={16} className="text-amber-300" />
          End Day
        </button>
      </div>
    </div>
  );

  return (
    <AppLayout
      sidebar={<Sidebar activeTab={activeTab} onChange={setActiveTab} waitingCount={waitingCount} />}
      header={header}
      user={user}
      staff={staff}
      context={context}
      updateContext={updateContext}
    >
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8 pb-24">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
          {activeTab === 'dashboard' && (
            <DashboardView user={user} setActiveTab={setActiveTab} />
          )}
          {activeTab === 'tasks' && (
            <TaskBoard user={user} onEditTask={setEditingTask} />
          )}
          {activeTab === 'meetings' && (
            <MeetingsView
              user={user}
              staff={staff}
              logInteraction={logInteraction}
              addTask={addTask}
              tasks={tasks}
            />
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
    </AppLayout>
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
