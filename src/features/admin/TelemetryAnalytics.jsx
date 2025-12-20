import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { appId } from '../../config/appConfig';
import { 
  Activity, 
  Clock, 
  Users, 
  MousePointer, 
  Eye,
  TrendingUp,
  Calendar
} from 'lucide-react';

/**
 * TelemetryAnalytics Component
 * Displays comprehensive telemetry data for admin dashboard
 */
export function TelemetryAnalytics() {
  const [telemetryData, setTelemetryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d'); // 24h, 7d, 30d

  // Load telemetry data
  useEffect(() => {
    const loadTelemetry = async () => {
      try {
        setLoading(true);
        const now = new Date();
        const cutoffDate = new Date();

        // Calculate cutoff based on time range
        switch (timeRange) {
          case '24h':
            cutoffDate.setHours(now.getHours() - 24);
            break;
          case '7d':
            cutoffDate.setDate(now.getDate() - 7);
            break;
          case '30d':
            cutoffDate.setDate(now.getDate() - 30);
            break;
        }

        const telemetryRef = collection(db, 'artifacts', appId, 'telemetry');
        const q = query(
          telemetryRef,
          where('timestamp', '>=', Timestamp.fromDate(cutoffDate)),
          orderBy('timestamp', 'desc'),
          limit(5000)
        );

        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date()
        }));

        setTelemetryData(data);
      } catch (error) {
        console.error('[Telemetry] Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTelemetry();
  }, [timeRange]);

  // Compute analytics
  const analytics = useMemo(() => {
    if (!telemetryData.length) {
      return {
        totalEvents: 0,
        uniqueUsers: 0,
        averageSessionDuration: 0,
        navigationEvents: [],
        featureUsage: {},
        sessionStats: {},
        activeUsers: [],
        topPages: [],
      };
    }

    const uniqueUsers = new Set(telemetryData.map(e => e.uid)).size;
    const totalEvents = telemetryData.length;

    // Navigation analytics
    const navigationEvents = telemetryData.filter(e => e.category === 'Navigation');
    const pageViews = navigationEvents.reduce((acc, event) => {
      acc[event.label] = (acc[event.label] || 0) + 1;
      return acc;
    }, {});

    const topPages = Object.entries(pageViews)
      .map(([page, views]) => ({ page, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    // Feature usage analytics
    const featureEvents = telemetryData.filter(e => e.category === 'Feature');
    const featureUsage = featureEvents.reduce((acc, event) => {
      const key = event.label;
      if (!acc[key]) {
        acc[key] = { count: 0, actions: {} };
      }
      acc[key].count++;
      acc[key].actions[event.action] = (acc[key].actions[event.action] || 0) + 1;
      return acc;
    }, {});

    // Session analytics
    const sessionEvents = telemetryData.filter(e => e.category === 'Session');
    const sessions = {};
    
    sessionEvents.forEach(event => {
      const sessionId = event.label;
      if (!sessions[sessionId]) {
        sessions[sessionId] = { start: null, end: null, duration: 0, uid: event.uid };
      }
      
      if (event.action === 'Start') {
        sessions[sessionId].start = event.timestamp;
      } else if (event.action === 'End' && event.duration) {
        sessions[sessionId].duration = event.duration;
        sessions[sessionId].end = event.timestamp;
      }
    });

    const validSessions = Object.values(sessions).filter(s => s.duration > 0);
    const averageSessionDuration = validSessions.length > 0
      ? validSessions.reduce((sum, s) => sum + s.duration, 0) / validSessions.length
      : 0;

    // Active users in last 24h
    const last24h = new Date();
    last24h.setHours(last24h.getHours() - 24);
    const recentEvents = telemetryData.filter(e => e.timestamp >= last24h);
    const activeUsers = [...new Set(recentEvents.map(e => e.uid))];

    return {
      totalEvents,
      uniqueUsers,
      averageSessionDuration,
      navigationEvents,
      featureUsage,
      sessionStats: { total: Object.keys(sessions).length, valid: validSessions.length },
      activeUsers,
      topPages,
    };
  }, [telemetryData]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Telemetry Analytics</h2>
        <div className="flex gap-2">
          {['24h', '7d', '30d'].map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                timeRange === range
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {range === '24h' ? 'Last 24 Hours' : range === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Activity}
          label="Total Events"
          value={analytics.totalEvents.toLocaleString()}
          color="blue"
        />
        <MetricCard
          icon={Users}
          label="Unique Users"
          value={analytics.uniqueUsers.toLocaleString()}
          color="green"
        />
        <MetricCard
          icon={Clock}
          label="Avg Session"
          value={formatDuration(analytics.averageSessionDuration)}
          color="purple"
        />
        <MetricCard
          icon={TrendingUp}
          label="Active (24h)"
          value={analytics.activeUsers.length.toLocaleString()}
          color="orange"
        />
      </div>

      {/* Top Pages */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Eye className="text-slate-600" size={18} />
          <h3 className="text-sm font-bold text-slate-900">Top Pages</h3>
        </div>
        <div className="space-y-2">
          {analytics.topPages.length > 0 ? (
            analytics.topPages.map(({ page, views }) => (
              <div key={page} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <span className="text-sm font-medium text-slate-700">{page}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-red-600 h-full rounded-full"
                      style={{ width: `${(views / analytics.topPages[0].views) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-slate-900 w-12 text-right">{views}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No page view data available</p>
          )}
        </div>
      </div>

      {/* Feature Usage */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <MousePointer className="text-slate-600" size={18} />
          <h3 className="text-sm font-bold text-slate-900">Feature Usage</h3>
        </div>
        <div className="space-y-3">
          {Object.keys(analytics.featureUsage).length > 0 ? (
            Object.entries(analytics.featureUsage)
              .sort(([, a], [, b]) => b.count - a.count)
              .slice(0, 10)
              .map(([feature, data]) => (
                <div key={feature} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div className="flex-1">
                    <span className="text-sm font-medium text-slate-700">{feature}</span>
                    <div className="flex gap-2 mt-1">
                      {Object.entries(data.actions).map(([action, count]) => (
                        <span key={action} className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {action}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-sm font-bold text-slate-900 ml-4">{data.count}</span>
                </div>
              ))
          ) : (
            <p className="text-sm text-slate-500">No feature usage data available</p>
          )}
        </div>
      </div>

      {/* Session Stats */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="text-slate-600" size={18} />
          <h3 className="text-sm font-bold text-slate-900">Session Statistics</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total Sessions</p>
            <p className="text-2xl font-bold text-slate-900">{analytics.sessionStats.total}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Completed Sessions</p>
            <p className="text-2xl font-bold text-slate-900">{analytics.sessionStats.valid}</p>
          </div>
        </div>
      </div>

      {/* Raw Event Stream (last 20) */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="text-slate-600" size={18} />
          <h3 className="text-sm font-bold text-slate-900">Recent Events</h3>
        </div>
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {telemetryData.slice(0, 20).map((event) => (
            <div key={event.id} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0 text-xs">
              <span className="text-slate-400 font-mono">
                {event.timestamp.toLocaleTimeString()}
              </span>
              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold">
                {event.category}
              </span>
              <span className="text-slate-600">{event.action}</span>
              <span className="text-slate-900 font-medium flex-1">{event.label}</span>
              <span className="text-slate-400 font-mono text-[10px]">{event.uid.slice(0, 8)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Metric Card Component
function MetricCard({ icon: Icon, label, value, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
