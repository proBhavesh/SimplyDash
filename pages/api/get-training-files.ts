import { NextApiRequest, NextApiResponse } from 'next';
import { adminAuth } from '../../src/lib/firebase-admin';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Verify the user's token
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    await adminAuth.verifyIdToken(token);

    const { assistantId } = req.query;

    if (!assistantId || typeof assistantId !== 'string') {
      return res.status(400).json({ message: 'Missing or invalid assistant ID' });
    }

    // Get the assistant details to retrieve the file IDs
    const assistantResponse = await axios.get(`${process.env.VAPI_BASE_URL}/assistant/${assistantId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
      },
    });

    const fileIds = assistantResponse.data.model.knowledgeBase?.fileIds || [];

    // Fetch details for each file
    const filePromises = fileIds.map((fileId: string) =>
      axios.get(`${process.env.VAPI_BASE_URL}/file/${fileId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
        },
      })
    );

    const fileResponses = await Promise.all(filePromises);
    const trainingFiles = fileResponses.map(response => response.data);

    res.status(200).json(trainingFiles);
  } catch (error) {
    console.error('Error in get-training-files handler:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}