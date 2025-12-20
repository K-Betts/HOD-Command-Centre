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
import { Activity, Users, Clock, TrendingUp } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

/**
 * AnalyticsView Component
 * Displays telemetry analytics with charts and summary metrics
 */
export function AnalyticsView() {
  const [telemetryData, setTelemetryData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch telemetry data from last 30 days
  useEffect(() => {
    const fetchTelemetryData = async () => {
      try {
        setLoading(true);
        
        // Calculate 30 days ago
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const telemetryRef = collection(db, 'artifacts', appId, 'telemetry');
        const q = query(
          telemetryRef,
          where('timestamp', '>=', Timestamp.fromDate(thirtyDaysAgo)),
          orderBy('timestamp', 'desc'),
          limit(10000) // Reasonable limit for 30 days
        );

        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date()
        }));

        setTelemetryData(data);
      } catch (error) {
        console.error('[Analytics] Failed to fetch telemetry:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTelemetryData();
  }, []);

  // Calculate analytics metrics
  const analytics = useMemo(() => {
    if (!telemetryData.length) {
      return {
        activeUsers: 0,
        totalEvents: 0,
        avgSession: 'N/A',
        topModules: []
      };
    }

    // Active Users: Count unique UIDs
    const uniqueUids = new Set(telemetryData.map(event => event.uid));
    const activeUsers = uniqueUids.size;

    // Total Events
    const totalEvents = telemetryData.length;

    // Top Modules: Count Navigation events by label
    const navigationEvents = telemetryData.filter(
      event => event.category === 'Navigation'
    );
    
    const moduleCounts = {};
    navigationEvents.forEach(event => {
      const module = event.label || 'unknown';
      moduleCounts[module] = (moduleCounts[module] || 0) + 1;
    });

    // Convert to array and sort by count (descending)
    const topModules = Object.entries(moduleCounts)
      .map(([name, views]) => ({ name, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5); // Top 5

    // Average Session Duration
    const sessionEvents = telemetryData.filter(
      event => event.category === 'Session' && event.action === 'End' && event.duration
    );

    let avgSession = 'N/A';
    if (sessionEvents.length > 0) {
      const totalDuration = sessionEvents.reduce(
        (sum, event) => sum + (event.duration || 0),
        0
      );
      const avgSeconds = totalDuration / sessionEvents.length;
      const minutes = Math.floor(avgSeconds / 60);
      const seconds = Math.floor(avgSeconds % 60);
      avgSession = `${minutes}m ${seconds}s`;
    }

    return {
      activeUsers,
      totalEvents,
      avgSession,
      topModules
    };
  }, [telemetryData]);

  // Custom Tooltip for Bar Chart
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white px-4 py-2 rounded-lg shadow-lg border border-slate-200">
          <p className="text-sm font-semibold text-slate-900">
            {payload[0].payload.name}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            <span className="font-bold text-indigo-600">{payload[0].value}</span> views
          </p>
        </div>
      );
    }
    return null;
  };

  // Loading State
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading analytics...</p>
        </div>
      </div>
    );
  }

  // Color palette for bars
  const barColors = [
    '#4F46E5', // indigo-600
    '#7C3AED', // violet-600
    '#EC4899', // pink-600
    '#F59E0B', // amber-500
    '#10B981'  // emerald-500
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Analytics Dashboard</h2>
        <p className="text-sm text-slate-500 mt-1">
          Last 30 days • {telemetryData.length.toLocaleString()} events tracked
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Active Users Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-emerald-100 rounded-lg">
              <Users className="text-emerald-600" size={24} />
            </div>
            <div className="px-3 py-1 bg-emerald-50 rounded-full">
              <TrendingUp className="text-emerald-600" size={14} />
            </div>
          </div>
          <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-1">
            Active Users
          </p>
          <p className="text-3xl font-bold text-slate-900">
            {analytics.activeUsers.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Unique users in the last 30 days
          </p>
        </div>

        {/* Total Events Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-indigo-100 rounded-lg">
              <Activity className="text-indigo-600" size={24} />
            </div>
            <div className="px-3 py-1 bg-indigo-50 rounded-full">
              <span className="text-xs font-bold text-indigo-600">
                {telemetryData.length > 0 ? '100%' : '0%'}
              </span>
            </div>
          </div>
          <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-1">
            Total Events
          </p>
          <p className="text-3xl font-bold text-slate-900">
            {analytics.totalEvents.toLocaleString()}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            All tracked events across the platform
          </p>
        </div>

        {/* Average Session Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-amber-100 rounded-lg">
              <Clock className="text-amber-600" size={24} />
            </div>
            <div className="px-3 py-1 bg-amber-50 rounded-full">
              <span className="text-xs font-bold text-amber-600">AVG</span>
            </div>
          </div>
          <p className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-1">
            Avg Session
          </p>
          <p className="text-3xl font-bold text-slate-900">
            {analytics.avgSession}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Average session duration per user
          </p>
        </div>
      </div>

      {/* Top Modules Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-slate-900">Top 5 Most Visited Modules</h3>
          <p className="text-sm text-slate-500 mt-1">
            Based on navigation events in the last 30 days
          </p>
        </div>

        {analytics.topModules.length > 0 ? (
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={analytics.topModules}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  type="number"
                  stroke="#64748B"
                  style={{ fontSize: '12px', fontWeight: 500 }}
                  label={{
                    value: 'Number of Views',
                    position: 'insideBottom',
                    offset: -5,
                    style: { fontSize: '14px', fontWeight: 600, fill: '#475569' }
                  }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#64748B"
                  style={{ fontSize: '12px', fontWeight: 600 }}
                  width={120}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F1F5F9' }} />
                <Bar dataKey="views" radius={[0, 8, 8, 0]}>
                  {analytics.topModules.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={barColors[index % barColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-96 flex items-center justify-center bg-slate-50 rounded-lg">
            <div className="text-center">
              <Activity className="mx-auto mb-3 text-slate-400" size={48} />
              <p className="text-slate-600 font-medium">No navigation data available</p>
              <p className="text-sm text-slate-500 mt-1">
                Start using the app to see module analytics
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Additional Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Events Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">
            Event Categories
          </h4>
          <div className="space-y-3">
            {Object.entries(
              telemetryData.reduce((acc, event) => {
                acc[event.category] = (acc[event.category] || 0) + 1;
                return acc;
              }, {})
            )
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([category, count]) => (
                <div key={category} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-24 text-sm font-semibold text-slate-700">
                      {category}
                    </div>
                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full rounded-full"
                        style={{
                          width: `${(count / telemetryData.length) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-slate-600 ml-3">
                    {count}
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* User Activity Summary */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">
            Activity Summary
          </h4>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm text-slate-600">Navigation Events</span>
              <span className="text-sm font-bold text-slate-900">
                {telemetryData.filter(e => e.category === 'Navigation').length}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm text-slate-600">Feature Interactions</span>
              <span className="text-sm font-bold text-slate-900">
                {telemetryData.filter(e => e.category === 'Feature').length}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm text-slate-600">Sessions Tracked</span>
              <span className="text-sm font-bold text-slate-900">
                {telemetryData.filter(e => e.category === 'Session' && e.action === 'Start').length}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-slate-600">Error Events</span>
              <span className="text-sm font-bold text-red-600">
                {telemetryData.filter(e => e.category === 'Error').length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

