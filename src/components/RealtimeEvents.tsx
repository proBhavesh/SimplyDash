import React from 'react';

interface RealtimeEvent {
  time: string;
  source: 'client' | 'server';
  event: string;
  count?: number;
}

interface RateLimit {
  name: string;
  limit: number;
  remaining: number;
  reset_seconds: number;
}

interface RealtimeEventsProps {
  events: RealtimeEvent[];
  rateLimits: RateLimit[];
}

const RealtimeEvents: React.FC<RealtimeEventsProps> = ({ events, rateLimits }) => {
  const tokenRateLimit = rateLimits.find(limit => limit.name === 'tokens');
  const tokenAllowanceRemaining = tokenRateLimit ? tokenRateLimit.remaining : 0;
  const tokenAllowanceTotal = tokenRateLimit ? tokenRateLimit.limit : 20000;

  return (
    <div className="realtime-events">
      <h3 className="text-lg font-semibold mb-2">Events</h3>
      <div className="mb-4">
        <p className="font-semibold">Token Allowance:</p>
        <p>{tokenAllowanceRemaining} / {tokenAllowanceTotal} tokens per minute</p>
      </div>
      <div className="h-80 overflow-y-auto border p-2 mb-4">
        {events.map((event, index) => (
          <div key={index} className="mb-1">
            <span className="text-gray-500">{event.time}</span>{' '}
            <span className={`font-semibold ${event.source === 'client' ? 'text-blue-600' : 'text-green-600'}`}>
              {event.source}
            </span>{' '}
            <span>{event.event}</span>
            {event.count && event.count > 1 && <span className="text-gray-500"> ({event.count})</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RealtimeEvents;