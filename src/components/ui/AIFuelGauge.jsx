import React, { useEffect, useState } from 'react';
import { useAIQuota } from '../../hooks/useAIQuota';

export function AIFuelGauge() {
  const { getRemainingCalls, getStatus, getCooldownTimeRemaining } = useAIQuota();
  const [remaining, setRemaining] = useState(15);
  const [status, setStatus] = useState('high');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [percentage, setPercentage] = useState(100);

  const MAX_CALLS = 15;

  // Update fuel gauge every second to capture real-time changes
  useEffect(() => {
    const updateGauge = () => {
      const currentRemaining = getRemainingCalls();
      const currentStatus = getStatus();
      const cooldownTime = getCooldownTimeRemaining();

      setRemaining(currentRemaining);
      setStatus(currentStatus);
      setCooldownSeconds(cooldownTime);
      setPercentage((currentRemaining / MAX_CALLS) * 100);
    };

    // Initial update
    updateGauge();

    // Poll every 500ms for responsive updates
    const interval = setInterval(updateGauge, 500);

    return () => clearInterval(interval);
  }, [getRemainingCalls, getStatus, getCooldownTimeRemaining]);

  // Determine colors based on status
  const getColors = () => {
    switch (status) {
      case 'high':
        return {
          barBg: 'bg-emerald-100',
          barFill: 'bg-emerald-500',
          text: 'text-emerald-700',
          label: 'AI Ready',
        };
      case 'low':
        return {
          barBg: 'bg-amber-100',
          barFill: 'bg-amber-500',
          text: 'text-amber-700',
          label: `${remaining} left`,
        };
      case 'cooldown':
      case 'empty':
        return {
          barBg: 'bg-red-100',
          barFill: 'bg-red-500',
          text: 'text-red-700',
          label: cooldownSeconds > 0 ? `Busy (${cooldownSeconds}s)` : 'Busy',
        };
      default:
        return {
          barBg: 'bg-slate-100',
          barFill: 'bg-slate-400',
          text: 'text-slate-700',
          label: 'Unknown',
        };
    }
  };

  const colors = getColors();

  return (
    <div
      className="w-full space-y-2"
      title="Limit: 15 Requests/min or 1M Tokens/min"
    >
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold ${colors.text}`}>
          {colors.label}
        </span>
        <span className={`text-xs font-medium ${colors.text}`}>
          {remaining}/{MAX_CALLS}
        </span>
      </div>
      <div className={`w-full h-2 rounded-full ${colors.barBg} overflow-hidden border border-opacity-30 ${colors.text.replace('text-', 'border-')}`}>
        <div
          className={`h-full ${colors.barFill} transition-all duration-300 ${status === 'cooldown' ? 'animate-pulse' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
