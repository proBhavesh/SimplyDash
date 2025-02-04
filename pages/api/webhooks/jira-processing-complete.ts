// pages/api/webhooks/jira-processing-complete.ts

import { NextApiRequest, NextApiResponse } from 'next';

// In-memory store for processing status (for demonstration purposes)
let processingStatus: any = {
  status: 'pending',
  message: 'Processing not started',
};

// Endpoint to handle webhook notifications from Jira processing service
export default async function jiraProcessingComplete(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    // Extract the processing result from the webhook payload
    const processingResult = req.body;

    // Update the processing status in the in-memory store
    processingStatus = {
      status: 'success',
      ...processingResult,
    };

    console.log('Processing completed:', processingResult);

    res.status(200).json({ message: 'Webhook received and processing status updated.' });
  } catch (error) {
    console.error('Error handling webhook:', error);
    processingStatus = {
      status: 'failure',
      message: 'Processing failed due to an error.',
    };
    res.status(500).json({ error: 'Error handling webhook' });
  }
}

// Export the processingStatus for other API routes to access
export { processingStatus };
