// pages/api/get-token-usage.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { admin, db } from '../../src/lib/firebase-admin';

const TOKENS_PER_MINUTE = 350;
const COST_PER_MINUTE = 0.45;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Verify the authenticated user
    const authorizationHeader = req.headers.authorization || '';
    const token = authorizationHeader.startsWith('Bearer ')
      ? authorizationHeader.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    // Get query parameters
    const { startDate, endDate, assistantId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required.' });
    }

    const startTimestamp = admin.firestore.Timestamp.fromDate(
      new Date(startDate as string)
    );
    const endTimestamp = admin.firestore.Timestamp.fromDate(
      new Date(endDate as string)
    );

    // Get the workspace ID of the authenticated user
    const userDocRef = db.collection('users').doc(uid);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User document not found.' });
    }

    const userData = userDoc.data();
    const workspaceId = userData?.workspaceId;

    if (!workspaceId) {
      return res.status(400).json({ error: 'Workspace ID not found for user.' });
    }

    // Build the query
    let query = db
      .collection('tokenUsage')
      .where('workspaceId', '==', workspaceId)
      .where('timestamp', '>=', startTimestamp)
      .where('timestamp', '<=', endTimestamp);

    if (assistantId) {
      query = query.where('assistantId', '==', assistantId as string);
    }

    // Execute the query
    const querySnapshot = await query.get();

    let totalTokens = 0;
    const sessions: Record<string, any> = {};

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const sessionId = data.sessionId;
      const tokens = data.tokenUsage?.totalTokens || 0; // Updated with optional chaining

      totalTokens += tokens;

      if (!sessions[sessionId]) {
        sessions[sessionId] = {
          sessionId,
          tokens: 0,
          assistantId: data.assistantId,
          userId: data.userId,
          timestamp: data.timestamp ? data.timestamp.toDate() : null, // Safely handle timestamp
        };
      }

      sessions[sessionId].tokens += tokens;
    });

    // Convert total tokens to minutes and cost
    const totalMinutes = totalTokens / TOKENS_PER_MINUTE;
    const totalCost = totalMinutes * COST_PER_MINUTE;

    // Prepare the response
    const responseData = {
      totalTokens,
      totalMinutes: parseFloat(totalMinutes.toFixed(2)),
      totalCost: parseFloat(totalCost.toFixed(2)),
      sessions: Object.values(sessions),
    };

    res.status(200).json(responseData);
  } catch (error: unknown) { // Typed error as unknown
    if (error instanceof Error) {
      console.error('Error fetching token usage data:', error.message);
    } else {
      console.error('Error fetching token usage data:', error);
    }
    res.status(500).json({ error: 'Internal server error.' });
  }
}
