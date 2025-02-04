// pages/api/get-assistant-usage.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { fetchWithVapiAuth } from '../../src/utils/vapiClient';

const COST_PER_MINUTE = 0.45;

interface UsageRecord {
  assistantId: string;
  sumDuration: string;
  countId: string;
  type?: string;
}

interface QueryResult {
  result: UsageRecord[];
}

interface AnalyticsData {
  [index: number]: QueryResult;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('GET /api/get-assistant-usage called');
  const { assistantId, startDate, endDate } = req.query;

  console.log('Assistant ID:', assistantId);
  console.log('Start Date:', startDate);
  console.log('End Date:', endDate);

  if (!process.env.VAPI_API_KEY) {
    console.error('VAPI API key is not set');
    return res.status(500).json({ message: 'VAPI API key is not set' });
  }

  if (!assistantId) {
    console.error('Assistant ID is required');
    return res.status(400).json({ message: 'Assistant ID is required' });
  }

  if (!startDate || !endDate) {
    console.error('Start date and end date are required');
    return res.status(400).json({ message: 'Start date and end date are required' });
  }

  // Parse the date strings into Date objects
  const parsedStartDate = new Date(startDate as string);
  const parsedEndDate = new Date(endDate as string);

  // Format dates as ISO strings
  const formattedStartDate = parsedStartDate.toISOString();
  const formattedEndDate = parsedEndDate.toISOString();

  console.log(`Fetching usage data for date range: ${formattedStartDate} to ${formattedEndDate}`);

  try {
    const response = await fetchWithVapiAuth('https://api.vapi.ai/analytics', {
      method: 'POST',
      body: JSON.stringify({
        queries: [
          {
            name: "assistantUsage",
            table: "call",
            timeRange: {
              start: formattedStartDate,
              end: formattedEndDate
            },
            groupBy: ["assistantId", "type"],
            operations: [
              {
                operation: "sum",
                column: "duration"
              },
              {
                operation: "count",
                column: "id"
              }
            ]
          }
        ]
      }),
    });

    console.log('VAPI response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('VAPI error response:', errorText);
      throw new Error(`Failed to fetch analytics data: ${errorText}`);
    }

    const data: AnalyticsData = await response.json();
    console.log('Full VAPI response:', JSON.stringify(data, null, 2));

    // Process the usage data
    let totalMinutes = 0;
    let totalCalls = 0;
    const callTypeBreakdown: { [key: string]: { minutes: number; calls: number } } = {};

    data[0]?.result.forEach((usage: UsageRecord) => {
      if (usage.assistantId === assistantId) {
        const minutes = parseFloat(usage.sumDuration) || 0;
        const calls = parseInt(usage.countId) || 0;
        const callType = usage.type || 'unknown';

        totalMinutes += minutes;
        totalCalls += calls;

        if (!callTypeBreakdown[callType]) {
          callTypeBreakdown[callType] = { minutes: 0, calls: 0 };
        }
        callTypeBreakdown[callType].minutes += minutes;
        callTypeBreakdown[callType].calls += calls;
      }
    });

    const totalCost = (totalMinutes * COST_PER_MINUTE).toFixed(2);

    console.log('Processed usage data:', {
      totalMinutes,
      totalCalls,
      totalCost,
      callTypeBreakdown
    });

    res.status(200).json({
      totalMinutes: totalMinutes.toFixed(2),
      totalCalls,
      totalCost,
      callTypeBreakdown,
      costPerMinute: COST_PER_MINUTE
    });
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    res.status(500).json({
      message: 'An error occurred while fetching analytics data',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
