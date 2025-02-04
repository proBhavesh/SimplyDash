// pages/api/cleanup-pngs.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '../../src/lib/firebase-admin';

// Get bucket reference with explicit bucket name
const bucket = storage.bucket('simplytalk-admin.appspot.com');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { png_urls } = req.body;
  
  if (!Array.isArray(png_urls)) {
    return res.status(400).json({ error: 'png_urls must be an array' });
  }

  try {
    // Delete all PNG files
    await Promise.all(png_urls.map(url => {
      const parts = url.split('/');
      const filename = parts[parts.length - 1];
      const filePath = `uploads/png/${filename}`;
      return bucket.file(filePath).delete();
    }));
    
    res.status(200).json({ message: 'Cleanup successful' });
  } catch (error) {
    console.error('Error during cleanup:', error);
    res.status(500).json({ error: 'Cleanup failed' });
  }
}
