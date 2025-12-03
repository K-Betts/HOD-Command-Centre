import React from 'react';
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
} from 'lucide-react';

export function Sidebar({ activeTab, onChange }) {
  const navGroups = [
    {
      title: 'COMMAND',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid, note: 'Mission control' },
        { id: 'tasks', label: 'Tasks', icon: CheckSquare, note: 'Includes archive filter' },
        { id: 'staff', label: 'Staff Room', icon: Users, note: 'Leadership tab inside' },
        { id: 'strategy', label: 'Strategy', icon: Map, note: 'Horizon + Budget' },
      ],
    },
    {
      title: 'TOOLS',
      items: [
        { id: 'comms', label: 'Comms', icon: MessageSquare },
        { id: 'advocate', label: 'Idea Refiner', icon: Sparkles },
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

  return (
    <aside className="w-72 bg-white/70 backdrop-blur-xl border-r border-white/60 shadow-lg shadow-slate-200/30 h-screen sticky top-0 flex flex-col">
      <div className="px-6 py-6 border-b border-white/60">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-lg shadow-slate-300/70">
            <Brain size={22} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
              Second Brain
            </p>
            <p className="text-lg font-bold text-slate-900 leading-tight">HoD Command</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {navGroups.map((group) => (
          <div key={group.title} className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-500 px-2">
              {group.title}
            </div>
            <div className="space-y-2">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onChange?.(item.id)}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all group ${
                      isActive
                        ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-300/70'
                        : 'bg-white/70 text-slate-700 border-slate-100 hover:border-slate-200 hover:-translate-y-[1px]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        size={18}
                        className={isActive ? 'text-white' : 'text-slate-400'}
                      />
                      <div>
                        <div className="text-sm font-semibold tracking-tight">{item.label}</div>
                        {item.note && (
                          <div className={`text-[11px] ${isActive ? 'text-slate-200' : 'text-slate-500'}`}>
                            {item.note}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-6 py-5 border-t border-white/60 bg-white/70">
        <div className="text-[11px] uppercase font-semibold text-slate-500 tracking-[0.25em]">
          Focus
        </div>
        <div className="mt-3 p-3 rounded-xl border border-slate-100 bg-slate-900 text-white shadow-inner shadow-slate-800/40">
          <div className="text-xs uppercase tracking-[0.2em] text-slate-200">
            Active Model
          </div>
          <div className="font-bold mt-1 text-lg">Gemini 2.5</div>
          <div className="flex items-center gap-2 text-xs text-emerald-300 mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
            Live
          </div>
        </div>
      </div>
    </aside>
  );
}
