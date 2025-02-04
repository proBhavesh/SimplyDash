// src/components/TokenUsagePage.tsx

import React, { useState } from 'react';
import { getAuth } from 'firebase/auth';
import { useRouter } from 'next/router';
import { Header } from './Header';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'react-hot-toast';

interface SessionData {
  sessionId: string;
  tokens: number;
  assistantId: string;
  userId: string;
  timestamp: string;
}

interface TokenUsageResponse {
  totalTokens: number;
  totalMinutes: number;
  totalCost: number;
  sessions: SessionData[];
}

export const TokenUsagePage: React.FC = () => {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [tokenUsageData, setTokenUsageData] = useState<TokenUsageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const fetchTokenUsage = async () => {
    if (!startDate || !endDate) {
      toast.error('Please enter both start and end dates in YYYY-MM-DD format');
      return;
    }

    setLoading(true);

    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        router.push('/login');
        return;
      }

      const token = await user.getIdToken();

      const response = await fetch(
        `/api/get-token-usage?startDate=${encodeURIComponent(
          startDate
        )}&endDate=${encodeURIComponent(endDate)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        setTokenUsageData(result);
      } else {
        console.error('Error fetching token usage:', result.error);
        toast.error(`Error fetching token usage: ${result.error}`);
      }
    } catch (error) {
      console.error('Error fetching token usage:', error);
      toast.error('Failed to fetch token usage');
    }

    setLoading(false);
  };

  return (
    <>
      <Header />
      <div className="max-w-6xl mx-auto p-4">
        <h2 className="text-2xl font-bold mb-4">Token Usage</h2>
        <div className="mb-4">
          <label className="block mb-2">Start Date (YYYY-MM-DD)</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="mb-4">
          <label className="block mb-2">End Date (YYYY-MM-DD)</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <Button onClick={fetchTokenUsage} disabled={loading}>
          {loading ? 'Loading...' : 'Fetch Token Usage'}
        </Button>
        {tokenUsageData && (
          <div className="mt-8">
            <h3 className="text-xl font-semibold mb-2">Token Usage Summary</h3>
            <p>Total Tokens: {tokenUsageData.totalTokens}</p>
            <p>Total Minutes: {tokenUsageData.totalMinutes}</p>
            <p>Total Cost: €{tokenUsageData.totalCost}</p>
            <h4 className="text-lg font-semibold mt-4">Session Details</h4>
            <table className="w-full mt-2 border-collapse">
              <thead>
                <tr>
                  <th className="border px-4 py-2">Session ID</th>
                  <th className="border px-4 py-2">Tokens</th>
                  <th className="border px-4 py-2">Assistant ID</th>
                  <th className="border px-4 py-2">User ID</th>
                  <th className="border px-4 py-2">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {tokenUsageData.sessions.map((session) => (
                  <tr key={session.sessionId}>
                    <td className="border px-4 py-2">{session.sessionId}</td>
                    <td className="border px-4 py-2">{session.tokens}</td>
                    <td className="border px-4 py-2">{session.assistantId}</td>
                    <td className="border px-4 py-2">{session.userId}</td>
                    <td className="border px-4 py-2">
                      {new Date(session.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};
