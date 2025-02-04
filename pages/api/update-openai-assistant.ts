// pages/api/update-openai-assistant.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { admin, db } from '../../src/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';

export default async function updateOpenAIAssistant(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT');
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

    // Extract assistantId from the request body
    const {
      assistantId,
      instructions,
      voiceSettings,
      threshold,
      prefix_padding_ms,
      silence_duration_ms,
      temperature,
      openaiApiKey = null,
    } = req.body;

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

    // Prepare update data
    const updateData: any = {};

    if (instructions && typeof instructions === 'string') {
      updateData.instructions = instructions;
    }

    const validVoiceSettings = ['alloy', 'Echo', 'Shimmer'];
    if (voiceSettings && validVoiceSettings.includes(voiceSettings)) {
      updateData.voiceSettings = voiceSettings;
    }

    if (threshold !== undefined && typeof threshold === 'number') {
      updateData.threshold = threshold;
    }

    if (prefix_padding_ms !== undefined && typeof prefix_padding_ms === 'number') {
      updateData.prefix_padding_ms = prefix_padding_ms;
    }

    if (silence_duration_ms !== undefined && typeof silence_duration_ms === 'number') {
      updateData.silence_duration_ms = silence_duration_ms;
    }

    if (temperature !== undefined && typeof temperature === 'number') {
      updateData.temperature = temperature;
    }

    // Validate OpenAI API key if provided
    if (openaiApiKey) {
      // TODO: Implement validation for the provided API key
      // For now, we'll assume it's valid
      updateData.apiKey = 'user-provided';
    }

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: 'No valid update parameters provided' });
      return;
    }

    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    // Update the assistant document
    await assistantRef.update(updateData);

    res.status(200).json({ message: 'Assistant updated successfully' });
  } catch (error) {
    console.error('Error updating OpenAI assistant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
