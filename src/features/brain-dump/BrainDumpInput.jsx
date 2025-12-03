import React, { useState } from 'react';
import { Brain, Plus, Wand2 } from 'lucide-react';
import { analyzeBrainDump } from '../../services/ai';
import { useStaff } from '../../hooks/useStaff';
import { IngestionReviewModal } from './IngestionReviewModal';

export function BrainDumpInput({ user, staff, context, updateContext, compact = false }) {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [rawAiText, setRawAiText] = useState('');
  const [error, setError] = useState('');
  const { logInteraction } = useStaff(user);

  const handleDump = async (e) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    setIsProcessing(true);
    setError('');

    try {
      const aiResponse = await analyzeBrainDump(input, staff, context || {});
      const safeResponse = applyChallengeOverrides(aiResponse || {}, input);
      setReviewData(safeResponse);
      setRawAiText(
        typeof safeResponse.rawText === 'string' && safeResponse.rawText.trim()
          ? safeResponse.rawText.trim()
          : input
      );
      setIsReviewOpen(true);
      setInput('');
    } catch (err) {
      console.error('Error handling brain dump:', err);
      setError('Something went wrong capturing this note. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloseReview = () => {
    setIsReviewOpen(false);
    setReviewData(null);
    setRawAiText('');
  };

  const handleApproveReview = async (payload) => {
    if (!logInteraction) return;
    const insights =
      (payload && (payload.staffInsights || payload.insights)) ||
      reviewData?.staffInsights ||
      reviewData?.insights ||
      [];
    if (!Array.isArray(insights) || insights.length === 0) return;

    const staffList = Array.isArray(staff) ? staff : [];
    const todayIso = new Date().toISOString().slice(0, 10);

    for (const insight of insights) {
      const notes = insight.summary || insight.notes || insight.text || '';
      if (!notes) continue;

      const normalizedType =
        (insight.type || '').toLowerCase().includes('challenge') ? 'Challenge' : 'Support';

      const matchedStaff =
        staffList.find(
          (member) =>
            member?.id === insight.staffId ||
            (member?.name && insight.staffName && member.name.toLowerCase() === insight.staffName.toLowerCase())
        ) || {};
      const staffId = insight.staffId || matchedStaff.id;
      if (!staffId) continue;

      try {
        await logInteraction(staffId, {
          type: normalizedType,
          summary: notes,
          source: 'brain-dump',
          staffName: insight.staffName || matchedStaff.name || '',
          date: insight.date || todayIso,
          buckTag: normalizedType,
          interactionType: normalizedType.toUpperCase(),
          academicYear: insight.academicYear,
        });
      } catch (interactionErr) {
        console.error('Failed to log staff interaction from insight', interactionErr);
      }
    }
  };

  return (
    <div
      className={`${
        compact ? 'bg-indigo-50 border-indigo-100' : 'bg-white border-gray-200'
      } border rounded-2xl p-6 shadow-sm`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-indigo-800 font-bold">
          <Brain className="w-5 h-5" />
          <h3>AI Brain Dump</h3>
        </div>
        {isProcessing && (
          <span className="text-xs text-indigo-600 animate-pulse font-medium">
            Processing...
          </span>
        )}
      </div>
      <form onSubmit={handleDump} className="relative">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isProcessing}
          placeholder="Paste emails, meeting minutes, or messy notes here..."
          className="w-full rounded-xl border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 min-h-[80px] pr-12 p-4 text-gray-700 placeholder:text-gray-400 bg-white disabled:opacity-50"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleDump(e);
            }
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || isProcessing}
          className="absolute right-3 bottom-3 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
        >
          {isProcessing ? <Wand2 className="animate-spin" size={20} /> : <Plus size={20} />}
        </button>
      </form>

      {error && (
        <div className="mt-3 text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-3">
          {error}
        </div>
      )}

      <IngestionReviewModal
        isOpen={isReviewOpen}
        aiResult={reviewData}
        rawText={rawAiText || reviewData?.rawText}
        staff={staff}
        user={user}
        context={context}
        updateContext={updateContext}
        onApprove={handleApproveReview}
        onClose={handleCloseReview}
      />
    </div>
  );
}

function applyChallengeOverrides(aiResult) {
  const keywords = ['deadline', 'late', 'due', 'missed', 'ensure', 'must', 'review'];
  const forceChallenge = (insight = {}) => {
    const text = `${insight.summary || ''} ${insight.notes || ''} ${insight.text || ''}`.toLowerCase();
    const shouldForce = keywords.some((kw) => text.includes(kw));
    if (!shouldForce) return insight;
    return {
      ...insight,
      type: 'Challenge',
      interactionType: 'Challenge',
      buckTag: 'Challenge',
    };
  };

  const staffInsights = Array.isArray(aiResult.staffInsights)
    ? aiResult.staffInsights.map(forceChallenge)
    : [];
  const insights = Array.isArray(aiResult.insights)
    ? aiResult.insights.map(forceChallenge)
    : undefined;

  return {
    ...aiResult,
    staffInsights,
    ...(insights ? { insights } : {}),
  };
}
