import { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../src/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { assistantId } = req.query;

  if (!assistantId || typeof assistantId !== 'string') {
    return res.status(400).json({ error: 'Invalid assistant ID' });
  }

  try {
    const assistantDoc = await db.collection('assistants').doc(assistantId).get();

    if (!assistantDoc.exists) {
      return res.status(404).json({ error: 'Assistant not found' });
    }

    const assistantData = assistantDoc.data();

    if (!assistantData) {
      return res.status(500).json({ error: 'Failed to retrieve assistant data' });
    }

    const config = {
      assistantId: assistantId,
      apiKey: process.env.VAPI_PUBLIC_API_KEY,
      name: assistantData.name,
      systemPrompt: assistantData.systemPrompt,
    };

    if (!config.apiKey) {
      console.error('VAPI_PUBLIC_API_KEY is not set in the environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    res.status(200).json(config);
  } catch (error) {
    console.error('Error fetching assistant data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}