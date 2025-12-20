import React, { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { appId } from '../../config/appConfig';
import { AlertTriangle, Bug, CheckCircle, Loader2, MessageSquare } from 'lucide-react';

export function FeedbackView() {
  const [activeSubTab, setActiveSubTab] = useState('crash'); // 'crash' | 'suggestions'
  const [loading, setLoading] = useState(true);
  const [crashReports, setCrashReports] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState(null);
  const [selectedCrash, setSelectedCrash] = useState(null);

  // Helpers
  const formatTime = (ts) => {
    try {
      const d = ts?.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleString();
    } catch {
      return 'N/A';
    }
  };
  const truncate = (s, n = 90) => {
    if (!s) return 'N/A';
    return s.length > n ? s.slice(0, n) + '…' : s;
  };

  useEffect(() => {
    const fetchFeedback = async () => {
      setLoading(true);
      setError(null);
      try {
        const feedbackRef = collection(db, 'artifacts', appId, 'feedback');

        // Crash Reports (type == 'CRASH_REPORT')
        const crashQ = query(
          feedbackRef,
          where('type', '==', 'CRASH_REPORT'),
          orderBy('timestamp', 'desc'),
          limit(500)
        );
        const crashSnap = await getDocs(crashQ);
        const crashes = crashSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setCrashReports(crashes);

        // Suggestions (two queries to avoid Firestore 'in' indexing complexities)
        const suggQ = query(
          feedbackRef,
          where('type', '==', 'SUGGESTION'),
          orderBy('timestamp', 'desc'),
          limit(500)
        );
        const genQ = query(
          feedbackRef,
          where('type', '==', 'FEEDBACK'),
          orderBy('timestamp', 'desc'),
          limit(500)
        );
        const [suggSnap, genSnap] = await Promise.all([getDocs(suggQ), getDocs(genQ)]);
        const suggs = [
          ...suggSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
          ...genSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        ].sort((a, b) => {
          const aD = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
          const bD = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
          return bD - aD;
        });
        setSuggestions(suggs);
      } catch (e) {
        console.error('[Feedback] Failed to fetch:', e);
        setError(e?.message || 'Failed to load feedback');
      } finally {
        setLoading(false);
      }
    };

    fetchFeedback();
  }, []);

  const toggleSuggestionStatus = async (item) => {
    try {
      const newStatus = (item.status || 'New') === 'New' ? 'Reviewing' : 'New';
      const itemDoc = doc(db, 'artifacts', appId, 'feedback', item.id);
      await updateDoc(itemDoc, { status: newStatus, updatedAt: new Date() });
      setSuggestions((prev) => prev.map((s) => (s.id === item.id ? { ...s, status: newStatus } : s)));
    } catch (e) {
      console.error('[Feedback] Failed to update status:', e);
      alert('Failed to update status.');
    }
  };

  const CrashRow = ({ report }) => (
    <tr
      className="hover:bg-slate-50 cursor-pointer"
      onClick={() => setSelectedCrash(report)}
    >
      <td className="px-3 py-2">
        <span className="px-2 py-0.5 text-xs font-bold rounded bg-red-100 text-red-700">Critical</span>
      </td>
      <td className="px-3 py-2 text-sm text-slate-800">
        {report.email || report.uid || 'Unknown'}
      </td>
      <td className="px-3 py-2 text-sm text-slate-700">{report.route || report.path || 'N/A'}</td>
      <td className="px-3 py-2 text-sm text-slate-700">
        {truncate(report.errorMessage || report.message || report.error)}
      </td>
      <td className="px-3 py-2 text-sm text-slate-500">{formatTime(report.timestamp)}</td>
    </tr>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto text-slate-400" size={32} />
          <p className="text-slate-600 mt-3">Loading feedback & logs…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveSubTab('crash')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeSubTab === 'crash'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Bug size={16} /> Crash Reports
        </button>
        <button
          onClick={() => setActiveSubTab('suggestions')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeSubTab === 'suggestions'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <MessageSquare size={16} /> User Suggestions
        </button>
      </div>

      {/* Crash Reports Table */}
      {activeSubTab === 'crash' && (
        <div className="bg-white rounded-xl border border-slate-200">
          {crashReports.length === 0 ? (
            <div className="py-16 text-center">
              <Bug className="mx-auto mb-2 text-slate-400" size={28} />
              <p className="text-slate-600 font-medium">No crash reports</p>
              <p className="text-sm text-slate-500">Great! No critical errors logged.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold text-slate-600 uppercase tracking-wide text-xs">Severity</th>
                    <th className="px-3 py-2 text-left font-bold text-slate-600 uppercase tracking-wide text-xs">User</th>
                    <th className="px-3 py-2 text-left font-bold text-slate-600 uppercase tracking-wide text-xs">Route</th>
                    <th className="px-3 py-2 text-left font-bold text-slate-600 uppercase tracking-wide text-xs">Error</th>
                    <th className="px-3 py-2 text-left font-bold text-slate-600 uppercase tracking-wide text-xs">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {crashReports.map((r) => (
                    <CrashRow key={r.id} report={r} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Suggestions Cards */}
      {activeSubTab === 'suggestions' && (
        <div className="space-y-3">
          {suggestions.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <MessageSquare className="mx-auto mb-2 text-slate-400" size={28} />
              <p className="text-slate-600 font-medium">No user suggestions</p>
              <p className="text-sm text-slate-500">Encourage users to submit feedback!</p>
            </div>
          ) : (
            suggestions.map((s) => (
              <div key={s.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-xs font-bold rounded bg-indigo-100 text-indigo-700">
                      {s.status || 'New'}
                    </span>
                    <span className="text-xs text-slate-500">{formatTime(s.timestamp)}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{s.title || 'User Suggestion'}</p>
                  <p className="text-sm text-slate-700 whitespace-pre-line">{s.message || s.text || s.description}</p>
                  <p className="text-xs text-slate-500">From: {s.email || s.uid || 'Anonymous'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleSuggestionStatus(s)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700"
                    title="Toggle status"
                  >
                    Toggle Status
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Crash Report Modal */}
      {selectedCrash && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-red-600" size={20} />
                <h3 className="text-lg font-bold text-slate-900">Crash Report Details</h3>
              </div>
              <button
                onClick={() => setSelectedCrash(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">User</p>
                <p className="text-sm font-semibold text-slate-900">{selectedCrash.email || selectedCrash.uid || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Route</p>
                <p className="text-sm font-semibold text-slate-900">{selectedCrash.route || selectedCrash.path || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Time</p>
                <p className="text-sm font-semibold text-slate-900">{formatTime(selectedCrash.timestamp)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Error</p>
                <p className="text-sm font-semibold text-red-700">{selectedCrash.errorMessage || selectedCrash.message || selectedCrash.error || 'N/A'}</p>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Stack Trace</p>
              <pre className="bg-slate-50 border border-slate-200 rounded-xl p-4 overflow-auto text-xs text-slate-800 whitespace-pre-wrap">
                {selectedCrash.stackTrace || selectedCrash.stack || 'No stack trace provided'}
              </pre>
            </div>

            <div className="mt-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Component Stack</p>
              <pre className="bg-slate-50 border border-slate-200 rounded-xl p-4 overflow-auto text-xs text-slate-800 whitespace-pre-wrap">
                {selectedCrash.componentStack || 'No component stack provided'}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

