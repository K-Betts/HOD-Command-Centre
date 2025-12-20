import React, { Component } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import { appId } from '../../config/appConfig';
import { getClientSessionId } from '../../utils/session';

const FEEDBACK_RETENTION_DAYS = 90;

/**
 * Class Component: ErrorBoundary
 * Catches React errors and logs them to Firestore for admin review
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      isLogging: false,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, errorInfo) {
    // Start logging to Firestore
    this.logErrorToFirestore(error, errorInfo);
  }

  logErrorToFirestore = async (error, errorInfo) => {
    this.setState({ isLogging: true });

    const { user } = this.props;

    // Validate user session before logging
    if (!user?.uid) {
      console.warn('ErrorBoundary: Cannot log crash - no user session');
      this.setState({ isLogging: false });
      return;
    }

    try {
      const sessionId = getClientSessionId();
      const expiresAt = new Date(Date.now() + FEEDBACK_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      const feedbackRef = collection(
        db,
        'artifacts',
        appId,
        'feedback'
      );

      // Write crash report to Firestore
      await addDoc(feedbackRef, {
        type: 'CRASH_REPORT',
        message: error.message || String(error),
        stack: error.stack || '',
        componentStack: errorInfo.componentStack || '',
        uid: user.uid,
        sessionId: sessionId || null,
        expiresAt,
        path: window.location.pathname,
        timestamp: serverTimestamp(),
        userAgent: navigator.userAgent,
      });

      if (import.meta.env.DEV) {
        console.log('✓ Crash report logged to Firestore');
      }
    } catch (firestoreError) {
      console.error('ErrorBoundary: Failed to log crash report:', firestoreError);
    } finally {
      this.setState({ isLogging: false });
    }
  };

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    const { hasError, error, isLogging } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-pink-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-8 border border-red-100">
            {/* Error Icon */}
            <div className="flex items-center justify-center w-14 h-14 mx-auto bg-red-100 rounded-full mb-6">
              <svg
                className="w-7 h-7 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>

            {/* Heading */}
            <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">
              Oops! Something Went Wrong
            </h1>

            {/* Description */}
            <p className="text-gray-600 text-center mb-6 text-sm leading-relaxed">
              We encountered an unexpected error. Don't worry—your team has been notified automatically.
            </p>

            {/* Error Message */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Error Details
              </p>
              <div className="text-sm text-gray-700 font-mono overflow-auto max-h-24 whitespace-pre-wrap break-words">
                {error?.message || 'Unknown error'}
              </div>
            </div>

            {/* Logging Status */}
            {isLogging && (
              <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <span className="text-sm text-blue-700 font-medium">
                  Sending automated report to support...
                </span>
              </div>
            )}

            {!isLogging && (
              <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-sm text-green-700 font-medium">
                  An automated report has been sent to support.
                </span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={this.resetError}
                disabled={isLogging}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Try Again
              </button>
              <button
                onClick={() => (window.location.href = '/')}
                disabled={isLogging}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

/**
 * Functional Wrapper: AppErrorBoundary
 * Bridge component that connects Firebase hooks to the class component
 * This wrapper enables the class component to access the authenticated user context
 */
export function AppErrorBoundary({ children }) {
  const [user] = useAuthState(auth);

  // Only render ErrorBoundary when user is authenticated
  if (!user) {
    return children;
  }

  return (
    <ErrorBoundary user={user}>
      {children}
    </ErrorBoundary>
  );
}

