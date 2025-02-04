// pages/api/create-assistant.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import formidable, { Fields, Files } from 'formidable';
import axios from 'axios';
import { db, adminAuth } from '../../src/lib/firebase-admin';
import fs from 'fs';
import FormData from 'form-data';
import { v4 as uuidv4 } from 'uuid'; // Import uuidv4

export const config = {
  api: {
    bodyParser: false, // Disable Next.js's built-in body parser
  },
};

// Promisify the form parsing function
const parseForm = (req: NextApiRequest): Promise<{ fields: Fields; files: Files }> => {
  return new Promise((resolve, reject) => {
    const form = formidable({ multiples: false });
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
};

// Add this interface near the top of your file
interface AssistantRequestData {
  name: string;
  transcriber: {
    provider: string;
    model: string;
    language: string;
  };
  model: {
    provider: string;
    model: string;
    messages: Array<{
      role: string;
      content: string;
    }>;
    knowledgeBase?: {
      provider: string;
      fileIds: string[];
    };
  };
  voice: {
    provider: string;
    voiceId: string;
  };
  clientMessages: string[];
  serverMessages: string[];
  userId?: string;
  firstMessage: string;
}

const DEFAULT_CLIENT_MESSAGES = [
  'conversation-update',
  'function-call',
  'hang',
  'model-output',
  'speech-update',
  'status-update',
  'transcript',
  'tool-calls',
  'user-interrupted',
  'voice-input',
];

const DEFAULT_SERVER_MESSAGES = [
  'conversation-update',
  'end-of-call-report',
  'function-call',
  'hang',
  'speech-update',
  'status-update',
  'tool-calls',
  'transfer-destination-request',
  'user-interrupted',
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('Create assistant handler started');
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Extract the Authorization header before parsing the form
  const authHeader = req.headers.authorization;
  console.log('Authorization Header:', authHeader);

  let userId: string | null = null;
  let workspaceId: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    console.log('Extracted Token:', token);

    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      userId = decodedToken.uid;
      console.log('User ID:', userId);

      // Get the workspace ID of the authenticated user
      const userDocRef = db.collection('users').doc(userId);
      const userDoc = await userDocRef.get();

      if (userDoc.exists) {
        const userData = userDoc.data();
        workspaceId = userData?.workspaceId || null;
      }
    } catch (error) {
      console.error('Invalid token:', error);
      // Proceed without userId
      userId = null;
      workspaceId = null;
    }
  }

  if (!userId) {
    // User is not authenticated, generate a unique workspaceId
    workspaceId = uuidv4();
  } else if (!workspaceId) {
    // User is authenticated but workspaceId is missing, use userId as workspaceId
    workspaceId = userId;
  }

  // Parse the multipart/form-data request
  let fields: Fields;
  let files: Files;
  try {
    ({ fields, files } = await parseForm(req));
    console.log('Parsed form data:', { fields, files });
  } catch (err) {
    console.error('Error parsing form data:', err);
    return res.status(400).json({ message: 'Error parsing form data' });
  }

  // Handle the possibility of fields being arrays
  let assistantNameValue = '';
  let assistantPromptValue = '';
  let firstMessageValue = '';
  let scrapedUrls: string[] = [];
  let scrapedContent: { [url: string]: string } = {};

  if (Array.isArray(fields.name)) {
    assistantNameValue = fields.name[0];
  } else if (typeof fields.name === 'string') {
    assistantNameValue = fields.name;
  } else {
    console.error('Missing or invalid "name" field');
    return res.status(400).json({ message: 'Missing or invalid "name" field' });
  }

  if (Array.isArray(fields.systemPrompt)) {
    assistantPromptValue = fields.systemPrompt[0];
  } else if (typeof fields.systemPrompt === 'string') {
    assistantPromptValue = fields.systemPrompt;
  } else {
    console.error('Missing or invalid "systemPrompt" field');
    return res.status(400).json({ message: 'Missing or invalid "systemPrompt" field' });
  }

  if (Array.isArray(fields.firstMessage)) {
    firstMessageValue = fields.firstMessage[0];
  } else if (typeof fields.firstMessage === 'string') {
    firstMessageValue = fields.firstMessage;
  } else {
    console.error('Missing or invalid "firstMessage" field');
    return res.status(400).json({ message: 'Missing or invalid "firstMessage" field' });
  }

  if (Array.isArray(fields.scrapedUrls)) {
    scrapedUrls = JSON.parse(fields.scrapedUrls[0]);
  } else if (typeof fields.scrapedUrls === 'string') {
    scrapedUrls = JSON.parse(fields.scrapedUrls);
  }

  if (Array.isArray(fields.scrapedContent)) {
    scrapedContent = JSON.parse(fields.scrapedContent[0]);
  } else if (typeof fields.scrapedContent === 'string') {
    scrapedContent = JSON.parse(fields.scrapedContent);
  }

  console.log('Extracted field values:', {
    assistantNameValue,
    assistantPromptValue,
    firstMessageValue,
    scrapedUrls,
    scrapedContent,
  });

  // Handle the training file if provided
  let trainingFileId = null;
  if (files.trainingFile) {
    const trainingFile = Array.isArray(files.trainingFile)
      ? files.trainingFile[0]
      : files.trainingFile;

    console.log('Training file:', trainingFile);

    // Create a FormData instance
    const formData = new FormData();
    formData.append(
      'file',
      fs.createReadStream(trainingFile.filepath),
      trainingFile.originalFilename || 'uploaded_file'
    );

    try {
      const fileUploadResponse = await axios.post(
        `${process.env.VAPI_BASE_URL}/file`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
            // Include the correct headers with boundary
            ...formData.getHeaders(),
          },
        }
      );
      trainingFileId = fileUploadResponse.data.id;
      console.log('Training file uploaded, ID:', trainingFileId);
    } catch (error) {
      console.error('Error uploading training file:', error);
      return res.status(500).json({ message: 'Error uploading training file' });
    }
  }

  // Update assistantRequestData with required fields
  const assistantRequestData: AssistantRequestData = {
    name: assistantNameValue,
    transcriber: {
      provider: 'deepgram',
      model: 'general',
      language: 'en-US',
    },
    model: {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: assistantPromptValue,
        },
        {
          role: 'assistant',
          content: firstMessageValue,
        },
      ],
      ...(trainingFileId
        ? {
            knowledgeBase: {
              provider: 'canonical',
              fileIds: [trainingFileId],
            },
          }
        : {}),
    },
    voice: {
      provider: '11labs',
      voiceId: 'ThT5KcBeYPX3keUQqHPh',
    },
    clientMessages: DEFAULT_CLIENT_MESSAGES,
    serverMessages: DEFAULT_SERVER_MESSAGES,
    firstMessage: firstMessageValue,
  };

  // If userId is available, include it in the assistant data
  if (userId) {
    assistantRequestData.userId = userId;
  }

  try {
    console.log('Sending assistant request data:', JSON.stringify(assistantRequestData, null, 2));
    const assistantResponse = await axios.post(
      `${process.env.VAPI_BASE_URL}/assistant`,
      assistantRequestData,
      {
        headers: {
          Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const vapiAssistant = assistantResponse.data;
    console.log(
      'Received vapi assistant data:',
      JSON.stringify(vapiAssistant, null, 2)
    );

    // Store the assistant in Firestore with VAPI assistant ID
    const assistantId = vapiAssistant.id;

    const assistantData: any = {
      id: assistantId,
      name: assistantNameValue,
      systemPrompt: assistantPromptValue,
      firstMessage: firstMessageValue,
      isSubscribed: false, // Set initial subscription status to false
      userId: userId || null, // Associate the assistant with the user's ID if available
      workspaceId: workspaceId, // Include workspaceId
      createdAt: vapiAssistant.createdAt,
      updatedAt: vapiAssistant.updatedAt,
      clientMessages: DEFAULT_CLIENT_MESSAGES,
      serverMessages: DEFAULT_SERVER_MESSAGES,
      scrapedUrls: scrapedUrls,
    };

    await db.collection('assistants').doc(assistantId).set(assistantData);

    // Process scraped content
    for (const [url, content] of Object.entries(scrapedContent)) {
      try {
        const formData = new FormData();
        formData.append('file', Buffer.from(content), {
          filename: `scraped_${url}.txt`,
        });

        const fileUploadResponse = await axios.post(
          `${process.env.VAPI_BASE_URL}/file`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
              ...formData.getHeaders(),
            },
          }
        );

        const fileId = fileUploadResponse.data.id;

        // Update the assistant's knowledgeBase with the new file
        await axios.patch(
          `${process.env.VAPI_BASE_URL}/assistant/${assistantId}`,
          {
            model: {
              knowledgeBase: {
                provider: 'canonical',
                fileIds: [
                  ...(assistantRequestData.model.knowledgeBase?.fileIds || []),
                  fileId,
                ],
              },
            },
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
              'Content-Type': 'application/json',
            },
          }
        );

        console.log(`Successfully processed scraped content for URL: ${url}`);
      } catch (error) {
        console.error(`Error processing scraped content for URL ${url}:`, error);
      }
    }

    console.log('Assistant created successfully, ID:', assistantId);
    res.status(201).json({ id: assistantId });
  } catch (error) {
    console.error('Error creating assistant:', error);

    if (axios.isAxiosError(error) && error.response) {
      console.error('VAPI API Error response:', error.response.data);
    }

    let errorMessage = 'Internal server error';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    res.status(500).json({ message: 'Internal server error', error: errorMessage });
  }
}
