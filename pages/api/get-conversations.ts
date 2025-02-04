import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { adminAuth } from '../../src/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { assistantId } = req.query;
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    await adminAuth.verifyIdToken(token);

    const response = await axios.get(`${process.env.VAPI_BASE_URL}/call?assistantId=${assistantId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const conversations = response.data.map((call: any) => ({
      id: call.id,
      user: call.from || 'Unknown User',
      timestamp: call.createdAt,
    }));

    res.status(200).json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Error fetching conversations' });
  }
}