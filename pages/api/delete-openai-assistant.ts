// pages/api/delete-openai-assistant.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { admin, db } from '../../src/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';

export default async function deleteOpenAIAssistant(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Verify the user's ID token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized: No ID token provided' });
      return;
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // Extract assistantId from query parameters
    const assistantId = req.query.assistantId;
    if (!assistantId || typeof assistantId !== 'string') {
      res.status(400).json({ error: 'Invalid or missing "assistantId" parameter' });
      return;
    }

    // Fetch the assistant document
    const assistantRef = db.collection('openaiAssistants').doc(assistantId);
    const assistantDoc = await assistantRef.get();

    if (!assistantDoc.exists) {
      res.status(404).json({ error: 'Assistant not found' });
      return;
    }

    const assistantData = assistantDoc.data()!; // Use non-null assertion operator

    // Check if the assistant belongs to the user
    if (assistantData.userId !== userId) {
      res.status(403).json({ error: 'Forbidden: You do not have access to this assistant' });
      return;
    }

    // Delete the assistant document
    await assistantRef.delete();

    // Remove assistant reference from user's assistants field
    const userRef = db.collection('users').doc(userId);
    await userRef.update({
      [`assistants.${assistantId}`]: admin.firestore.FieldValue.delete(),
    });

    res.status(200).json({ message: 'Assistant deleted successfully' });
  } catch (error) {
    console.error('Error deleting OpenAI assistant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Enable body parsing for DELETE requests
export const config = {
  api: {
    bodyParser: true,
  },
};
