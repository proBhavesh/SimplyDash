// pages/api/create-openai-assistant.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid'; // Import UUID library
import { admin, db } from '../../src/lib/firebase-admin';

export default async function createOpenAIAssistant(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Extract parameters from request body
    const {
      name,
      instructions,
      voiceSettings = 'alloy',
      threshold = 0.5,
      prefix_padding_ms = 500,
      silence_duration_ms = 300,
      temperature = 0.6,
      openaiApiKey = null,
      template = 'default', // Accept the template field, default to 'default'
    } = req.body;

    // Validate required parameters
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Invalid or missing "name" parameter' });
      return;
    }

    if (!instructions || typeof instructions !== 'string') {
      res.status(400).json({ error: 'Invalid or missing "instructions" parameter' });
      return;
    }

    // Validate optional parameters
    const validVoiceSettings = ['alloy', 'echo', 'shimmer'];
    if (!validVoiceSettings.includes(voiceSettings)) {
      res.status(400).json({ error: 'Invalid "voiceSettings" parameter' });
      return;
    }

    // Attempt to authenticate the user
    let uid = null;
    let workspaceId = null;

    const authorizationHeader = req.headers.authorization || '';
    const token = authorizationHeader.startsWith('Bearer ')
      ? authorizationHeader.slice(7)
      : null;

    if (token) {
      try {
        // Verify the ID token using Firebase Admin
        const decodedToken = await admin.auth().verifyIdToken(token);
        uid = decodedToken.uid;

        // Get the workspace ID of the authenticated user
        const userDocRef = db.collection('users').doc(uid);
        const userDoc = await userDocRef.get();

        if (userDoc.exists) {
          const userData = userDoc.data();
          workspaceId = userData?.workspaceId || null;
        }
      } catch (error) {
        console.error('Error verifying user token:', error);
        // Proceed as unauthenticated if token verification fails
        uid = null;
        workspaceId = null;
      }
    }

    if (!uid) {
      // User is not authenticated, generate a unique workspaceId
      workspaceId = uuidv4();
    } else if (!workspaceId) {
      // User is authenticated but workspaceId is missing, use uid as workspaceId
      workspaceId = uid;
    }

    // Validate OpenAI API key if provided
    let apiKeyToUse = process.env.OPENAI_API_KEY;
    if (openaiApiKey) {
      // For now, we'll assume the provided API key is valid
      apiKeyToUse = openaiApiKey;
    }

    // Create a new assistant document
    const assistantRef = db.collection('openaiAssistants').doc();
    const assistantId = assistantRef.id;

    // Store assistant data in openaiAssistants collection
    const assistantData: any = {
      id: assistantId,
      name,
      instructions,
      voiceSettings,
      threshold,
      prefix_padding_ms,
      silence_duration_ms,
      temperature,
      apiKey: apiKeyToUse,
      isSubscribed: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      workspaceId, // Ensure workspaceId is set
      template: template || 'default', // Include the template field
    };

    // If the user is authenticated, include userId
    if (uid) {
      assistantData.userId = uid;
    }

    await assistantRef.set(assistantData);

    res.status(200).json({ id: assistantId });
  } catch (error) {
    console.error('Error creating OpenAI assistant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
