import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  Presentation,
  Plus,
  ChevronLeft,
  FileText,
  Sparkles,
  Target,
  ArrowLeft,
  Trash2,
  Pencil,
  Users,
  ChevronDown,
} from 'lucide-react';
import LeadershipView from '../leadership/LeadershipView';
import { useStaff, useInteractionLogs } from '../../hooks/useStaff';
import { useTasks } from '../../hooks/useTasks';
import { useContextData } from '../../hooks/useContextData';
import { analyzeStaffProfile, generateAgenda } from '../../services/ai';
import { useStaffInsights } from '../../hooks/useStaffInsights';
import { StaffScheduleView } from './StaffScheduleView';
import { useBuckBalance } from '../../hooks/useBuckBalance';
import { BrainCard } from '../../components/ui/BrainCard';
import { StatusBadge } from '../../components/ui/StatusBadge';

const discColorStyles = {
  Red: 'bg-red-100 text-red-700 border-red-200',
  Yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Blue: 'bg-blue-100 text-blue-700 border-blue-200',
};

const discColorHex = {
  Red: '#ef4444',
  Yellow: '#eab308',
  Green: '#22c55e',
  Blue: '#3b82f6',
};

const getDiscColor = (colorType) =>
  discColorStyles[colorType] || 'bg-gray-100 text-gray-700 border-gray-200';

const getSecondaryDiscColor = (colorType) => {
  const styles = {
    Red: 'border-red-200',
    Yellow: 'border-yellow-200',
    Green: 'border-emerald-200',
    Blue: 'border-blue-200',
  };
  return styles[colorType] || 'border-gray-200';
};

const getDiscHex = (colorType) => discColorHex[colorType] || '#e5e7eb';

const interactionTypeMeta = {
  SUPPORT: {
    label: 'Support',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: 'Coaching, wellbeing, praise, listening',
  },
  CHALLENGE: {
    label: 'Challenge',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    description: 'Standards, feedback, accountability, deadlines',
  },
  ADMIN: {
    label: 'Admin',
    badgeClass: 'bg-gray-50 text-gray-600 border-gray-200',
    description: 'Neutral updates or housekeeping',
  },
};

const getInteractionTypeMeta = (value) => {
  const key = (value || '').toString().toUpperCase();
  return interactionTypeMeta[key] || interactionTypeMeta.ADMIN;
};

const balanceBadges = {
  challenge: { label: 'Risk: High Pressure', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  support: { label: 'Risk: Low Standards', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  optimal: { label: 'Optimal Zone', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  neutral: { label: 'Slight Tilt', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  empty: { label: 'Log interactions', className: 'bg-gray-50 text-gray-600 border-gray-200' },
};

const pickBalanceBadge = (supportRatio, hasLogs) => {
  if (!hasLogs) return balanceBadges.empty;
  const challengeRatio = 1 - supportRatio;
  if (challengeRatio > 0.7) return balanceBadges.challenge;
  if (supportRatio > 0.7) return balanceBadges.support;
  if (supportRatio >= 0.4 && supportRatio <= 0.6) return balanceBadges.optimal;
  return balanceBadges.neutral;
};

const formatDisplayDate = (value) => {
  if (!value) return '—';
  try {
    const d = value?.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return format(d, 'yyyy-MM-dd');
  } catch {
    return String(value);
  }
};

function MeetingFinderView({ staff, onBack }) {
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const today = format(new Date(), 'EEEE');
  const [expandedDay, setExpandedDay] = useState(dayOrder.includes(today) ? today : null);

  const generateTimeSlots = (day) => {
    // This function should be identical to the one in TimetableEditor
    const slots = [];
    if (day === 'Friday') {
      slots.push({ label: 'Meeting', time: '07:00 - 08:20' });
      let time = new Date(); time.setHours(8, 20, 0, 0);
      for (let i = 0; i < 11; i++) {
        const startTime = format(time, 'HH:mm');
        time.setMinutes(time.getMinutes() + 20);
        const endTime = format(time, 'HH:mm');
        slots.push({ label: `P${i + 1}`, time: `${startTime} - ${endTime}` });
      }
    } else {
      slots.push({ label: 'Meeting', time: '07:00 - 08:00' });
      let time = new Date(); time.setHours(8, 0, 0, 0);
      for (let i = 0; i < 21; i++) {
        const startTime = format(time, 'HH:mm');
        time.setMinutes(time.getMinutes() + 20);
        const endTime = format(time, 'HH:mm');
        slots.push({ label: `P${i + 1}`, time: `${startTime} - ${endTime}` });
      }
      slots.push({ label: 'Meeting', time: '15:15 - 16:15' });
    }
    return slots;
  };

  const availability = dayOrder.reduce((acc, day) => {
    const timeSlots = generateTimeSlots(day);
    acc[day] = timeSlots.map((slot, i) => {
      const freeStaff = [];
      const busyStaff = [];
      staff.forEach(member => {
        const memberSlot = member.timetable?.[day]?.[i];
        if (memberSlot?.isFree) {
          freeStaff.push(member);
        } else {
          busyStaff.push(member);
        }
      });
      return { ...slot, freeStaff, busyStaff };
    });
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-200 h-full flex flex-col p-8">
      <div className="flex items-center gap-4 mb-8 pb-4 border-b border-gray-100">
        <button onClick={onBack} className="p-3 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronLeft size={24} className="text-gray-600" />
        </button>
        <h2 className="text-3xl font-bold text-gray-800">Meeting Slot Finder</h2>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar -mr-4 pr-4">
        <div className="space-y-2">
          {dayOrder.map(day => {
            const isToday = day === today;
            const isExpanded = expandedDay === day;
            const slots = availability[day];
            const allFreeSlots = slots.filter(s => s.freeStaff.length === staff.length).length;

            return (
              <div key={day} className={`rounded-3xl border transition-all duration-300 ${isToday ? 'bg-indigo-50/50 border-indigo-200' : 'bg-gray-50 border-gray-100'}`}>
                <button onClick={() => setExpandedDay(prev => prev === day ? null : day)} className="w-full flex items-center justify-between p-4 text-left">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-bold text-gray-700 uppercase tracking-wide">{day}</div>
                    {isToday && <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">Today</span>}
                  </div>
                  <div className="flex items-center gap-4">
                    {allFreeSlots > 0 && (
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                        {allFreeSlots} fully free slot{allFreeSlots > 1 ? 's' : ''}
                      </span>
                    )}
                    <ChevronDown size={16} className={`text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3">
                    {slots.map((slot, i) => (
                      <div key={i} className={`p-4 rounded-2xl border ${slot.freeStaff.length === staff.length ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'}`}>
                        <div className="flex justify-between items-center mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 uppercase">{slot.label}</span>
                            <span className="text-xs text-gray-500 font-mono">{slot.time}</span>
                          </div>
                          <div className={`text-sm font-bold px-3 py-1 rounded-full text-white ${slot.freeStaff.length === staff.length ? 'bg-emerald-500' : 'bg-gray-400'}`}>
                            {slot.freeStaff.length} / {staff.length} Free
                          </div>
                        </div>
                        {slot.freeStaff.length < staff.length && (
                          <div>
                            <h4 className="text-[11px] font-bold text-gray-400 uppercase mb-2">Busy</h4>
                            <div className="flex flex-wrap gap-2">
                              {slot.busyStaff.map(member => (
                                <div key={member.id} className="flex items-center gap-2 px-2 py-1 bg-gray-100 rounded-lg text-xs font-semibold text-gray-600">
                                  <div className="w-4 h-4 rounded-full bg-gray-300 flex items-center justify-center text-[10px]">{member.initials?.[0]}</div>
                                  {member.name}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function StaffView({ user, setActiveTab }) {
  const { staff, addStaff, deleteStaff, updateStaff } = useStaff(user);
  const { tasks, addTask } = useTasks(user);
  const { context } = useContextData(user);
  const { balanceByStaff } = useBuckBalance(user, staff);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newStaff, setNewStaff] = useState({
    name: '',
    initials: '',
    role: 'Teacher',
    yearGroups: [],
    isLineManager: false,
    memberType: 'team', // 'team' or 'stakeholder'
  });
  const [isTeamMeetingMode, setIsTeamMeetingMode] = useState(false);
  const [isFindingMeeting, setIsFindingMeeting] = useState(false);
  const [activePane, setActivePane] = useState('team');

  const toggleNewYearGroup = (year) => {
    setNewStaff((prev) => {
      const exists = prev.yearGroups.includes(year);
      return {
        ...prev,
        yearGroups: exists
          ? prev.yearGroups.filter((y) => y !== year)
          : [...prev.yearGroups, year],
      };
    });
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newStaff.name) return;
    // If stakeholder, role might not be relevant from the dropdown
    const payload = { ...newStaff };
    if (payload.memberType === 'stakeholder' && !payload.role) {
      payload.role = 'Stakeholder';
    }
    await addStaff(payload);
    setNewStaff({ name: '', initials: '', role: 'Teacher', yearGroups: [], memberType: 'team' });
    setShowAdd(false);
  };

  if (isTeamMeetingMode)
    return (
      <TeamMeetingView
        staff={staff}
        addTask={addTask}
        onBack={() => setIsTeamMeetingMode(false)}
      />
    );

  if (isFindingMeeting) {
    return (
      <MeetingFinderView
        staff={staff}
        onBack={() => setIsFindingMeeting(false)}
      />
    );
  }
  if (selectedStaff) {
    const current = staff.find((s) => s.id === selectedStaff.id);
    if (!current) {
      setSelectedStaff(null);
      return null;
    }
    return (
      <StaffDetailView
        staff={current}
        allTasks={tasks}
        addTask={addTask}
        onBack={() => setSelectedStaff(null)}
        onUpdate={(data) => updateStaff(current.id, data)}
        user={user}
      />
    );
  }

  const teamMembers = staff.filter(s => s.memberType !== 'stakeholder');
  const stakeholders = staff.filter(s => s.memberType === 'stakeholder');

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            Staff Room
          </p>
          <h2 className="text-2xl font-bold text-slate-900">People & Leadership</h2>
          <p className="text-sm text-slate-500">
            Second Brain view of AI profiles, buck balance, and leadership signals.
          </p>
        </div>
        <div className="flex flex-col md:flex-row items-end gap-3">
          <div className="bg-slate-100 border border-slate-200 rounded-full p-1 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActivePane('team')}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                activePane === 'team' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Profiles
            </button>
            <button
              type="button"
              onClick={() => setActivePane('leadership')}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                activePane === 'leadership' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Leadership Lens
            </button>
          </div>
          {activePane === 'team' && (
            <div className="flex gap-2">
              <button
                onClick={() => setIsFindingMeeting(true)}
                className="flex items-center gap-2 bg-white text-slate-700 px-4 py-2.5 rounded-xl hover:bg-slate-50 transition-colors font-semibold text-sm border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={teamMembers.length === 0}
              >
                <Users size={18} /> Find Meeting Slot
              </button>
              <button
                onClick={() => setIsTeamMeetingMode(true)}
                className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl hover:bg-slate-800 transition-colors font-semibold text-sm"
              >
                <Presentation size={18} /> Meeting Mode
              </button>
              <button
                onClick={() => setShowAdd(!showAdd)}
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 font-semibold text-sm"
              >
                <Plus size={18} /> Add Staff
              </button>
            </div>
          )}
        </div>
      </div>

      {activePane === 'leadership' ? (
        <LeadershipView user={user} staff={staff} setActiveTab={setActiveTab} />
      ) : (
        <>
          {showAdd && (
            <form
              onSubmit={handleAdd}
              className="bg-white p-8 rounded-3xl border border-emerald-100 shadow-xl animate-in fade-in slide-in-from-top-4"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Add Person</h3>
                  <p className="text-sm text-slate-500">Add a department member or an external stakeholder.</p>
                </div>
                <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                  <button type="button" onClick={() => setNewStaff(s => ({...s, memberType: 'team'}))} className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition-all ${newStaff.memberType === 'team' ? 'bg-white shadow-md text-emerald-700' : 'text-slate-500'}`}>Team Member</button>
                  <button type="button" onClick={() => setNewStaff(s => ({...s, memberType: 'stakeholder'}))} className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition-all ${newStaff.memberType === 'stakeholder' ? 'bg-white shadow-md text-emerald-700' : 'text-slate-500'}`}>Stakeholder</button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">
                    Full Name
                  </label>
                  <input
                    placeholder="e.g. Sarah Smith"
                    value={newStaff.name}
                    onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">
                    Initials
                  </label>
                  <input
                    placeholder="SS"
                    value={newStaff.initials}
                    onChange={(e) =>
                      setNewStaff({
                        ...newStaff,
                        initials: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  />
                </div>
                {newStaff.memberType === 'team' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">
                      Role
                    </label>
                    <select
                      value={newStaff.role}
                      onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}
                      className="w-full p-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                    >
                      <option>Teacher</option>
                      <option>ECT / NQT</option>
                      <option>Technician</option>
                      <option>Deputy HoD</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Role / Title</label>
                    <input placeholder="e.g. Line Manager" value={newStaff.role} onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })} className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" />
                  </div>
                )}
              </div>
              {newStaff.memberType === 'team' && (
                <div className="mb-8">
                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">
                    Teaching Years
                  </label>
                  <div className="flex gap-2">
                    {[7, 8, 9, 10, 11, 12, 13].map((y) => (
                      <button
                        key={y}
                        type="button"
                        onClick={() => toggleNewYearGroup(y)}
                        className={`w-10 h-10 rounded-full text-sm font-bold border transition-all ${
                          newStaff.yearGroups.includes(y)
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-300'
                        }`}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="px-5 py-2.5 text-slate-500 hover:bg-slate-50 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-bold shadow-lg shadow-emerald-200"
                >
                  Save Member
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {teamMembers.map((member) => {
              const activeLoad = (tasks || []).filter(
                (t) => t.assignee === member.name && t.status !== 'done'
              ).length;

              const parentsEvents =
                context?.events?.filter((evt) => {
                  const title = (evt.title || evt.event || '').toLowerCase();
                  return title.includes('parent') && title.includes('year 8');
                }) || [];

              const isBusyForParents =
                parentsEvents.length > 0 &&
                (member.yearGroups || []).some((y) => String(y) === '8');

              const stats = balanceByStaff[member.id];
              const supportCount = stats?.counts?.support || 0;
              const challengeCount = stats?.counts?.challenge || 0;
              const adminCount = stats?.counts?.admin || 0;
              const totalRelational = supportCount + challengeCount;
              const hasBalanceData = totalRelational > 0;
              const supportRatio = hasBalanceData ? supportCount / totalRelational : 0.5;
              const challengeRatio = hasBalanceData ? challengeCount / totalRelational : 0.5;
              const badge = pickBalanceBadge(supportRatio, hasBalanceData);
              const profileColor = getDiscHex(member.aiProfile?.primaryColor);

              return (
                <BrainCard
                  key={member.id}
                  onClick={() => setSelectedStaff(member)}
                  className="p-6 cursor-pointer hover:-translate-y-1 group relative"
                  style={{ borderColor: profileColor }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center font-bold text-lg text-slate-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        {member.initials || member.name[0]}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-lg">{member.name}</h3>
                        <div className="flex items-center gap-2 flex-wrap text-sm text-slate-500">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                            {member.role}
                          </span>
                          {member.isLineManager && (
                            <span className="text-[11px] font-bold uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                              Line Manager
                            </span>
                          )}
                          {isBusyForParents && (
                            <span className="text-[11px] font-bold uppercase text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                              Parents Eve
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {(member.yearGroups || []).sort((a, b) => a - b).map((y) => (
                            <span
                              key={y}
                              className="px-2 py-1 bg-white border border-slate-200 rounded-full text-[11px] font-semibold text-slate-600"
                            >
                              Year {y}
                            </span>
                          ))}
                          {(!member.yearGroups || member.yearGroups.length === 0) && (
                            <span className="text-[11px] text-slate-400 italic">No year groups</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {member.aiProfile ? (
                      <StatusBadge
                        tone="strategy"
                        label={`${member.aiProfile.primaryColor}${member.aiProfile.secondaryColor ? `/${member.aiProfile.secondaryColor.charAt(0)}` : ''}`}
                        className="font-bold"
                      />
                    ) : (
                      <span className="text-xs text-slate-400">AI profile pending</span>
                    )}
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <span>Buck Balance</span>
                      <span className={`px-2 py-0.5 rounded-full border ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                      <div
                        style={{ width: `${Math.max(0, Math.min(100, supportRatio * 100))}%` }}
                        className={`h-full transition-all duration-300 ${hasBalanceData ? 'bg-emerald-500' : 'bg-slate-300'}`}
                      />
                      <div
                        style={{ width: `${Math.max(0, Math.min(100, challengeRatio * 100))}%` }}
                        className={`h-full transition-all duration-300 ${hasBalanceData ? 'bg-rose-500' : 'bg-slate-400'}`}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-600 font-semibold">
                      <span>Support: {supportCount}</span>
                      <span>Challenge: {challengeCount}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">
                      Admin: {adminCount} {hasBalanceData ? '' : '• log first touchpoint'}
                    </div>
                  </div>

                  <div className="pt-4 flex justify-between items-center text-[11px] text-slate-500">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                        Load: {activeLoad}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteStaff(member.id);
                      }}
                      className="p-2 bg-white text-slate-300 hover:text-rose-600 rounded-full shadow-sm hover:shadow-md transition-all border border-slate-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </BrainCard>
              );
            })}
          </div>

          {stakeholders.length > 0 && (
            <div className="mt-8 space-y-4">
              <h2 className="text-xl font-bold text-slate-900">Key Stakeholders</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {stakeholders.map((member) => {
                  const stats = balanceByStaff[member.id];
                  const supportCount = stats?.counts?.support || 0;
                  const challengeCount = stats?.counts?.challenge || 0;
                  const adminCount = stats?.counts?.admin || 0;
                  const totalRelational = supportCount + challengeCount;
                  const hasBalanceData = totalRelational > 0;
                  const supportRatio = hasBalanceData ? supportCount / totalRelational : 0.5;
                  const challengeRatio = hasBalanceData ? challengeCount / totalRelational : 0.5;
                  const badge = pickBalanceBadge(supportRatio, hasBalanceData);
                  const profileColor = getDiscHex(member.aiProfile?.primaryColor);

                  return (
                    <BrainCard
                      key={member.id}
                      onClick={() => setSelectedStaff(member)}
                      className="p-6 cursor-pointer hover:-translate-y-1"
                      style={{ borderColor: profileColor }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center font-bold text-lg text-slate-700">
                            {member.initials || member.name[0]}
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900 text-lg">{member.name}</h3>
                            <span className="text-sm text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded">
                              {member.role}
                            </span>
                          </div>
                        </div>
                        {member.aiProfile ? (
                          <StatusBadge
                            tone="strategy"
                            label={member.aiProfile.primaryColor}
                            className="font-bold"
                          />
                        ) : (
                          <span className="text-xs text-slate-400">AI profile pending</span>
                        )}
                      </div>

                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <span>Buck Balance</span>
                          <span className={`px-2 py-0.5 rounded-full border ${badge.className}`}>
                            {badge.label}
                          </span>
                        </div>
                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                          <div
                            style={{ width: `${Math.max(0, Math.min(100, supportRatio * 100))}%` }}
                            className={`h-full transition-all duration-300 ${hasBalanceData ? 'bg-emerald-500' : 'bg-slate-300'}`}
                          />
                          <div
                            style={{ width: `${Math.max(0, Math.min(100, challengeRatio * 100))}%` }}
                            className={`h-full transition-all duration-300 ${hasBalanceData ? 'bg-rose-500' : 'bg-slate-400'}`}
                          />
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-600 font-semibold">
                          <span>Support: {supportCount}</span>
                          <span>Challenge: {challengeCount}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          Admin: {adminCount} {hasBalanceData ? '' : '• log first touchpoint'}
                        </div>
                      </div>

                      <button
                        onClick={(e) => { e.stopPropagation(); deleteStaff(member.id); }}
                        className="mt-4 p-2 bg-white text-slate-300 hover:text-rose-600 rounded-full shadow-sm hover:shadow-md transition-all border border-slate-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </BrainCard>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TeamMeetingView({ staff, addTask, onBack }) {
  const [topic, setTopic] = useState('');
  const [agenda, setAgenda] = useState('');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!topic) return;
    setGenerating(true);
    const staffSummary = staff.map((s) => `${s.name} (${s.role})`);
    const result = await generateAgenda(topic, staffSummary);
    setAgenda(result);
    setGenerating(false);
  };

  return (
    <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-200 h-full flex flex-col p-8">
      <div className="flex items-center gap-4 mb-8 pb-4 border-b border-gray-100">
        <button
          onClick={onBack}
          className="p-3 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ChevronLeft size={24} className="text-gray-600" />
        </button>
        <h2 className="text-3xl font-bold text-gray-800">Team Meeting Planner</h2>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
        <div className="space-y-8">
          <div className="bg-gray-50 p-8 rounded-3xl border border-gray-200">
            <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
              <Target size={20} /> Meeting Focus
            </h3>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full p-4 border rounded-2xl mb-4 text-lg bg-white"
              placeholder="e.g. Year 11 Mock Exam Feedback"
            />
            <button
              onClick={handleGenerate}
              disabled={generating || !topic}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all"
            >
              {generating ? 'Generating Agenda...' : 'Generate with AI'}
            </button>
          </div>
          <div>
            <h3 className="font-bold text-gray-700 mb-4 px-2">Attendees</h3>
            <div className="flex flex-wrap gap-2">
              {staff.map((s) => (
                <div
                  key={s.id}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-bold text-gray-600 flex items-center gap-2"
                >
                  <div className="w-6 h-6 rounded-full bg-gray-100 text-xs flex items-center justify-center">
                    {s.initials || s.name[0]}
                  </div>
                  {s.name}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="bg-indigo-50 rounded-3xl p-8 border border-indigo-100 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <FileText size={150} />
          </div>
          <h3 className="font-bold text-indigo-900 mb-6 flex items-center gap-2 relative z-10">
            <FileText size={24} /> Draft Agenda
          </h3>
          {agenda ? (
            <div className="whitespace-pre-wrap text-gray-700 leading-relaxed bg-white/50 p-6 rounded-2xl border border-indigo-100/50 flex-1 relative z-10 font-medium">
              {agenda}
            </div>
          ) : (
            <div className="text-indigo-300 italic text-center flex-1 flex flex-col items-center justify-center relative z-10">
              <Sparkles size={48} className="mb-4 opacity-50" />
              <p>Enter a topic to generate an intelligent agenda.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StaffDetailView({ staff, allTasks, addTask, onBack, onUpdate, user }) {
  const [activeSubTab, setActiveSubTab] = useState('profile');
  const [editingInteraction, setEditingInteraction] = useState(null);
  const [interactionForm, setInteractionForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: 'Neutral',
    summary: '',
    source: 'manual',
    interactionType: 'SUPPORT',
  });
  const { interactions, addInteraction, updateInteraction, deleteInteraction } = useInteractionLogs(user, staff?.id);
  const { insights } = useStaffInsights(user, staff?.id);
  useEffect(() => {
    setInteractionForm({
      date: new Date().toISOString().slice(0, 10),
      type: 'Neutral',
      summary: '',
      source: 'manual',
      interactionType: 'SUPPORT',
    });
    setEditingInteraction(null);
  }, [staff?.id]);

  const handleAnalyze = async () => {
    if (interactions.length === 0) {
      alert('Please log at least one interaction before running an analysis.');
      return;
    }
    const profile = await analyzeStaffProfile(interactions);
    if (profile) onUpdate({ aiProfile: profile });
  };

  const handleLogInteraction = async () => {
    if (!interactionForm.summary || !interactionForm.date || !interactionForm.interactionType) {
      return;
    }
    const typeKey = (interactionForm.interactionType || '').toUpperCase();
    const buckTag =
      typeKey === 'CHALLENGE' ? 'Challenge' : typeKey === 'SUPPORT' ? 'Support' : 'Admin';

    const payload = {
      date: interactionForm.date,
      type: interactionForm.type || 'Neutral',
      summary: interactionForm.summary,
      source: interactionForm.source || 'manual',
      interactionType: typeKey,
      buckTag,
      staffId: staff?.id,
      staffName: staff?.name,
      userId: user?.uid,
    };

    if (editingInteraction?.id) {
      await updateInteraction(editingInteraction.id, payload);
      setEditingInteraction(null);
    } else {
      await addInteraction(payload);
    }

    setInteractionForm((prev) => ({
      ...prev,
      summary: '',
      date: new Date().toISOString().slice(0, 10),
      interactionType: typeKey,
    }));
  };

  const handleStartEdit = (interaction) => {
    const nextType = (interaction.interactionType || interaction.buckTag || 'ADMIN')
      .toString()
      .toUpperCase();
    const parsedDate = interaction.date?.toDate
      ? interaction.date.toDate().toISOString().slice(0, 10)
      : interaction.date || new Date().toISOString().slice(0, 10);
    setEditingInteraction(interaction);
    setInteractionForm({
      date: parsedDate,
      type: interaction.type || 'Neutral',
      summary: interaction.summary || '',
      source: interaction.source || 'manual',
      interactionType: nextType,
    });
  };

  const handleDeleteInteraction = async (interactionId) => {
    if (window.confirm('Are you sure you want to delete this log?')) {
      await deleteInteraction(interactionId);
    }
  };

  const downloadInteractionHistory = () => {
    if (!interactions.length) {
      alert('No interactions to download yet.');
      return;
    }

    const escapeCsv = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value).replace(/"/g, '""');
      return /[",\n]/.test(str) ? `"${str}"` : str;
    };

    const formatDateForCsv = (value) => {
      if (!value) return '';
      try {
        const d = value?.toDate ? value.toDate() : new Date(value);
        if (Number.isNaN(d.getTime())) return String(value);
        return d.toISOString().slice(0, 10);
      } catch {
        return String(value);
      }
    };

    const rows = interactions.map((i) => {
      const typeKey = (i.interactionType || i.buckTag || 'ADMIN').toString().toUpperCase();
      return [
        formatDateForCsv(i.date),
        i.type || 'Neutral',
        getInteractionTypeMeta(typeKey).label,
        i.summary || '',
        i.source || 'manual',
      ];
    });

    const csv = [
      ['Date', 'Tone', 'Interaction Type', 'Summary', 'Source'].join(','),
      ...rows.map((row) => row.map(escapeCsv).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${staff.name || 'staff'}_interactions.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-140px)]">
      <div className="p-8 border-b border-gray-100 bg-gray-50/30 flex items-center gap-6">
        <button
          onClick={onBack}
          className="p-3 bg-white hover:bg-indigo-50 rounded-full transition-colors border border-gray-200 shadow-sm group"
        >
          <ArrowLeft size={20} className="text-gray-500 group-hover:text-indigo-600" />
        </button>
        <div>
          <h2 className="text-3xl font-bold text-gray-800">{staff.name}</h2>
          <p className="text-gray-500 font-medium">
            {staff.role} • {staff.initials}
          </p>
        </div>
        <div className="ml-auto flex bg-gray-100 p-1.5 rounded-2xl border border-gray-200">
          {['profile', 'schedule'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold capitalize transition-all ${
                activeSubTab === tab ? 'bg-white shadow-md text-indigo-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 bg-gray-50/30">
        {activeSubTab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wider mb-3">
                  Log Interaction
                </h4>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase text-gray-500 tracking-wider">
                      Date
                    </label>
                    <input
                      type="date"
                      value={interactionForm.date}
                      onChange={(e) =>
                        setInteractionForm((prev) => ({ ...prev, date: e.target.value }))
                      }
                      className="p-2.5 rounded-xl border border-gray-200 text-sm bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase text-gray-500 tracking-wider">
                      Tone
                    </label>
                    <select
                      value={interactionForm.type}
                      onChange={(e) =>
                        setInteractionForm((prev) => ({ ...prev, type: e.target.value }))
                      }
                      className="p-2.5 rounded-xl border border-gray-200 text-sm bg-white"
                    >
                      <option>Praise</option>
                      <option>Concern</option>
                      <option>Neutral</option>
                    </select>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="text-[11px] font-bold uppercase text-gray-500 tracking-wider mb-2">
                    Interaction Type (required)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {['SUPPORT', 'CHALLENGE', 'ADMIN'].map((type) => {
                      const meta = getInteractionTypeMeta(type);
                      const isActive = interactionForm.interactionType === type;
                      return (
                        <label
                          key={type}
                          className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                            isActive
                              ? `${meta.badgeClass} shadow-sm`
                              : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-200'
                          }`}
                        >
                          <input
                            type="radio"
                            name="interactionType"
                            value={type}
                            checked={isActive}
                            onChange={() =>
                              setInteractionForm((prev) => ({ ...prev, interactionType: type }))
                            }
                            className="sr-only"
                            required
                          />
                          <div className="font-bold text-sm">{meta.label}</div>
                          <div className="text-[11px] leading-snug text-gray-600">
                            {meta.description}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <textarea
                  value={interactionForm.summary}
                  onChange={(e) =>
                    setInteractionForm((prev) => ({ ...prev, summary: e.target.value }))
                  }
                  className="w-full p-3 rounded-xl border border-gray-200 text-sm resize-none bg-gray-50/50"
                  rows={3}
                  placeholder="e.g. 1:1 with Harrie – seemed overloaded by data deadlines."
                />
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={handleLogInteraction}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold"
                  >
                    {editingInteraction ? 'Update Interaction' : 'Save Interaction'}
                  </button>
                  {editingInteraction && (
                    <button
                      onClick={() => {
                        setEditingInteraction(null);
                        setInteractionForm({
                          date: new Date().toISOString().slice(0, 10),
                          type: 'Neutral',
                          summary: '',
                          source: 'manual',
                          interactionType: 'SUPPORT',
                        });
                      }}
                      className="px-4 py-2 rounded-xl bg-gray-200 text-gray-700 text-sm font-bold"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-3 gap-3">
                  <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wider">
                    Interaction History
                  </h4>
                  <button
                    onClick={downloadInteractionHistory}
                    className="flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 hover:bg-white"
                  >
                    <FileText size={16} />
                    Download CSV
                  </button>
                </div>
                <div className="space-y-3 max-h-[40vh] overflow-y-auto custom-scrollbar">
                  {interactions.length === 0 && (
                    <div className="text-xs text-gray-400 italic">No interactions yet.</div>
                  )}
                  {interactions.map((i) => (
                    <div key={i.id} className="p-3 rounded-xl border border-gray-100 bg-gray-50 group relative">
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleStartEdit(i)} className="p-1.5 bg-white rounded-md shadow-sm border border-gray-200 text-gray-500 hover:text-indigo-600"><Pencil size={12} /></button>
                        <button onClick={() => handleDeleteInteraction(i.id)} className="p-1.5 bg-white rounded-md shadow-sm border border-gray-200 text-gray-500 hover:text-red-600"><Trash2 size={12} /></button>
                      </div>
                      <div>
                        <div className="flex justify-between items-center text-[11px] uppercase font-bold text-gray-400">
                          <div className="flex items-center gap-2">
                            <span>{i.type}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full border ${getInteractionTypeMeta(
                                i.interactionType || i.buckTag
                              ).badgeClass}`}
                            >
                              {getInteractionTypeMeta(i.interactionType || i.buckTag).label}
                            </span>
                          </div>
                          <span>{formatDisplayDate(i.date)}</span>
                        </div>
                        <div className="text-sm text-gray-700 mt-1">{i.summary}</div>
                        <div className="text-[10px] text-gray-400">
                          Source: {i.source || 'manual'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
                <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wider mb-3">
                  AI Staff Insights
                </h4>
                <div className="space-y-3 max-h-[30vh] overflow-y-auto custom-scrollbar">
                  {insights.length === 0 && (
                    <div className="text-xs text-gray-400 italic">No AI insights captured yet.</div>
                  )}
                  {insights.map((insight) => (
                    <div key={insight.id} className="p-3 rounded-xl border border-gray-100 bg-gray-50">
                      <div className="flex justify-between text-[11px] uppercase font-bold text-gray-400">
                        <span>{insight.type || 'note'}</span>
                        <span>{formatDisplayDate(insight.date)}</span>
                      </div>
                      <div className="text-sm text-gray-700 mt-1">{insight.summary}</div>
                      {insight.theme && (
                        <div className="text-[11px] text-indigo-600 font-semibold mt-1">
                          Theme: {insight.theme}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
        </div>
        <div className="space-y-6">
          {staff.aiProfile ? (
            <div className="animate-in fade-in slide-in-from-right-8 duration-500 space-y-6">
              <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wider">
                    Analysis Summary
                  </h4>
                  <span
                    className={`px-4 py-1.5 rounded-full text-xs font-bold border-2 ${getDiscColor(
                      staff.aiProfile.primaryColor
                    )} ${getSecondaryDiscColor(staff.aiProfile.secondaryColor)}`}
                    title={`Primary: ${staff.aiProfile.primaryColor}, Secondary: ${staff.aiProfile.secondaryColor || 'None'}`}
                  >
                    {staff.aiProfile.primaryColor}
                    {staff.aiProfile.secondaryColor && (
                      <span className="opacity-60">
                        /{staff.aiProfile.secondaryColor.charAt(0)}
                      </span>
                    )}
                  </span>
                </div>
                <p className="text-gray-600 italic leading-relaxed text-lg">
                  {staff.aiProfile.summary}
                </p>
              </div>

              <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
                <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wider mb-3">
                  Communication Tips
                </h4>
                <ul className="space-y-2 text-gray-600 text-sm leading-relaxed list-disc list-inside">
                  {(staff.aiProfile.communicationTips || []).map((tip, i) => (
                    <li key={i}>{tip}</li>
                  ))}
                  {(staff.aiProfile.communicationTips || []).length === 0 && (
                    <li className="text-xs text-gray-400 italic list-none">
                      No tips captured yet.
                    </li>
                  )}
                </ul>
              </div>

              <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
                <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wider mb-3">
                  Strengths
                </h4>
                <div className="flex flex-wrap gap-2">
                  {(staff.aiProfile.strengths || []).map((s, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100"
                    >
                      {s}
                    </span>
                  ))}
                  {(staff.aiProfile.strengths || []).length === 0 && (
                    <span className="text-xs text-gray-400 italic">
                      No strengths captured yet.
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm">
                <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wider mb-3">
                  Areas for Development
                </h4>
                <div className="flex flex-wrap gap-2">
                  {(staff.aiProfile.developmentAreas || []).map((s, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-100"
                    >
                      {s}
                    </span>
                  ))}
                  {(staff.aiProfile.developmentAreas || []).length === 0 && (
                    <span className="text-xs text-gray-400 italic">
                      No development areas captured yet.
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-3xl border border-gray-200 shadow-sm text-gray-400 italic h-full flex flex-col items-center justify-center text-center">
              <Sparkles size={32} className="mb-4 text-gray-300" />
              No AI profile yet.
              <br />
              Log some interactions and click "Run AI Analysis".
            </div>
          )}
          <div className="flex justify-end">
            <button
              onClick={handleAnalyze}
              className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2"
            >
              <Sparkles size={18} /> Run AI Analysis
            </button>
          </div>
        </div>
      </div>
    )}

        {activeSubTab === 'schedule' && (
          <StaffScheduleView user={user} staffId={staff.id} />
        )}
      </div>
    </div>
  );
}

function StaffTimetableEditor({ timetable, onChange }) {
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const today = format(new Date(), 'EEEE');
  const [expandedDay, setExpandedDay] = useState(dayOrder.includes(today) ? today : null);

  const generateTimeSlots = (day) => {
    const slots = [];
    if (day === 'Friday') {
      slots.push({ label: 'Meeting', time: '07:00 - 08:20', subject: '', room: '' });
      let time = new Date();
      time.setHours(8, 20, 0, 0);
      for (let i = 0; i < 11; i++) {
        const startTime = format(time, 'HH:mm');
        time.setMinutes(time.getMinutes() + 20);
        const endTime = format(time, 'HH:mm');
        slots.push({ label: `P${i + 1}`, time: `${startTime} - ${endTime}`, subject: '', room: '' });
      }
    } else {
      slots.push({ label: 'Meeting', time: '07:00 - 08:00', subject: '', room: '' });
      let time = new Date();
      time.setHours(8, 0, 0, 0);
      for (let i = 0; i < 21; i++) {
        const startTime = format(time, 'HH:mm');
        time.setMinutes(time.getMinutes() + 20);
        const endTime = format(time, 'HH:mm');
        slots.push({ label: `P${i + 1}`, time: `${startTime} - ${endTime}`, subject: '', room: '' });
      }
      slots.push({ label: 'Meeting', time: '15:15 - 16:15', subject: '', room: '' });
    }
    return slots;
  };

  const defaultSlots = dayOrder.reduce((acc, day) => {
    acc[day] = generateTimeSlots(day);
    return acc;
  }, {});

  const [local, setLocal] = useState(timetable || {});

  useEffect(() => {
    setLocal(timetable || {});
  }, [timetable]);

  const getSlots = (day) => {
    const raw = local[day];
    if (Array.isArray(raw) && raw.length) return raw;
    return defaultSlots[day].map((slot) => ({ ...slot }));
  };

  const handleUpdate = (day, index, field, value) => {
    setLocal((prev) => {
      const next = { ...prev };
      const slots = [...getSlots(day)];
      slots[index] = { ...slots[index], [field]: value };
      next[day] = slots;
      onChange?.(next);
      return next;
    });
  };

  const toggleFree = (day, index) => {
    setLocal((prev) => {
      const next = { ...prev };
      const slots = [...getSlots(day)];
      const isFree = Boolean(slots[index]?.isFree);
      slots[index] = { ...slots[index], isFree: !isFree };
      next[day] = slots;
      onChange?.(next);
      return next;
    });
  };

  const handleToggleDay = (day) => {
    setExpandedDay((prev) => (prev === day ? null : day));
  };

  return (
    <div className="space-y-2">
      {dayOrder.map((day) => {
        const slots = getSlots(day);
        const isToday = day === today;
        const isExpanded = expandedDay === day;
        return (
          <div
            key={day}
            className={`rounded-3xl border transition-all duration-300 ${
              isToday ? 'bg-indigo-50/50 border-indigo-200' : 'bg-gray-50 border-gray-100'
            }`}
          >
            <button
              onClick={() => handleToggleDay(day)}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="text-sm font-bold text-gray-700 uppercase tracking-wide">{day}</div>
                {isToday && (
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
                    Today
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="text-[11px] text-gray-500 font-semibold">
                  {slots.filter((s) => s.isFree).length} free periods
                </div>
                <ChevronDown
                  size={16}
                  className={`text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                />
              </div>
            </button>
            {isExpanded && (
              <div className="px-4 pb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {slots.map((slot, i) => {
                    const isFree = Boolean(slot.isFree);
                    return (
                      <div
                        key={`${day}-${i}`}
                        className={`rounded-2xl border p-3 flex flex-col gap-2 ${
                          isFree ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-gray-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 uppercase">{slot.label || `P${i + 1}`}</span>
                            <span className="text-xs text-gray-500 font-mono">{slot.time || '—'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleFree(day, i)}
                            className="text-[11px] font-semibold px-2 py-1 rounded-lg border border-gray-200 hover:border-indigo-300 hover:text-indigo-700 transition-colors"
                          >
                            {isFree ? 'Mark busy' : 'Mark free'}
                          </button>
                        </div>
                        <input
                          value={slot.subject || ''}
                          onChange={(e) => handleUpdate(day, i, 'subject', e.target.value)}
                          disabled={isFree}
                          className="w-full p-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none text-sm disabled:bg-gray-100 disabled:opacity-70"
                          placeholder="Subject / class"
                        />
                        <input
                          value={slot.room || ''}
                          onChange={(e) => handleUpdate(day, i, 'room', e.target.value)}
                          disabled={isFree}
                          className="w-full p-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none text-sm disabled:bg-gray-100 disabled:opacity-70"
                          placeholder="Room / notes"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
