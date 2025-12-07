import React, { useEffect, useState } from 'react';

export function LiveClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000 * 10); // update every 10 seconds for smoothness, but could be 60s
    return () => clearInterval(interval);
  }, []);

  function formatDate(date) {
    // Format: "EEE d MMM | HH:mm"
    // Example: "Sun 7 Dec | 19:42"
    return date.toLocaleString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).replace(',', '').replace(',', '');
  }

  // Split to match the requested format
  const formatted = formatDate(now).replace(/ (\d{2}):(\d{2})/, ' | $1:$2');

  return (
    <span className="text-slate-600 font-medium font-mono text-sm px-3 py-1.5 rounded">
      {formatted}
    </span>
  );
}
