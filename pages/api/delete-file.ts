import { NextApiRequest, NextApiResponse } from 'next';
import { adminAuth } from '../../src/lib/firebase-admin';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Verify the user's token
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    await adminAuth.verifyIdToken(token);

    const { assistantId, fileId } = req.query;

    if (!assistantId || typeof assistantId !== 'string' || !fileId || typeof fileId !== 'string') {
      return res.status(400).json({ message: 'Missing or invalid assistant ID or file ID' });
    }

    // Get the assistant details
    const assistantResponse = await axios.get(`${process.env.VAPI_BASE_URL}/assistant/${assistantId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
      },
    });

    const assistant = assistantResponse.data;

    // Remove the file ID from the assistant's knowledgeBase
    const updatedFileIds = assistant.model.knowledgeBase?.fileIds.filter((id: string) => id !== fileId) || [];

    // Update the assistant with the new file IDs
    await axios.patch(`${process.env.VAPI_BASE_URL}/assistant/${assistantId}`, {
      model: {
        ...assistant.model,
        knowledgeBase: {
          ...assistant.model.knowledgeBase,
          fileIds: updatedFileIds,
        },
      },
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    // Delete the file from Vapi
    await axios.delete(`${process.env.VAPI_BASE_URL}/file/${fileId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
      },
    });

    res.status(200).json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error in delete-file handler:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}