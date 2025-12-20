import React, { useState } from 'react';
import { ChevronLeft, FileText, Sparkles, Target } from 'lucide-react';
import { generateAgenda } from '../../../services/ai';

export function TeamMeetingView({ staff, onBack }) {
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
