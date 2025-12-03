import React, { useMemo, useState } from 'react';
import { MessageSquare, Sparkles, Users, User, Mail, Megaphone } from 'lucide-react';
import { rewriteCommunication } from '../../services/ai';
import { useToast } from '../../context/ToastContext';

const audienceOptions = [
  { id: 'parent', label: 'Parent / Guardian', description: 'Calm, clear and empathetic', icon: User },
  { id: 'whole-school', label: 'Whole School', description: 'Concise, all-staff clarity', icon: Megaphone },
  { id: 'whole-team', label: 'Whole Team', description: 'Supportive, collaborative', icon: Users },
  { id: 'staff', label: 'Individual Team Member', description: 'Tailor to their style', icon: Mail },
];

const toneByAudience = {
  parent: 'Warm, calm, and reassuring',
  'whole-school': 'Professional, concise, and action-oriented',
  'whole-team': 'Supportive, collaborative, and clear on asks',
  staff: 'Professional, collegial, and direct but kind',
};

const tonePresets = [
  { id: 'auto', label: 'Auto (recommended)', tone: null, helper: 'Use the default tone for this audience.' },
  { id: 'warm', label: 'Warm & empathetic', tone: 'Warm, empathetic, and reassuring' },
  { id: 'formal', label: 'Formal & professional', tone: 'Formal, professional, and courteous' },
  { id: 'concise', label: 'Concise & direct', tone: 'Concise, direct, and action-oriented' },
  { id: 'assertive', label: 'Assertive but respectful', tone: 'Assertive, clear on boundaries, and respectful' },
  { id: 'custom', label: 'Custom tone', tone: null, helper: 'Enter your own tone below.' },
];

const guidanceByAudience = {
  parent: 'Avoid jargon, show empathy, and be clear on next steps and support.',
  'whole-school': 'Get to the point quickly. Highlight actions, dates, and ownership.',
  'whole-team': 'Acknowledge workload, celebrate wins, and clarify responsibilities.',
  staff: 'Be specific about expectations while staying respectful and collaborative.',
};

export function CommunicationShield({ staff = [] }) {
  const [draft, setDraft] = useState('');
  const [audienceType, setAudienceType] = useState('parent');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [audienceNotes, setAudienceNotes] = useState('');
  const [toneChoice, setToneChoice] = useState('auto');
  const [customTone, setCustomTone] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { addToast } = useToast();

  const handleAudienceChange = (id) => {
    setAudienceType(id);
    if (id !== 'staff') setSelectedStaffId('');
  };

  const selectedStaff = useMemo(
    () => staff.find((m) => m.id === selectedStaffId),
    [selectedStaffId, staff]
  );

  const currentTone = toneByAudience[audienceType] || 'Professional';
  const effectiveTone = useMemo(() => {
    if (toneChoice === 'auto') return currentTone;
    if (toneChoice === 'custom') return customTone.trim() || currentTone;
    const preset = tonePresets.find((p) => p.id === toneChoice);
    return preset?.tone || currentTone;
  }, [toneChoice, customTone, currentTone]);
  const audienceLabel =
    audienceOptions.find((o) => o.id === audienceType)?.label || 'Audience';

  const buildAudienceContext = () => {
    const guidance = guidanceByAudience[audienceType] || 'Keep it concise, clear, and respectful.';
    const lines = [
      `Audience: ${audienceLabel}`,
      guidance,
    ];

    if (audienceType === 'whole-team') {
      lines.push('This goes to the department team. Keep it collegial.');
    }

    if (audienceType === 'whole-school') {
      lines.push('This goes to all staff. Keep it concise with clear actions.');
    }

    if (audienceType === 'parent') {
      lines.push('Assume limited school jargon and offer reassurance plus next steps.');
    }

    if (audienceType === 'staff' && selectedStaff) {
      lines.push(
        `Individual: ${selectedStaff.name} (${selectedStaff.role || 'Team member'})`
      );
      if (selectedStaff.yearGroups?.length) {
        lines.push(`Teaches years: ${selectedStaff.yearGroups.join(', ')}`);
      }
      if (selectedStaff.aiProfile?.summary) {
        lines.push(`Profile: ${selectedStaff.aiProfile.summary}`);
      }
      const staffTips = selectedStaff.aiProfile?.communicationTips;
      if (Array.isArray(staffTips) && staffTips.length) {
        lines.push(`Communication tips: ${staffTips.join('; ')}`);
      } else if (typeof staffTips === 'string' && staffTips.trim()) {
        lines.push(`Communication tips: ${staffTips}`);
      }
    }

    if (audienceNotes) {
      lines.push(`Notes from HoD: ${audienceNotes}`);
    }

    return lines.filter(Boolean).join('\n');
  };

  const handleProcess = async () => {
    if (!draft) return;
    if (audienceType === 'staff' && !selectedStaffId) return;
    setLoading(true);
    setError('');
    const tone = effectiveTone;
    const audienceContext = buildAudienceContext();
    const res = await rewriteCommunication(draft, tone, audienceContext);
    if (!res || res.toLowerCase().includes('error')) {
      setError('Could not polish this message. Please try again.');
      setResult('');
      addToast('error', 'AI polishing failed');
    } else {
      setResult(res);
      addToast('success', 'Draft polished for this audience');
    }
    setLoading(false);
  };

  const canProcess =
    Boolean(draft) && !(audienceType === 'staff' && !selectedStaffId) && !loading;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-140px)]">
      <div className="bg-white p-8 rounded-[2.5rem] border border-gray-200 shadow-sm flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800 text-xl flex items-center gap-2">
            <MessageSquare className="text-indigo-600" /> Communication Shield
          </h3>
          <div className="text-[11px] font-bold px-3 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
            Audience aware
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm font-semibold">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {audienceOptions.map((option) => {
            const Icon = option.icon;
            const isActive = audienceType === option.id;
            return (
              <button
                key={option.id}
                onClick={() => handleAudienceChange(option.id)}
                className={`flex items-start gap-3 p-4 rounded-2xl border text-left transition-all ${
                  isActive
                    ? 'border-indigo-200 bg-indigo-50 shadow-sm'
                    : 'border-gray-200 hover:border-indigo-100 bg-white'
                }`}
              >
                <div
                  className={`p-2 rounded-xl ${
                    isActive ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <Icon size={18} />
                </div>
                <div className="flex-1">
                  <div
                    className={`font-bold ${
                      isActive ? 'text-indigo-800' : 'text-gray-800'
                    }`}
                  >
                    {option.label}
                  </div>
                  <div className="text-sm text-gray-500">{option.description}</div>
                </div>
              </button>
            );
          })}
        </div>

        {audienceType === 'staff' && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              Pick a team member
            </label>
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="w-full p-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-indigo-100 outline-none"
            >
              <option value="">Select from Staff Room...</option>
              {staff.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.role ? `(${m.role})` : ''}
                </option>
              ))}
            </select>
            {selectedStaff?.aiProfile?.summary && (
              <div className="text-sm text-gray-600 bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                <div className="font-semibold text-indigo-800">
                  Profile cue: {selectedStaff.aiProfile.primaryColor}
                  {selectedStaff.aiProfile.secondaryColor
                    ? `/${selectedStaff.aiProfile.secondaryColor}`
                    : ''}
                </div>
                <div className="text-gray-600">
                  {selectedStaff.aiProfile.summary}
                </div>
              </div>
            )}
            {!selectedStaffId && (
              <div className="text-xs text-amber-600 font-semibold">
                Select a person to personalise the rewrite.
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            Notes about the audience
          </label>
          <textarea
            value={audienceNotes}
            onChange={(e) => setAudienceNotes(e.target.value)}
            className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none resize-none"
            rows={3}
            placeholder="e.g. Sensitive situation, avoid jargon. Wants clear next steps."
          />
        </div>

        <div className="flex items-center justify-between">
          <h4 className="font-bold text-gray-800 text-lg">Draft Input</h4>
          <div className="text-xs font-bold text-gray-500">
            Tone: <span className="text-indigo-600">{effectiveTone}</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            Tone controls
          </label>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {tonePresets.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setToneChoice(opt.id)}
                className={`p-3 rounded-xl border text-left text-sm transition-all ${
                  toneChoice === opt.id
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-800 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-indigo-100'
                }`}
                type="button"
              >
                <div className="font-semibold">{opt.label}</div>
                {opt.helper && (
                  <div className="text-[11px] text-gray-500">{opt.helper}</div>
                )}
              </button>
            ))}
          </div>
          {toneChoice === 'custom' && (
            <input
              value={customTone}
              onChange={(e) => setCustomTone(e.target.value)}
              className="w-full p-3 rounded-xl border border-indigo-200 bg-white focus:ring-2 focus:ring-indigo-100 outline-none text-sm"
              placeholder="e.g. Calm, empathetic, and fact-focused"
            />
          )}
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="flex-1 w-full p-6 rounded-2xl bg-gray-50 border border-gray-200 outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 resize-none text-lg leading-relaxed"
          placeholder="Type your draft here..."
        />
        <button
          onClick={handleProcess}
          disabled={!canProcess}
          className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
        >
          {loading ? 'Polishing...' : 'Polish for this audience'}
        </button>
      </div>
      <div className="bg-gradient-to-br from-indigo-900 to-gray-900 p-8 rounded-[2.5rem] shadow-2xl flex flex-col text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-10">
          <Sparkles size={200} />
        </div>
        <h3 className="font-bold text-xl mb-6 relative z-10 flex items-center gap-2">
          <Sparkles className="text-amber-400" /> Polished Output
        </h3>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4 relative z-10">
          <div className="text-[11px] uppercase font-bold text-amber-200 mb-1">
            Audience context
          </div>
          <div className="text-sm text-white font-semibold">
            {audienceLabel}
          </div>
          <div className="text-xs text-indigo-100 mt-1">
            {guidanceByAudience[audienceType] || 'We will keep this concise, clear, and respectful.'}
          </div>
          <div className="text-[11px] text-amber-100 mt-2">
            Tone applied: {effectiveTone}
          </div>
          {selectedStaff && (
            <div className="text-xs text-indigo-100 mt-2">
              Personalising for {selectedStaff.name}
              {selectedStaff.role ? ` (${selectedStaff.role})` : ''}.
            </div>
          )}
          {audienceNotes && (
            <div className="text-xs text-indigo-100 mt-2">
              Notes: {audienceNotes}
            </div>
          )}
        </div>
        <div className="flex-1 bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/10 overflow-y-auto relative z-10 leading-relaxed text-lg font-light">
          {result || (
            <span className="opacity-30 italic">
              Polished version will appear here...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
