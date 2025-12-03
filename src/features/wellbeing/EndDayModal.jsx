import React, { useMemo, useState } from 'react';
import { Sunset, Sparkles } from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { analyzeBrainDump } from '../../services/ai';
import { useWellbeing } from '../../hooks/useWellbeing';
import { useTasks } from '../../hooks/useTasks';
import { db } from '../../services/firebase';
import { appId } from '../../config/appConfig';
import { createTaskFingerprint } from '../tasks/TaskBoard';
import {
  fingerprintEvent,
  fingerprintInsight,
  fingerprintStrategyNote,
  fetchRecentStaffInsightFingerprints,
  fetchRecentStrategyNoteFingerprints,
} from '../../utils/fingerprints';
import { applyContextTags } from '../../utils/taskContext';

export function EndDayModal({ user, staff, context, updateContext, onClose }) {
  const { addLog } = useWellbeing(user);
  const { tasks, addTask } = useTasks(user);
  const [mood, setMood] = useState(null);
  const [energy, setEnergy] = useState('Medium');
  const [reflection, setReflection] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const taskFingerprints = useMemo(() => {
    const list = Array.isArray(tasks) ? tasks : [];
    return new Set(list.map((t) => t.fingerprint || createTaskFingerprint(t)));
  }, [tasks]);

  const eventFingerprints = useMemo(() => {
    const events = Array.isArray(context?.events) ? context.events : [];
    return new Set(events.map(fingerprintEvent));
  }, [context?.events]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!mood || isProcessing) return;
    setIsProcessing(true);

    try {
      const moodLabel = mood;
      const todayIso = new Date().toISOString().slice(0, 10);
      await addLog({
        mood: moodLabel,
        energy,
        summary: reflection.slice(0, 120) || '(No reflection)',
        tags: [],
        date: todayIso,
        createdAt: serverTimestamp(),
      });

      if (reflection.trim()) {
        const aiResponse = await analyzeBrainDump(reflection, staff, context || {});
        const staffInsightFingerprints = await fetchRecentStaffInsightFingerprints(user);
        const strategyNoteFingerprints = await fetchRecentStrategyNoteFingerprints(user);

        if (aiResponse && Array.isArray(aiResponse.tasks)) {
          const newTasks = aiResponse.tasks.filter((t) => {
            const fp = createTaskFingerprint(t);
            return fp && !taskFingerprints.has(fp);
          }).map((task) => applyContextTags(task));
          for (const t of newTasks) {
            await addTask({
              ...t,
              status: 'todo',
              originalSource: 'end-day',
              fingerprint: createTaskFingerprint(t),
              createdAt: serverTimestamp(),
            });
          }
        }

        if (aiResponse && Array.isArray(aiResponse.staffInsights)) {
          const insightsToSave = aiResponse.staffInsights.filter((insight) => {
            const fp = fingerprintInsight(insight);
            return fp && !staffInsightFingerprints.has(fp);
          });
          for (const insight of insightsToSave) {
            await addDoc(
              collection(db, 'artifacts', appId, 'users', user.uid, 'staffInsights'),
              {
                ...insight,
                fingerprint: fingerprintInsight(insight),
                createdAt: serverTimestamp(),
              }
            );
          }
        }

        if (aiResponse && Array.isArray(aiResponse.calendarEvents)) {
          const newEvents = aiResponse.calendarEvents.filter((evt) => {
            const fp = fingerprintEvent(evt);
            return fp && !eventFingerprints.has(fp);
          });
          if (newEvents.length && updateContext) {
            const merged = [...(context?.events || []), ...newEvents];
            await updateContext({ ...(context || {}), events: merged });
          }
        }

        if (aiResponse && Array.isArray(aiResponse.strategyNotes)) {
          const notesToSave = aiResponse.strategyNotes.filter((note) => {
            const fp = fingerprintStrategyNote(note);
            return fp && !strategyNoteFingerprints.has(fp);
          });
          for (const note of notesToSave) {
            await addDoc(
              collection(db, 'artifacts', appId, 'users', user.uid, 'strategyNotes'),
              {
                ...note,
                fingerprint: fingerprintStrategyNote(note),
                createdAt: serverTimestamp(),
              }
            );
          }
        }
      }

      onClose();
    } catch (err) {
      console.error('End day failed', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-[2.5rem] p-6 w-full max-w-xl shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Sunset className="text-orange-400" size={20} />
            End Day
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase mb-2">Mood</div>
            <div className="flex gap-3">
              {['Tough', 'Okay', 'Great'].map((m) => (
                <button
                  key={m}
                  onClick={() => setMood(m)}
                  className={`flex-1 p-3 rounded-2xl border-2 text-sm font-bold ${
                    mood === m ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-100 text-gray-500'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-bold text-gray-500 uppercase mb-2">Energy</div>
            <select
              value={energy}
              onChange={(e) => setEnergy(e.target.value)}
              className="w-full p-3 rounded-2xl border border-gray-200 text-sm"
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-gray-500 uppercase">Reflection</span>
              <span className="text-[10px] text-gray-400">
                Sent to AI for tasks/notes <Sparkles size={12} className="inline text-amber-500" />
              </span>
            </div>
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              className="w-full p-4 rounded-2xl border border-gray-200 min-h-[140px] text-sm"
              placeholder="What happened today? Anything for tomorrow?"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-gray-500 hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!mood || isProcessing}
            className="px-5 py-2 rounded-xl bg-gray-900 text-white font-bold hover:bg-gray-800 disabled:opacity-50"
          >
            {isProcessing ? 'Saving…' : 'End Day'}
          </button>
        </div>
      </div>
    </div>
  );
}
