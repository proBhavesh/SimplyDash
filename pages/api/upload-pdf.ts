// pages/api/upload-pdf.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import formidable, { IncomingForm, Fields, Files, File } from 'formidable';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';

// Disable body parsing by Next.js to handle file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

// Retrieve the Vector Store ID and OpenAI API Key from environment variables
const vectorStoreId = process.env.VECTOR_STORE_ID;

if (!vectorStoreId) {
  throw new Error('VECTOR_STORE_ID environment variable is not set');
}

const openaiApiKey = process.env.OPENAI_API_KEY;

if (!openaiApiKey) {
  throw new Error('OPENAI_API_KEY environment variable is not set');
}

const OPENAI_API_BASE_URL = 'https://api.openai.com/v1';

// Common headers for OpenAI API requests
const openaiHeaders = {
  Authorization: `Bearer ${openaiApiKey}`,
  'OpenAI-Beta': 'assistants=v2',
};

export default async function uploadPdf(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const form = new IncomingForm();

  form.parse(req, async (err: Error | null, fields: Fields, files: Files) => {
    if (err) {
      console.error('Error parsing form:', err);
      res.status(500).json({ error: 'Error parsing form data' });
      return;
    }

    const uploadedFiles = files.file;

    let file: formidable.File;

    if (Array.isArray(uploadedFiles)) {
      // Handle multiple files if necessary
      file = uploadedFiles[0];
    } else if (uploadedFiles) {
      file = uploadedFiles;
    } else {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const filePath = file.filepath;
    const fileName = file.originalFilename || 'uploaded.pdf';

    try {
      // Step 1: List existing vector store files
      const listResponse = await axios.get(
        `${OPENAI_API_BASE_URL}/vector_stores/${vectorStoreId}/files`,
        {
          headers: {
            ...openaiHeaders,
            'Content-Type': 'application/json',
          },
        }
      );

      const vectorStoreFiles = listResponse.data.data;

      // Step 2: Delete pre-existing files
      for (const vectorFile of vectorStoreFiles) {
        await axios.delete(
          `${OPENAI_API_BASE_URL}/vector_stores/${vectorStoreId}/files/${vectorFile.id}`,
          {
            headers: {
              ...openaiHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      // Step 3: Upload the new file with purpose "assistants"
      const fileStream = fs.createReadStream(filePath);

      const formData = new FormData();
      formData.append('file', fileStream, fileName);
      formData.append('purpose', 'assistants'); // Changed 'assistant' to 'assistants'

      const uploadResponse = await axios.post(
        `${OPENAI_API_BASE_URL}/files`,
        formData,
        {
          headers: {
            ...openaiHeaders,
            ...formData.getHeaders(),
          },
        }
      );

      const uploadedFile = uploadResponse.data;

      // Step 4: Attach the file to the vector store
      await axios.post(
        `${OPENAI_API_BASE_URL}/vector_stores/${vectorStoreId}/files`,
        {
          file_id: uploadedFile.id,
        },
        {
          headers: {
            ...openaiHeaders,
            'Content-Type': 'application/json',
          },
        }
      );

      // Clean up uploaded file from the server
      fs.unlinkSync(filePath);

      // Proceed to Step 5: Continue with existing implementation after attaching the file
      // (e.g., trigger the archyupload endpoint, which is already implemented elsewhere)

      res.status(200).json({
        message: 'File uploaded and attached to vector store successfully',
      });
    } catch (error: any) {
      console.error('Error handling upload:', error.response?.data || error.message || error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.response?.data || error.message || error,
      });
    }
  });
}
