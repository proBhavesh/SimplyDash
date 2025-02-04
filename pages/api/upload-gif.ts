// pages/api/upload-gif.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { admin, db, storage } from '../../src/lib/firebase-admin';
import formidable, { Fields, Files, File } from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Allowed types for GIF uploads
const allowedTypes = ['waiting', 'talking'];

// Increase the file size limits
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB max file size
const MAX_TOTAL_FILE_SIZE = 200 * 1024 * 1024; // 200MB total file size

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    const form = formidable({
      maxFileSize: MAX_FILE_SIZE, // Updated max file size
      maxTotalFileSize: MAX_TOTAL_FILE_SIZE, // Updated max total file size
    });

    form.parse(req, async (err: any, fields: Fields, files: Files) => {
      if (err) {
        console.error('Error parsing form data:', err);

        if (err.httpCode === 413) {
          // File too large
          return res.status(413).json({
            message: 'File is too large. Maximum allowed size is 100MB.',
          });
        }

        return res.status(400).json({ message: 'Error parsing form data' });
      }

      // Extract assistantId and type from fields
      const assistantIdField = fields.assistantId;
      const typeField = fields.type;

      const assistantId = (Array.isArray(assistantIdField)
        ? assistantIdField[0]
        : assistantIdField) as string;

      const type = (Array.isArray(typeField) ? typeField[0] : typeField) as string;

      // Validate type
      if (!allowedTypes.includes(type)) {
        return res.status(400).json({ message: 'Invalid type parameter' });
      }

      // Extract file from files
      const fileField = files.file;
      const file = Array.isArray(fileField) ? fileField[0] : fileField;

      if (!assistantId || !type || !file) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      // Function to find assistant in both collections
      const findAssistant = async (collectionName: string) => {
        const assistantDoc = await db
          .collection(collectionName)
          .doc(assistantId)
          .get();
        return assistantDoc.exists ? assistantDoc : null;
      };

      // Try to find the assistant in 'assistants' collection
      let assistantDoc = await findAssistant('assistants');

      // If not found, try 'openaiAssistants' collection
      let collectionName = 'assistants';
      if (!assistantDoc) {
        assistantDoc = await findAssistant('openaiAssistants');
        collectionName = 'openaiAssistants';
      }

      if (!assistantDoc) {
        return res.status(404).json({ message: 'Assistant not found' });
      }

      const assistantData = assistantDoc.data();

      // Check if the user is authorized to modify this assistant
      if (assistantData?.userId !== uid && assistantData?.orgId !== uid) {
        return res.status(403).json({ message: 'Access denied' });
      }

      console.log('Accessing Firebase Storage bucket');
      const storageBucket =
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
        `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.appspot.com`;
      const bucket = storage.bucket(storageBucket);
      console.log('Storage bucket name:', bucket.name);

      if (!bucket) {
        console.error('Storage bucket is not initialized');
        return res
          .status(500)
          .json({ message: 'Storage bucket is not initialized' });
      }

      const fileName = `assistants/${assistantId}/${type}_${Date.now()}.gif`;
      const filePath = file.filepath;

      if (!filePath) {
        return res.status(400).json({ message: 'File path not found' });
      }

      const fileBuffer = fs.readFileSync(filePath);

      try {
        console.log('Uploading file to storage:', fileName);
        await bucket.file(fileName).save(fileBuffer, {
          metadata: {
            contentType: 'image/gif',
          },
        });
        console.log('File uploaded successfully');

        const [url] = await bucket.file(fileName).getSignedUrl({
          action: 'read',
          expires: '03-01-2500', // Set a far future expiration date
        });

        console.log('Generated signed URL:', url);

        const updateData = {
          [`${type}GifPath`]: fileName,
          [`${type}GifUrl`]: url,
        };

        // Update the assistant document
        await db
          .collection(collectionName)
          .doc(assistantId)
          .update(updateData);

        console.log('Assistant document updated with new GIF information');

        res.status(200).json({ message: 'GIF uploaded successfully', url });
      } catch (uploadError) {
        console.error('Error uploading file to storage:', uploadError);
        res.status(500).json({
          message: 'Error uploading file to storage',
          error:
            uploadError instanceof Error ? uploadError.message : 'Unknown error',
        });
      }
    });
  } catch (error) {
    console.error('Error in upload-gif handler:', error);
    res.status(500).json({
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
