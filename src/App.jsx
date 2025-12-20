import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
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
  Shield,
} from 'lucide-react';
import { DashboardView } from './features/dashboard/DashboardView';
import { TaskBoard } from './features/tasks/TaskBoard';
import { LiveClock } from './components/ui/LiveClock';
import { useTasks } from './hooks/useTasks';
import { useStaff } from './hooks/useStaff';
import { useContextData } from './hooks/useContextData';
import { useTelemetry } from './hooks/useTelemetry';
import { ToastProvider } from './context/ToastContext';
import { useToast } from './context/ToastContext';
import { AcademicYearProvider } from './context/AcademicYearContext';
import { AppErrorBoundary } from './components/shared/ErrorBoundary';
import { setAiErrorNotifier } from './services/ai';
import { Sidebar } from './layout/Sidebar';
import { AppLayout } from './layout/AppLayout';
import { AuthGate } from './layout/AuthGate';

const StaffView = lazy(() => import('./features/staff/StaffView').then((m) => ({ default: m.StaffView })));
const ScheduleView = lazy(() =>
  import('./features/schedule/ScheduleView').then((m) => ({ default: m.ScheduleView }))
);
const StrategyView = lazy(() =>
  import('./features/strategy/StrategyView').then((m) => ({ default: m.StrategyView }))
);
const CommunicationShield = lazy(() =>
  import('./features/comms/CommunicationShield').then((m) => ({ default: m.CommunicationShield }))
);
const DevilsAdvocate = lazy(() =>
  import('./features/advocate/DevilsAdvocate').then((m) => ({ default: m.DevilsAdvocate }))
);
const WeeklyEmailGenerator = lazy(() =>
  import('./features/email/WeeklyEmailGenerator').then((m) => ({ default: m.WeeklyEmailGenerator }))
);
const EndDayModal = lazy(() =>
  import('./features/wellbeing/EndDayModal').then((m) => ({ default: m.EndDayModal }))
);
const TaskDetailModal = lazy(() =>
  import('./features/tasks/TaskDetailModal').then((m) => ({ default: m.TaskDetailModal }))
);
const SchoolYearSettings = lazy(() =>
  import('./features/settings/SchoolYearSettings').then((m) => ({ default: m.SchoolYearSettings }))
);
const ModulePreferences = lazy(() =>
  import('./features/settings/ModulePreferences').then((m) => ({ default: m.ModulePreferences }))
);
const DepartmentReport = lazy(() =>
  import('./features/reports/DepartmentReport').then((m) => ({ default: m.DepartmentReport }))
);
const MeetingsView = lazy(() =>
  import('./features/meetings/MeetingsView').then((m) => ({ default: m.MeetingsView }))
);
const AdminDashboard = lazy(() =>
  import('./features/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);

// --- Main App Component ---
export default function App() {
  return (
    <AuthGate>
      {(user) => (
        <ToastProvider>
          <AiToastBridge />
          <AcademicYearProvider user={user}>
            <AppErrorBoundary>
              <AuthedAppShell user={user} />
            </AppErrorBoundary>
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
  const { logNavigation, logEvent } = useTelemetry();
  const activeTabRef = useRef(activeTab);
  const sessionIdRef = useRef(null);
  const sessionStartRef = useRef(null);
  const lastActivityRef = useRef(0);
  const idleTimeoutRef = useRef(null);
  const sessionStorageKey = 'hod_session_id';

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);
  
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

  // Session Tracking: Initialize session on mount
  useEffect(() => {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    sessionIdRef.current = sessionId;
    sessionStartRef.current = Date.now();
    lastActivityRef.current = Date.now();

    try {
      window.sessionStorage?.setItem?.(sessionStorageKey, sessionId);
    } catch {
      // ignore
    }

    // Log session start
    logEvent('Session', 'Start', sessionId, {
      sessionId,
      referrer: document.referrer,
      initialTab: activeTabRef.current,
    });

    // Activity tracking for idle detection
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
      
      // Reset idle timeout
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }

      // Set idle timeout (15 minutes)
      idleTimeoutRef.current = setTimeout(() => {
        const idleDuration = Math.floor((Date.now() - lastActivityRef.current) / 1000);
        logEvent('Session', 'Idle', sessionId, {
          sessionId,
          idleDuration,
        });
      }, 15 * 60 * 1000); // 15 minutes
    };

    // Track user activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, updateActivity, { passive: true });
    });

    updateActivity(); // Initialize

    // Cleanup function - log session end
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });

      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }

      const sessionDuration = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      const lastActivity = Math.floor((Date.now() - lastActivityRef.current) / 1000);
      
      logEvent('Session', 'End', sessionIdRef.current, {
        sessionId: sessionIdRef.current,
        duration: sessionDuration,
        lastActivityAgo: lastActivity,
        finalTab: activeTabRef.current,
      });
    };
  }, [logEvent, sessionStorageKey]); // Only run once on mount

  // Navigation Tracking: Log page views when activeTab changes
  useEffect(() => {
    logNavigation(activeTab);
  }, [activeTab, logNavigation]);

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
    admin: { icon: Shield, label: 'Admin Console' },
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
        <Suspense
          fallback={
            <div className="p-6 text-sm text-slate-500">Loading...</div>
          }
        >
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
            {activeTab === 'admin' && <AdminDashboard />}
          </div>
        </Suspense>
      </div>

      <Suspense fallback={null}>
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
      </Suspense>
    </AppLayout>
  );

}

function SettingsHub({ user }) {
  const [activeSection, setActiveSection] = useState('system');
  const sections = [
    { id: 'system', label: 'System Rhythm' },
    { id: 'timetable', label: 'Schedule / Timetable' },
    { id: 'modules', label: 'Module Preferences' },
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
      ) : activeSection === 'modules' ? (
        <ModulePreferences user={user} />
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
