// pages/api/openai-assistant-config.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../src/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { workspaceId, assistantName } = req.query;

  if (
    !workspaceId ||
    !assistantName ||
    typeof workspaceId !== 'string' ||
    typeof assistantName !== 'string'
  ) {
    return res.status(400).json({ error: 'Invalid workspace ID or assistant name' });
  }

  try {
    // Query the openaiAssistants collection
    const assistantQuerySnapshot = await db
      .collection('openaiAssistants')
      .where('workspaceId', '==', workspaceId)
      .where('name', '==', assistantName)
      .where('isPublished', '==', true)
      .limit(1)
      .get();

    if (assistantQuerySnapshot.empty) {
      return res.status(404).json({ error: 'Assistant not found or not published' });
    }

    const assistantDoc = assistantQuerySnapshot.docs[0];
    const assistantData = assistantDoc.data();

    if (!assistantData) {
      return res.status(500).json({ error: 'Failed to retrieve assistant data' });
    }

    const config = {
      workspaceId: workspaceId,
      assistantName: assistantName,
      assistantId: assistantDoc.id,
      waitingGifUrl: assistantData.waitingGifUrl,
      talkingGifUrl: assistantData.talkingGifUrl,
      makeWebhookUrl: assistantData.makeWebhookUrl, // Added makeWebhookUrl
      instructions: assistantData.instructions || '', // Included instructions
      voiceSettings: assistantData.voiceSettings || 'alloy',
      threshold: assistantData.threshold !== undefined ? assistantData.threshold : 0.5,
      prefix_padding_ms:
        assistantData.prefix_padding_ms !== undefined
          ? assistantData.prefix_padding_ms
          : 500,
      silence_duration_ms:
        assistantData.silence_duration_ms !== undefined
          ? assistantData.silence_duration_ms
          : 300,
      temperature:
        assistantData.temperature !== undefined ? assistantData.temperature : 0.6,
      // Include assistant settings
      modalities: assistantData.modalities || ['audio'],
      input_audio_format: assistantData.input_audio_format || 'pcm_s16le',
      output_audio_format: assistantData.output_audio_format || 'pcm_s16le',
      input_audio_transcription: assistantData.input_audio_transcription || {
        model: 'whisper-1',
      },
      turn_detection: assistantData.turn_detection || {
        type: 'server_vad',
        threshold:
          assistantData.threshold !== undefined ? assistantData.threshold : 0.5,
        prefix_padding_ms:
          assistantData.prefix_padding_ms !== undefined
            ? assistantData.prefix_padding_ms
            : 500,
        silence_duration_ms:
          assistantData.silence_duration_ms !== undefined
            ? assistantData.silence_duration_ms
            : 300,
      },
      tool_choice: assistantData.tool_choice || 'auto',
      // Include function definitions
      functionDefinitions: assistantData.functionDefinitions || [],
    };

    res.status(200).json(config);
  } catch (error) {
    console.error('Error fetching assistant data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
