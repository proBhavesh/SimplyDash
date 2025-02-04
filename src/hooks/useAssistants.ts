// src/hooks/useAssistants.ts

import { useState, useCallback, useEffect } from 'react';
import { Assistant, AnalyticsQuery, AnalyticsResponse, Usage, DailyUsage, AnalyticsResult } from '../types/assistant';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { VapiAssistant } from '../utils/vapiClient';
import { fetchWithAuth } from '../utils/api';
import { handleError, ErrorResponse } from '../utils/errorHandler';
import toastUtils from '../utils/toast';
import { errorLogger } from '../utils/errorLogger';

const COST_PER_MINUTE = 0.45;

export function useAssistants() {
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorResponse | null>(null);
  const [totalUsage, setTotalUsage] = useState<Usage>({ totalMinutes: 0, totalCost: 0, dailyData: [] });
  const [user, setUser] = useState(getAuth().currentUser);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });

    return () => unsubscribe();
  }, []);

  const fetchAssistantsAndAnalytics = useCallback(async (isAdmin: boolean) => {
    console.log('useAssistants: fetchAssistantsAndAnalytics called with isAdmin:', isAdmin);
    setLoading(true);
    setError(null);
    setAnalyticsError(null);
    try {
      if (!user) {
        console.error('useAssistants: User not logged in');
        throw new Error('User not logged in');
      }
      console.log('useAssistants: User authenticated:', user.uid);

      // Fetch assistants
      let vapiAssistants: VapiAssistant[];
      try {
        console.log('useAssistants: Fetching assistants from API');
        const apiRoute = isAdmin ? '/api/admin/list-assistants' : '/api/list-assistants';
        console.log('useAssistants: API route:', apiRoute);
        const response = await fetchWithAuth(apiRoute);
        console.log('useAssistants: API response status:', response.status);
        if (!response.ok) {
          const errorData = await response.json();
          console.error('useAssistants: Failed to fetch assistants:', errorData);
          throw new Error(errorData.message || 'Failed to fetch assistants');
        }
        vapiAssistants = await response.json();
        console.log('useAssistants: Fetched assistants:', JSON.stringify(vapiAssistants, null, 2));
      } catch (err) {
        console.error('useAssistants: Error fetching assistants:', err);
        throw new Error(`Failed to fetch assistants: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }

      if (vapiAssistants.length === 0) {
        console.log('useAssistants: No assistants found');
        setAssistants([]);
        setTotalUsage({ totalMinutes: 0, totalCost: 0, dailyData: [] });
        setLoading(false);
        toastUtils.success('No assistants found. Create your first assistant to get started!');
        return;
      }

      // Fetch analytics
      try {
        const endDate = new Date();
        const startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 30);

        const usageQuery: AnalyticsQuery = {
          name: "usage",
          table: "call",
          timeRange: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            step: "day",
            timezone: "UTC"
          },
          groupBy: ["assistantId", "type"],
          operations: [
            { operation: "sum", column: "duration", alias: "totalDuration" },
            { operation: "sum", column: "cost", alias: "totalCost" }
          ]
        };

        console.log('useAssistants: Fetching analytics data');
        const analyticsResponse = await fetchWithAuth('/api/get-analytics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ queries: [usageQuery] }),
        });
        if (!analyticsResponse.ok) {
          const errorData = await analyticsResponse.json();
          console.error('useAssistants: Failed to fetch analytics:', errorData);
          throw new Error(errorData.message || 'Failed to fetch analytics');
        }
        const analyticsData: AnalyticsResponse[] = await analyticsResponse.json();
        console.log('useAssistants: Raw analytics data:', JSON.stringify(analyticsData, null, 2));

        if (!Array.isArray(analyticsData) || analyticsData.length === 0 || !analyticsData[0].result) {
          console.error('useAssistants: No analytics data available');
          throw new Error('No analytics data available from Vapi');
        }

        const usageResults: AnalyticsResult[] = analyticsData[0].result;
        console.log('useAssistants: Usage results:', JSON.stringify(usageResults, null, 2));

        let totalMinutes = 0;
        let totalCost = 0;
        const dailyUsageMap: { [key: string]: DailyUsage } = {};
        const assistantUsageMap: { [key: string]: { totalMinutes: number, totalCost: number, dailyData: DailyUsage[] } } = {};

        usageResults.forEach((result) => {
          const minutes = parseFloat(result.totalDuration as string);
          const cost = minutes * COST_PER_MINUTE;
          const date = result.type as string;

          console.log(`Processing usage for assistant ${result.assistantId}: ${minutes} minutes, $${cost} cost`);

          // For admin users, include all usage data
          if (isAdmin || vapiAssistants.some(assistant => assistant.id === result.assistantId)) {
            totalMinutes += minutes;
            totalCost += cost;

            // Process daily usage
            if (dailyUsageMap[date]) {
              dailyUsageMap[date].minutes += minutes;
              dailyUsageMap[date].cost += cost;
            } else {
              dailyUsageMap[date] = { date, minutes, cost };
            }

            // Process per-assistant usage
            if (!assistantUsageMap[result.assistantId]) {
              assistantUsageMap[result.assistantId] = { totalMinutes: 0, totalCost: 0, dailyData: [] };
            }
            assistantUsageMap[result.assistantId].totalMinutes += minutes;
            assistantUsageMap[result.assistantId].totalCost += cost;
            
            const existingDailyData = assistantUsageMap[result.assistantId].dailyData.find(d => d.date === date);
            if (existingDailyData) {
              existingDailyData.minutes += minutes;
              existingDailyData.cost += cost;
            } else {
              assistantUsageMap[result.assistantId].dailyData.push({ date, minutes, cost });
            }
          }
        });

        console.log('useAssistants: Processed daily usage:', JSON.stringify(dailyUsageMap, null, 2));
        console.log('useAssistants: Processed assistant usage:', JSON.stringify(assistantUsageMap, null, 2));

        const allDailyData = Object.values(dailyUsageMap).sort((a, b) => 
          b.date.localeCompare(a.date)
        );

        setTotalUsage({
          totalMinutes: parseFloat(totalMinutes.toFixed(2)),
          totalCost: parseFloat(totalCost.toFixed(2)),
          dailyData: allDailyData
        });

        console.log('useAssistants: Final total usage:', JSON.stringify({
          totalMinutes: parseFloat(totalMinutes.toFixed(2)),
          totalCost: parseFloat(totalCost.toFixed(2)),
          dailyData: allDailyData
        }, null, 2));

        const assistantsWithUsage: Assistant[] = vapiAssistants.map((assistant: VapiAssistant) => {
          const assistantUsage = assistantUsageMap[assistant.id] || { totalMinutes: 0, totalCost: 0, dailyData: [] };
          
          return {
            ...assistant,
            orgId: 'default-org-id', // Provide a default value
            createdAt: new Date().toISOString(), // Provide current date
            updatedAt: new Date().toISOString(), // Provide current date
            isSubscribed: assistant.isSubscribed || false,
            usage: {
              totalMinutes: parseFloat(assistantUsage.totalMinutes.toFixed(2)),
              totalCost: parseFloat(assistantUsage.totalCost.toFixed(2)),
              dailyData: assistantUsage.dailyData.sort((a: DailyUsage, b: DailyUsage) => b.date.localeCompare(a.date))
            },
            voice: assistant.voice ? {
              ...assistant.voice,
              model: 'default-model',
              stability: 0,
              similarityBoost: 0,
              fillerInjectionEnabled: false,
              optimizeStreamingLatency: 0
            } : undefined,
            model: assistant.model ? {
              ...assistant.model,
              functions: [],
              maxTokens: 0,
              temperature: 0,
              emotionRecognitionEnabled: false
            } : undefined,
            transcriber: assistant.transcriber ? {
              ...assistant.transcriber,
              language: assistant.transcriber.language
            } : undefined
          } as Assistant;
        });

        console.log('useAssistants: Assistants with usage:', JSON.stringify(assistantsWithUsage, null, 2));
        setAssistants(assistantsWithUsage);
        toastUtils.success('Assistants and analytics data loaded successfully');
      } catch (analyticsError) {
        console.error('useAssistants: Error fetching analytics data:', analyticsError);
        setAnalyticsError('Failed to fetch analytics data. Some features may be limited.');
        errorLogger.error('useAssistants: Analytics error details:', analyticsError);
        toastUtils.error('Failed to fetch analytics data. Some features may be limited.');
        
        // Set assistants without usage data
        const assistantsWithoutUsage: Assistant[] = vapiAssistants.map((assistant: VapiAssistant) => ({
          ...assistant,
          orgId: 'default-org-id', // Provide a default value
          createdAt: new Date().toISOString(), // Provide current date
          updatedAt: new Date().toISOString(), // Provide current date
          isSubscribed: assistant.isSubscribed || false,
          usage: {
            totalMinutes: 0,
            totalCost: 0,
            dailyData: []
          },
          voice: assistant.voice ? {
            ...assistant.voice,
            model: 'default-model',
            stability: 0,
            similarityBoost: 0,
            fillerInjectionEnabled: false,
            optimizeStreamingLatency: 0
          } : undefined,
          model: assistant.model ? {
            ...assistant.model,
            functions: [],
            maxTokens: 0,
            temperature: 0,
            emotionRecognitionEnabled: false
          } : undefined,
          transcriber: assistant.transcriber ? {
            ...assistant.transcriber,
            language: assistant.transcriber.language
          } : undefined
        }));
        setAssistants(assistantsWithoutUsage);
      }
    } catch (err) {
      console.error('useAssistants: Error in fetchAssistantsAndAnalytics:', err);
      const errorResponse = handleError(err);
      setError(errorResponse);
      toastUtils.error(errorResponse.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const deleteAssistant = useCallback(async (assistantId: string) => {
    console.log(`useAssistants: Deleting assistant ${assistantId}`);
    try {
      const response = await fetchWithAuth(`/api/delete-assistant?assistantId=${assistantId}`, {
        method: 'DELETE',
        // No headers or body needed since we're sending assistantId in the URL
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete assistant');
      }
      setAssistants((prevAssistants) => prevAssistants.filter(a => a.id !== assistantId));
      console.log(`useAssistants: Assistant ${assistantId} deleted successfully`);
      toastUtils.success('Assistant deleted successfully');
    } catch (error) {
      console.error('useAssistants: Error deleting assistant:', error);
      const errorResponse = handleError(error);
      setError(errorResponse);
      toastUtils.error(errorResponse.message);
    }
  }, []);

  return { assistants, loading, error, fetchAssistantsAndAnalytics, deleteAssistant, totalUsage, analyticsError };
}
