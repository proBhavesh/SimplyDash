// pages/api/process_jira_subtasks.ts
import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }
  try {
    const response = await axios.post('https://jira.simplytalk.ai/process_jira_subtasks');
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Error in /api/process_jira_subtasks:', error);
    if (axios.isAxiosError(error) && error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
