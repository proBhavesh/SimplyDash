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

    const { fileId } = req.query;

    if (!fileId || typeof fileId !== 'string') {
      return res.status(400).json({ message: 'Missing or invalid file ID' });
    }

    const response = await axios.get(`${process.env.VAPI_BASE_URL}/file/${fileId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
      },
    });

    // Check if the file has a URL property
    if (response.data && response.data.url) {
      res.status(200).json({ url: response.data.url });
    } else {
      res.status(404).json({ message: 'File URL not found' });
    }
  } catch (error) {
    console.error('Error in get-file handler:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}