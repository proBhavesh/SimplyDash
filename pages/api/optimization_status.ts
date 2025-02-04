// pages/api/optimization_status.ts
import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const response = await axios.get(
        'https://jira.simplytalk.ai/optimization_status',
        { timeout: 120000 } // Timeout set to 120 seconds
      );
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Error in /api/optimization_status:', error);
    if (axios.isAxiosError(error) && error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
