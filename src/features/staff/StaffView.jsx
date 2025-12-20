import React, { useState } from 'react';
import { Plus, Presentation, Trash2, Users } from 'lucide-react';
import LeadershipView from '../leadership/LeadershipView';
import { useStaff } from '../../hooks/useStaff';
import { useTasks } from '../../hooks/useTasks';
import { useContextData } from '../../hooks/useContextData';
import { useBuckBalance } from '../../hooks/useBuckBalance';
import { BrainCard } from '../../components/ui/BrainCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useStrategy } from '../../hooks/useStrategy';
import { getDiscHex, pickBalanceBadge } from './staffUtils';
import { MeetingFinderView } from './components/MeetingFinderView';
import { TeamMeetingView } from './components/TeamMeetingView';
import { StaffDetailView } from './components/StaffDetailView';

export function StaffView({ user, setActiveTab }) {
  const { staff, addStaff, deleteStaff, updateStaff } = useStaff(user);
  const { tasks } = useTasks(user);
  const { context } = useContextData(user);
  const { balanceByStaff } = useBuckBalance(user, staff);
  const { plan } = useStrategy(user);
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
        onBack={() => setSelectedStaff(null)}
        onUpdate={(data) => updateStaff(current.id, data)}
        user={user}
        strategyPriorities={plan?.priorities || []}
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
