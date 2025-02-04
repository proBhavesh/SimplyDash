// pages/api/log-token-usage.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { admin, db } from '../../src/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { assistantId, workspaceId, assistantName, sessionId, conversationId, tokenUsage, source, metadata } = req.body;

    // Check if this is an embedded request
    const isEmbedded = source === 'embedded';
    let uid: string | null = null;
    let userWorkspaceId: string | null = null;

    if (isEmbedded) {
      // For embedded usage, verify the assistant exists and belongs to the workspace
      const assistantRef = db.collection('openaiAssistants').doc(assistantId);
      const assistantDoc = await assistantRef.get();

      if (!assistantDoc.exists) {
        return res.status(404).json({ error: 'Assistant not found' });
      }

      const assistantData = assistantDoc.data();
      if (assistantData?.workspaceId !== workspaceId || assistantData?.name !== assistantName) {
        return res.status(403).json({ error: 'Invalid workspace ID or assistant name' });
      }

      // Use the workspace ID from the request
      userWorkspaceId = workspaceId;
    } else {
      // For authenticated users, verify Firebase token
      const authorizationHeader = req.headers.authorization || '';
      const token = authorizationHeader.startsWith('Bearer ')
        ? authorizationHeader.slice(7)
        : null;

      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const decodedToken = await admin.auth().verifyIdToken(token);
      uid = decodedToken.uid;

      // Get the workspace ID of the authenticated user
      const userDocRef = db.collection('users').doc(uid);
      const userDoc = await userDocRef.get();

      if (!userDoc.exists) {
        return res.status(404).json({ error: 'User document not found.' });
      }

      const userData = userDoc.data();
      userWorkspaceId = userData?.workspaceId || null;
    }

    // Record token usage data in Firestore
    const tokenUsageData = {
      assistantId,
      sessionId,
      conversationId,
      userId: uid,
      workspaceId: userWorkspaceId,
      tokenUsage,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      source: isEmbedded ? 'embedded' : 'authenticated',
      metadata: isEmbedded ? metadata : null
    };

    // Add to tokenUsage collection
    await db.collection('tokenUsage').add(tokenUsageData);

    // Update assistant's total usage
    const assistantRef = db.collection('openaiAssistants').doc(assistantId);
    await db.runTransaction(async (transaction) => {
      const assistantDoc = await transaction.get(assistantRef);
      if (!assistantDoc.exists) {
        throw new Error('Assistant not found');
      }

      const currentUsage = assistantDoc.data()?.totalTokens || 0;
      const newUsage = currentUsage + (tokenUsage.totalTokens || 0);

      transaction.update(assistantRef, { 
        totalTokens: newUsage,
        lastUsed: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    // Add to usage history
    await db.collection('openaiAssistants').doc(assistantId).collection('usage').add({
      tokens: tokenUsage.totalTokens || 0,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      source: isEmbedded ? 'embedded' : 'authenticated',
      metadata: isEmbedded ? metadata : null
    });

    res.status(200).json({ 
      message: 'Token usage data logged successfully.',
      source: isEmbedded ? 'embedded' : 'authenticated',
      workspaceId: userWorkspaceId
    });
  } catch (error) {
    console.error('Error logging token usage data:', error);
    res.status(500).json({ 
      error: 'Internal server error.',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
