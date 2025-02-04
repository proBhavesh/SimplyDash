// pages/api/proxy-claude-vision.ts

import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body;

    // If it's a relative path, convert it to a local file path
    if (message.startsWith('/uploads/')) {
      const filePath = path.join(process.cwd(), 'public', message);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return res.status(404).json({ error: 'File not found' });
      }

      // Read the file and convert to base64
      const imageBuffer = fs.readFileSync(filePath);
      const base64Image = imageBuffer.toString('base64');
      
      // Send base64 image data to Claude Vision
      const response = await axios.post('https://c5kpj2.buildship.run/claudevision', {
        message: `data:image/png;base64,${base64Image}`
      });

      return res.status(200).json(response.data);
    } else {
      // Forward the original URL if it's not a local file
      const response = await axios.post('https://c5kpj2.buildship.run/claudevision', {
        message
      });

      return res.status(200).json(response.data);
    }
  } catch (error: any) {
    console.error('Error proxying to Claude Vision:', error);
    return res.status(500).json({ error: error.message });
  }
}
