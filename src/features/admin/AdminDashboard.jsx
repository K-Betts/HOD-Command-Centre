import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { 
  collection, 
  getDocs, 
  deleteDoc, 
  updateDoc,
  doc,
  query,
  orderBy,
  Timestamp,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import { appId } from '../../config/appConfig';
import { Shield, Users, TrendingUp, Trash2, Plus, X, Activity, Ban, CheckCircle, Mail } from 'lucide-react';
import { TelemetryAnalytics } from './TelemetryAnalytics';
import { AnalyticsView } from './AnalyticsView';
import { FeedbackView } from './FeedbackView';
import { useUserRole } from '../../hooks/useUserRole';

export function AdminDashboard() {
  const [user] = useAuthState(auth);
  const { isAdmin, isSuperAdmin } = useUserRole(user);
  const [activeTab, setActiveTab] = useState('users');
  const [whitelistedUsers, setWhitelistedUsers] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState(
    'Hi,\n\nI have invited you to the HoD Command Centre. You can now log in with your Google account.\n\nLink: https://hod-command-centre.web.app'
  );
  const [actionLoading, setActionLoading] = useState(false);

  // RBAC: allow admins; restrict invite/whitelist management to superadmins.

  // Load legacy whitelist (used as an invite/bootstrap list).
  const loadWhitelist = async () => {
    try {
      const whitelistRef = collection(db, 'whitelistedUsers');
      const snapshot = await getDocs(whitelistRef);
      const users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort by invited date, newest first
      users.sort((a, b) => {
        const dateA = a.invitedAt?.toDate?.() || new Date(0);
        const dateB = b.invitedAt?.toDate?.() || new Date(0);
        return dateB - dateA;
      });
      setWhitelistedUsers(users);
    } catch (error) {
      console.error('[Admin] Failed to load whitelist:', error);
    }
  };

  // Load feedback
  const loadFeedback = async () => {
    try {
      const feedbackRef = collection(db, 'artifacts', appId, 'feedback');
      const q = query(feedbackRef, orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      const feedbackList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setFeedback(feedbackList);
    } catch (error) {
      console.error('[Admin] Failed to load feedback:', error);
    }
  };

  // Load data on mount
  useEffect(() => {
    if (isAdmin) {
      const tasks = [loadFeedback()];
      if (isSuperAdmin) tasks.push(loadWhitelist());
      Promise.all(tasks).finally(() => setLoading(false));
    }
  }, [isAdmin, isSuperAdmin]);

  // Invite user with mailto link workflow
  const handleInviteUser = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }

    setActionLoading(true);
    try {
      // Step A: Write to whitelistedUsers collection
      const emailLower = newEmail.toLowerCase().trim();
      
      // Use email as document ID for easy lookup and to prevent duplicates
      const userDoc = doc(db, 'whitelistedUsers', emailLower);
      await setDoc(userDoc, {
        email: emailLower,
        role: 'user',
        invitedAt: serverTimestamp(),
        invitedBy: user.email
      }, { merge: true }); // merge: true will update if exists, create if not

      // Step B: Create mailto link
      const subject = encodeURIComponent('Invitation to HoD Command Centre');
      const body = encodeURIComponent(inviteMessage);
      const mailtoLink = `mailto:${emailLower}?subject=${subject}&body=${body}`;
      
      // Open default email client
      window.location.href = mailtoLink;

      // Step C: Show success and close modal
      alert('User whitelisted & email draft opened');
      setNewEmail('');
      setInviteMessage(
        'Hi,\n\nI have invited you to the HoD Command Centre. You can now log in with your Google account.\n\nLink: https://hod-command-centre.web.app'
      );
      setShowInviteModal(false);
      await loadWhitelist();
    } catch (error) {
      console.error('[Admin] Failed to invite user:', error);
      alert('Failed to invite user. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete user from whitelist
  const handleDeleteUser = async (userRecord) => {
    if (!confirm(`Remove ${userRecord.email} from whitelist? This cannot be undone.`)) return;

    setActionLoading(true);
    try {
      // Remove from whitelistedUsers collection
      const userDoc = doc(db, 'whitelistedUsers', userRecord.id);
      await deleteDoc(userDoc);
      
      alert('User removed from whitelist successfully');
      await loadWhitelist();
    } catch (error) {
      console.error('[Admin] Failed to delete user:', error);
      alert(`Failed to remove user: ${error.message}`);
    } finally {
      setActionLoading(false);
    }
  };



  // Update feedback status
  const _handleUpdateFeedbackStatus = async (feedbackId, newStatus) => {
    setActionLoading(true);
    try {
      const feedbackDoc = doc(db, 'artifacts', appId, 'feedback', feedbackId);
      await updateDoc(feedbackDoc, {
        status: newStatus,
        updatedAt: Timestamp.now()
      });
      await loadFeedback();
    } catch (error) {
      console.error('[Admin] Failed to update feedback:', error);
      alert('Failed to update feedback status');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete feedback
  const _handleDeleteFeedback = async (feedbackId) => {
    if (!confirm('Delete this feedback?')) return;

    setActionLoading(true);
    try {
      const feedbackDoc = doc(db, 'artifacts', appId, 'feedback', feedbackId);
      await deleteDoc(feedbackDoc);
      await loadFeedback();
    } catch (error) {
      console.error('[Admin] Failed to delete feedback:', error);
      alert('Failed to delete feedback');
    } finally {
      setActionLoading(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <Shield className="mx-auto mb-3 text-red-600" size={48} />
          <h2 className="text-xl font-bold text-red-900 mb-2">Access Denied</h2>
          <p className="text-red-700">This area is restricted to super administrators only.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <div className="text-center py-12">
          <div className="h-12 w-12 mx-auto border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
          <p className="mt-4 text-slate-600">Loading admin data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-red-600 text-white rounded-lg">
            <Shield size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Admin Console</h1>
            <p className="text-sm text-slate-500">Manage access and monitor system usage</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 font-semibold transition-all border-b-2 ${
            activeTab === 'users'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users size={16} />
            User Management
          </div>
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 font-semibold transition-all border-b-2 ${
            activeTab === 'analytics'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <TrendingUp size={16} />
            Analytics
          </div>
        </button>
        <button
          onClick={() => setActiveTab('telemetry')}
          className={`px-4 py-2 font-semibold transition-all border-b-2 ${
            activeTab === 'telemetry'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Activity size={16} />
            Telemetry
          </div>
        </button>
        <button
          onClick={() => setActiveTab('feedback')}
          className={`px-4 py-2 font-semibold transition-all border-b-2 ${
            activeTab === 'feedback'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Activity size={16} />
            Feedback
            {feedback.filter(f => f.status === 'new').length > 0 && (
              <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {feedback.filter(f => f.status === 'new').length}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-900">Whitelisted Users</h2>
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all font-semibold inline-flex items-center gap-2"
              disabled={actionLoading}
            >
              <Plus size={16} />
              Invite User
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {whitelistedUsers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-600 font-semibold">No whitelisted users yet</p>
                <p className="text-sm text-slate-500">Use "Invite User" to add someone</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Invited Date</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {whitelistedUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 bg-slate-200 rounded-full flex items-center justify-center">
                            <Users className="text-slate-600" size={16} />
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-semibold text-slate-900">{u.email}</p>
                            {u.invitedBy && (
                              <p className="text-xs text-slate-500">Invited by {u.invitedBy}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded uppercase">
                          {u.role || 'user'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {u.invitedAt?.toDate?.()?.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteUser(u)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all inline-flex items-center gap-1"
                          title="Remove from whitelist"
                          disabled={actionLoading}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Telemetry Tab */}
      {activeTab === 'telemetry' && <TelemetryAnalytics />}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && <AnalyticsView />}

      {/* Feedback Tab */}
      {activeTab === 'feedback' && <FeedbackView />}

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Invite User</h3>
                <p className="text-sm text-slate-500 mt-1">Add user to whitelist and send invitation</p>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-all"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Email Input */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Email Address <span className="text-red-600">*</span>
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Message Textarea */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Invitation Message
                </label>
                <textarea
                  value={inviteMessage}
                  onChange={(e) => setInviteMessage(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent font-mono text-sm"
                  placeholder="Enter invitation message..."
                />
                <p className="text-xs text-slate-500 mt-1">
                  This message will be pre-filled in your email client
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowInviteModal(false)}
                className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition-all font-semibold"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleInviteUser}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all font-semibold flex items-center justify-center gap-2"
                disabled={actionLoading || !newEmail}
              >
                {actionLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail size={16} />
                    Send Invite
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End of modals */}
    </div>
  );
}

