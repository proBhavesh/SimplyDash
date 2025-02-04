import { NextApiRequest, NextApiResponse } from 'next';
import { adminAuth } from '../../src/lib/firebase-admin';
import { handleError, ErrorResponse } from '../../src/utils/errorHandler';
import { errorLogger } from '../../src/utils/errorLogger';
import { vapiClient } from '../../src/utils/vapiClient';
import { Assistant } from '../../src/types/assistant';

const ALLOWED_CLIENT_MESSAGES = [
  'conversation-update',
  'function-call',
  'function-call-result',
  'hang',
  'language-changed',
  'metadata',
  'model-output',
  'speech-update',
  'status-update',
  'transcript',
  'tool-calls',
  'tool-calls-result',
  'user-interrupted',
  'voice-input'
];

const ALLOWED_SERVER_MESSAGES = [
  'conversation-update',
  'end-of-call-report',
  'function-call',
  'hang',
  'language-changed',
  'model-output',
  'phone-call-control',
  'speech-update',
  'status-update',
  'transcript',
  'tool-calls',
  'transfer-destination-request',
  'transfer-update',
  'user-interrupted',
  'voice-input'
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    await adminAuth.verifyIdToken(token);

    const { id, ...updateData } = req.body;

    if (!id) {
      return res.status(400).json({ message: 'Assistant ID is required' });
    }

    console.log('Received update data:', JSON.stringify({ id, ...updateData }, null, 2));

    // Ensure only allowed fields are being updated
    const allowedFields: (keyof Assistant)[] = ['name', 'model', 'voice', 'transcriber', 'firstMessage', 'clientMessages', 'serverMessages'];
    const filteredUpdateData = Object.fromEntries(
      Object.entries(updateData).filter(([key]) => allowedFields.includes(key as keyof Assistant))
    ) as Partial<Assistant>;

    // Handle clientMessages
    if (filteredUpdateData.clientMessages) {
      filteredUpdateData.clientMessages = filteredUpdateData.clientMessages.filter(
        message => ALLOWED_CLIENT_MESSAGES.includes(message)
      );
    }

    // Handle serverMessages
    if (filteredUpdateData.serverMessages) {
      filteredUpdateData.serverMessages = filteredUpdateData.serverMessages.filter(
        message => ALLOWED_SERVER_MESSAGES.includes(message)
      );
    }

    console.log('Filtered update data:', JSON.stringify(filteredUpdateData, null, 2));

    const updateResult = await vapiClient.updateAssistant(id, filteredUpdateData);
    console.log('Update result:', JSON.stringify(updateResult, null, 2));

    // Fetch the full assistant details after update
    const updatedAssistant = await vapiClient.getAssistant(id);
    console.log('Updated assistant:', JSON.stringify(updatedAssistant, null, 2));

    errorLogger.info('Assistant updated successfully', { 
      assistantId: id, 
      updatedFields: Object.keys(filteredUpdateData),
      updatedAssistant
    });

    res.status(200).json(updatedAssistant);
  } catch (error) {
    console.error('Error updating assistant:', error);
    const errorResponse = handleError(error);
    
    errorLogger.error('Failed to update assistant', {
      assistantId: req.body.id,
      error: errorResponse,
      stack: error instanceof Error ? error.stack : undefined
    });

    let statusCode = 500;
    let errorMessage = errorResponse.message;
    let errorDetails = errorResponse.details;

    if (error instanceof Error && error.message.includes('Vapi API error:')) {
      const match = error.message.match(/Vapi API error: (\d+) (.+?)\. Details: (.+)/);
      if (match) {
        statusCode = parseInt(match[1], 10);
        errorMessage = match[2];
        try {
          errorDetails = JSON.parse(match[3]);
        } catch (e) {
          errorDetails = match[3];
        }
      }
    }

    res.status(statusCode).json({ 
      message: errorMessage, 
      code: errorResponse.code || 'VAPI_API_ERROR',
      details: errorDetails
    });
  }
}