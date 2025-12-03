import React, { useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, signIn, signOut } from '../services/firebase';

export function AuthGate({ children }) {
  const [user, loading, error] = useAuthState(auth);
  const [authError, setAuthError] = useState(null);

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signIn();
    } catch (err) {
      console.error('Google sign-in failed', err);
      setAuthError('Sign-in failed. Please try again.');
    }
  };

  const handleSignOut = async () => {
    setAuthError(null);
    try {
      await signOut();
    } catch (err) {
      console.error('Sign-out failed', err);
      setAuthError('Sign-out failed. Please try again.');
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700">
        <div className="text-center space-y-3">
          <div className="h-12 w-12 mx-auto border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-sm font-semibold tracking-wide uppercase">
            Loading secure session...
          </p>
        </div>
      </div>
    );

  if (!user)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-slate-100">
        <div className="bg-white shadow-2xl border border-slate-200 rounded-3xl p-10 max-w-md w-full text-center space-y-6">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
              Secure Access
            </p>
            <h1 className="text-2xl font-bold text-slate-900">
              Head of Department Command Centre
            </h1>
            <p className="text-sm text-slate-500">
              Sign in with your Google account to continue.
            </p>
          </div>
          {(error || authError) && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
              {authError || error?.message}
            </div>
          )}
          <button
            onClick={handleSignIn}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 text-lg font-semibold bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-500 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M21.6 12.227c0-.638-.057-1.252-.163-1.84H12v3.48h5.381a4.6 4.6 0 0 1-2 3.018v2.508h3.24c1.894-1.743 2.979-4.307 2.979-7.166Z" />
              <path d="M12 22c2.7 0 4.964-.894 6.618-2.426l-3.24-2.508c-.9.6-2.049.95-3.378.95-2.6 0-4.804-1.758-5.588-4.114H3.04v2.59A9.999 9.999 0 0 0 12 22Z" />
              <path d="M6.412 13.902A6.001 6.001 0 0 1 6.09 12c0-.66.114-1.302.322-1.902V7.508H3.04A9.999 9.999 0 0 0 2 12c0 1.645.394 3.2 1.04 4.492z" />
              <path d="M12 6.5c1.467 0 2.786.505 3.822 1.495l2.866-2.866C16.96 3.508 14.697 2.5 12 2.5 8.09 2.5 4.7 4.766 3.04 7.508l3.37 2.59C7.196 8.259 9.4 6.5 12 6.5Z" />
            </svg>
            Sign In with Google
          </button>
        </div>
      </div>
    );

  if (user.email !== 'kieran.betts@outlook.com')
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl p-8 max-w-md w-full text-center space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">Restricted</p>
          <h1 className="text-3xl font-bold">ACCESS DENIED</h1>
          <p className="text-sm text-slate-200">
            Signed in as <span className="font-semibold">{user.email || 'Unknown'}</span>. This app is locked to the
            owner.
          </p>
          <button
            onClick={handleSignOut}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold bg-white text-slate-900 rounded-xl shadow-lg hover:bg-slate-100 transition-all focus:outline-none focus:ring-2 focus:ring-white/70 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            Switch Google Account
          </button>
          {(error || authError) && (
            <div className="text-sm text-red-200 bg-red-900/50 border border-red-700/50 rounded-xl p-3">
              {authError || error?.message}
            </div>
          )}
        </div>
      </div>
    );

  const content = typeof children === 'function' ? children(user) : children;
  return content;
}
