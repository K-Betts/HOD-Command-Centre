import React, { useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import {
  Brain,
  LayoutGrid,
  CheckSquare,
  Users,
  Map,
  MessageSquare,
  Sparkles,
  Mail,
  SlidersHorizontal,
  FileText,
  NotebookPen,
  Shield,
} from 'lucide-react';
import { AIFuelGauge } from '../components/ui/AIFuelGauge';
import { auth } from '../services/firebase';
import { logNavigation } from '../services/telemetry';
import { useModulePreferences } from '../hooks/useModulePreferences';
import { MODULE_DEFINITIONS } from '../config/moduleDefinitions';
import { useUserRole } from '../hooks/useUserRole';

export function Sidebar({ activeTab, onChange, waitingCount = 0 }) {
  const [user] = useAuthState(auth);
  const { isAdmin } = useUserRole(user);
  const { preferences, loading: _preferencesLoading } = useModulePreferences(user);

  // Log navigation events
  useEffect(() => {
    if (activeTab) {
      logNavigation(activeTab);
    }
  }, [activeTab]);

  const navGroups = [
    {
      title: 'EXECUTION',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid, note: 'Mission control' },
        { id: 'tasks', label: 'Tasks', icon: CheckSquare, note: 'Includes archive filter' },
        { id: 'meetings', label: 'Meetings', icon: NotebookPen, note: 'Agendas + minutes' },
      ],
    },
    {
      title: 'LEADERSHIP',
      items: [
        { id: 'staff', label: 'Staff Room', icon: Users, note: 'Leadership tab inside' },
        { id: 'strategy', label: 'Strategy', icon: Map, note: 'Horizon + Budget' },
        { id: 'reports', label: 'Reports', icon: FileText, note: 'Board report' },
      ],
    },
    {
      title: 'OUTPUTS',
      items: [
        { id: 'comms', label: 'Comms', icon: MessageSquare },
        { id: 'weeklyEmail', label: 'Weekly Email', icon: Mail },
      ],
    },
    {
      title: 'SYSTEM',
      items: [
        { id: 'settings', label: 'Settings', icon: SlidersHorizontal, note: 'Schedule & timetable' },
      ],
    },
  ];

  // Filter navigation items based on user preferences
  const filteredNavGroups = navGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      // Always show settings
      if (item.id === 'settings') return true;
      // Check if module is enabled in preferences
      const isEnabled = preferences?.modules?.[item.id]?.enabled ?? true;
      return isEnabled;
    }),
  })).filter((group) => group.items.length > 0); // Remove empty groups

  return (
    <aside className="w-64 bg-white border-r border-slate-200 h-screen sticky top-0 flex flex-col overflow-y-auto">
      <div className="px-5 py-5 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-slate-900 text-white rounded-lg">
            <Brain size={20} />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
              Second Brain
            </p>
            <p className="text-base font-bold text-slate-900 leading-tight">HoD Command</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-5">
        {filteredNavGroups.map((group) => (
          <div key={group.title} className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 px-2">
              {group.title}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onChange?.(item.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      isActive
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon
                          size={16}
                          className="flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{item.label}</div>
                          {item.note && (
                            <div className={`text-[10px] truncate ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>
                              {item.note}
                            </div>
                          )}
                        </div>
                      </div>
                      {item.id === 'tasks' && waitingCount > 0 && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 ${
                            isActive
                              ? 'bg-white/20 border-white/40 text-white'
                              : 'bg-amber-100 border-amber-200 text-amber-700'
                          }`}
                        >
                          {waitingCount}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-slate-200 bg-white space-y-3">
        {isAdmin && (
          <button
            onClick={() => onChange?.('admin')}
            className={`w-full p-3 rounded-lg border transition-all ${
              activeTab === 'admin'
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-white text-red-600 border-red-600 hover:bg-red-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Shield size={16} className="flex-shrink-0" />
              <div className="text-left min-w-0">
                <div className="text-sm font-bold truncate">Admin Console</div>
                <div className={`text-[10px] truncate ${
                  activeTab === 'admin' ? 'text-red-100' : 'text-red-500'
                }`}>
                  System control
                </div>
              </div>
            </div>
          </button>
        )}
        <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-[0.2em]">
          System
        </div>
        <div className="p-3 rounded-lg border border-slate-200 bg-slate-900 text-white">
          <div className="text-[10px] uppercase tracking-[0.15em] text-slate-300">
            AI Model
          </div>
          <div className="font-bold mt-1 text-sm">Gemini 2.5</div>
          <div className="flex items-center gap-2 text-[10px] text-emerald-400 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Connected
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-[0.15em] mb-2">
            API Quota
          </div>
          <AIFuelGauge />
        </div>
      </div>
    </aside>
  );
}

