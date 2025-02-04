// pages/api/create-authenticated-assistant-with-scraping.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import axios from 'axios';
import { db, adminAuth } from '../../src/lib/firebase-admin';
import fs from 'fs';
import FormData from 'form-data';
import { URL } from 'url';
import { v4 as uuidv4 } from 'uuid'; // Import uuidv4

export const config = {
  api: {
    bodyParser: false,
  },
};

const parseForm = (
  req: NextApiRequest
): Promise<{ fields: formidable.Fields; files: formidable.Files }> => {
  return new Promise((resolve, reject) => {
    const form = formidable({ multiples: false });
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });
};

const getFieldValue = (field: string | string[] | undefined): string => {
  if (Array.isArray(field)) {
    return field[0] || '';
  }
  return field || '';
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Verify Firebase ID token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // Retrieve workspaceId from user's document
    let workspaceId: string | null = null;
    const userDocRef = db.collection('users').doc(userId);

    try {
      const userDoc = await userDocRef.get();

      if (userDoc.exists) {
        const userData = userDoc.data();
        workspaceId = userData?.workspaceId || null;
      }
    } catch (error) {
      console.error('Error retrieving user document:', error);
    }

    if (!workspaceId) {
      // Generate a new workspaceId and save it to the user document
      workspaceId = uuidv4();
      try {
        await userDocRef.set({ workspaceId }, { merge: true });
      } catch (error) {
        console.error('Error setting workspaceId in user document:', error);
      }
    }

    const { fields, files } = await parseForm(req);

    // Extract and validate required fields
    const assistantName = getFieldValue(fields.name);
    const systemPrompt = getFieldValue(fields.systemPrompt);
    const firstMessage = getFieldValue(fields.firstMessage);
    const scrapedUrls = JSON.parse(getFieldValue(fields.scrapedUrls || '[]'));
    const scrapedContent = JSON.parse(getFieldValue(fields.scrapedContent || '{}'));

    if (!assistantName || !systemPrompt || !firstMessage) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Process scraped content
    const scrapedFileIds = await Promise.all(
      Object.entries(scrapedContent).map(async ([scrapedUrl, content]) => {
        // Generate a safe filename based on the URL
        let filename = 'scraped_content.txt';
        try {
          const parsedUrl = new URL(scrapedUrl);
          const pathname = parsedUrl.pathname.replace(/[^a-zA-Z0-9]/g, '_');
          const hostname = parsedUrl.hostname.replace(/[^a-zA-Z0-9]/g, '_');
          const sanitizedPathname = pathname || 'root';
          filename = `${hostname}_${sanitizedPathname}.txt`;

          // Limit filename length to avoid issues
          if (filename.length > 100) {
            filename = filename.substring(0, 100);
          }
        } catch (error) {
          console.error('Invalid URL:', scrapedUrl);
        }

        const formData = new FormData();
        formData.append('file', Buffer.from(content as string), {
          filename: filename,
          contentType: 'text/plain',
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

        return fileUploadResponse.data.id;
      })
    );

    // Handle training file if provided
    let trainingFileId = null;
    if (files.trainingFile) {
      const trainingFile = Array.isArray(files.trainingFile)
        ? files.trainingFile[0]
        : files.trainingFile;

      // Ensure the MIME type is acceptable
      const supportedMimeTypes = [
        'text/markdown',
        'application/pdf',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];

      const fileMimeType = trainingFile.mimetype || 'application/octet-stream';

      if (!supportedMimeTypes.includes(fileMimeType)) {
        return res.status(400).json({
          message: `Unsupported file type: ${fileMimeType}. Supported types are: ${supportedMimeTypes.join(
            ', '
          )}`,
        });
      }

      const formData = new FormData();
      formData.append('file', fs.createReadStream(trainingFile.filepath), {
        filename: trainingFile.originalFilename || 'uploaded_file',
        contentType: fileMimeType,
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
      trainingFileId = fileUploadResponse.data.id;
    }

    // Create assistant request data
    const assistantRequestData = {
      name: assistantName,
      transcriber: {
        provider: 'deepgram',
        model: 'general',
        language: 'en-US',
      },
      model: {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'assistant', content: firstMessage },
        ],
        knowledgeBase: {
          provider: 'canonical',
          fileIds: [
            ...(trainingFileId ? [trainingFileId] : []),
            ...scrapedFileIds,
          ],
        },
      },
      voice: {
        provider: '11labs',
        voiceId: 'ThT5KcBeYPX3keUQqHPh',
      },
      firstMessage: firstMessage,
    };

    // Create assistant in VAPI
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

    // Store assistant in Firestore and associate with user
    await db
      .collection('assistants')
      .doc(vapiAssistant.id)
      .set({
        id: vapiAssistant.id,
        name: assistantName,
        systemPrompt: systemPrompt,
        firstMessage: firstMessage,
        isSubscribed: false,
        createdAt: vapiAssistant.createdAt,
        updatedAt: vapiAssistant.updatedAt,
        scrapedUrls: scrapedUrls,
        userId: userId, // Associate the assistant with the authenticated user
        workspaceId: workspaceId, // Include workspaceId
      });

    res.status(201).json({ id: vapiAssistant.id });
  } catch (error) {
    console.error('Error creating assistant with scraping:', error);
    res.status(500).json({
      message: 'Internal server error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
