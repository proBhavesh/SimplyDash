import type { NextApiRequest, NextApiResponse } from 'next'
import { getAuth } from 'firebase-admin/auth'
import { db, storage } from '../../src/lib/firebase-admin'
import { vapiClient } from '../../src/utils/vapiClient'
import { Assistant, Usage, AnalyticsQuery, AnalyticsResult } from '../../src/types/assistant'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('GET /api/get-assistant - Start');
  console.log('Query parameters:', req.query);
  console.log('Checking Firebase Admin SDK initialization');
  console.log('Firebase Auth initialized:', !!getAuth());
  console.log('Firestore initialized:', !!db);
  console.log('Storage initialized:', !!storage);
  
  try {
    console.log('Attempting to access storage bucket');
    const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.appspot.com`;
    console.log('Storage bucket name:', storageBucket);
    const bucket = storage.bucket(storageBucket);
    console.log('Storage bucket accessed successfully');
  } catch (error) {
    console.error('Error accessing storage bucket:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  }

  if (req.method !== 'GET') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Unauthorized: Invalid or missing authorization header');
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const token = authHeader.split('Bearer ')[1]

  try {
    console.log('Verifying ID token');
    const decodedToken = await getAuth().verifyIdToken(token)
    const uid = decodedToken.uid
    console.log('User ID:', uid);

    const { id } = req.query
    if (!id || typeof id !== 'string') {
      console.error('Invalid assistant ID:', id);
      return res.status(400).json({ message: 'Invalid assistant ID' })
    }

    console.log('Fetching assistant from Vapi:', id);
    let vapiAssistant;
    try {
      vapiAssistant = await vapiClient.getAssistant(id)
      console.log('Vapi assistant:', vapiAssistant);
    } catch (error) {
      console.error('Error fetching assistant from Vapi:', error);
      return res.status(500).json({ message: 'Error fetching assistant from Vapi', error: error instanceof Error ? error.message : 'Unknown error' })
    }

    console.log('Fetching assistant data from Firestore');
    const assistantDoc = await db.collection('assistants').doc(id).get()
    const assistantData = assistantDoc.data()

    if (!assistantData) {
      console.error('Assistant not found in Firestore:', id);
      return res.status(404).json({ message: 'Assistant not found' })
    }

    console.log('Firestore assistant data:', assistantData);

    if (assistantData.userId !== uid) {
      console.error('Access denied for user:', uid, 'to assistant:', id);
      return res.status(403).json({ message: 'Access denied' })
    }

    console.log('Fetching usage data');
    const endDate = new Date()
    const startDate = new Date(endDate)
    startDate.setDate(endDate.getDate() - 30)

    const analyticsQuery: AnalyticsQuery = {
      name: "assistantUsage",
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
    }

    console.log('Analytics query:', analyticsQuery);
    let assistantUsage: Usage | null = null;
    try {
      const analyticsData = await vapiClient.getAnalytics([analyticsQuery])
      console.log('Analytics data:', analyticsData);

      if (analyticsData && analyticsData[0] && analyticsData[0].result) {
        const usageResults = (analyticsData[0].result as AnalyticsResult[]).filter(u => u.assistantId === id)
        console.log('Filtered usage results:', usageResults);

        const dailyUsageMap: { [key: string]: { minutes: number, cost: number } } = {}
        let totalMinutes = 0
        let totalCost = 0

        usageResults.forEach(u => {
          const minutes = parseFloat((Number(u.totalDuration) / 60).toFixed(2))
          const cost = parseFloat(Number(u.totalCost).toFixed(2))
          const date = typeof u.type === 'string' ? u.type.split('T')[0] : ''

          totalMinutes += minutes
          totalCost += cost

          if (dailyUsageMap[date]) {
            dailyUsageMap[date].minutes += minutes
            dailyUsageMap[date].cost += cost
          } else {
            dailyUsageMap[date] = { minutes, cost }
          }
        })

        assistantUsage = {
          totalMinutes: parseFloat(totalMinutes.toFixed(2)),
          totalCost: parseFloat(totalCost.toFixed(2)),
          dailyData: Object.entries(dailyUsageMap).map(([date, data]) => ({
            date,
            minutes: parseFloat(data.minutes.toFixed(2)),
            cost: parseFloat(data.cost.toFixed(2))
          })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        }

        console.log('Calculated assistant usage:', assistantUsage);
      } else {
        console.log('No analytics data available');
      }
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      // Continue without analytics data
      console.log('Continuing without analytics data');
    }

    // Get Firebase Storage bucket
    let talkingGifUrl, waitingGifUrl;
    try {
      console.log('Accessing Firebase Storage bucket');
      const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.appspot.com`;
      const bucket = storage.bucket(storageBucket);
      console.log('Storage bucket name:', bucket.name);

      // Generate signed URLs for GIFs
      if (assistantData.talkingGifPath) {
        console.log('Generating signed URL for talking GIF:', assistantData.talkingGifPath);
        const [talkingGifFile] = await bucket.file(assistantData.talkingGifPath).getSignedUrl({
          action: 'read',
          expires: Date.now() + 1000 * 60 * 60, // 1 hour
        });
        talkingGifUrl = talkingGifFile;
        console.log('Talking GIF URL generated:', talkingGifUrl);
      }
      if (assistantData.waitingGifPath) {
        console.log('Generating signed URL for waiting GIF:', assistantData.waitingGifPath);
        const [waitingGifFile] = await bucket.file(assistantData.waitingGifPath).getSignedUrl({
          action: 'read',
          expires: Date.now() + 1000 * 60 * 60, // 1 hour
        });
        waitingGifUrl = waitingGifFile;
        console.log('Waiting GIF URL generated:', waitingGifUrl);
      }
    } catch (error) {
      console.error('Error accessing Firebase Storage:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      // Provide fallback URLs or leave as undefined
      talkingGifUrl = '/static/cloudt.gif';
      waitingGifUrl = '/static/cloud.gif';
      console.log('Using fallback GIF URLs');
    }

    // Extract firstMessage from the assistant's model messages
    const firstMessage = vapiAssistant.model.messages.find(msg => msg.role === 'assistant')?.content || '';
    console.log('Extracted firstMessage:', firstMessage);

    const assistant: Assistant = {
      ...vapiAssistant,
      isSubscribed: assistantData.isSubscribed || false,
      usage: assistantUsage,
      talkingGifUrl,
      waitingGifUrl,
      firstMessage // Add the firstMessage to the assistant object
    } as Assistant;

    console.log('Final assistant data:', assistant);
    res.status(200).json(assistant)
  } catch (error) {
    console.error('Error in get-assistant handler:', error)
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    res.status(500).json({ message: 'Internal server error', error: error instanceof Error ? error.message : 'Unknown error' })
  }
}