import { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm } from 'formidable';
import { adminAuth } from '../../src/lib/firebase-admin';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';

export const config = {
  api: {
    bodyParser: false,
  },
};

const ALLOWED_FILE_TYPES = [
  'text/markdown',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log("Upload file handler started");

  if (req.method !== 'POST') {
    console.log("Method not allowed:", req.method);
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Verify the user's token
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      console.log("No authorization token provided");
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    console.log("Verifying token");
    await adminAuth.verifyIdToken(token);
    console.log("Token verified");

    const form = new IncomingForm();
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error("Error parsing form data:", err);
        return res.status(500).json({ message: 'Error parsing form data' });
      }

      console.log("Form data parsed:", { fields, files });

      const file = Array.isArray(files.file) ? files.file[0] : files.file;
      const assistantId = Array.isArray(fields.assistantId) ? fields.assistantId[0] : fields.assistantId;

      if (!file) {
        console.log("No file provided");
        return res.status(400).json({ message: 'Missing file' });
      }

      if (!ALLOWED_FILE_TYPES.includes(file.mimetype || '')) {
        console.log("Invalid file type:", file.mimetype);
        return res.status(400).json({ message: 'Invalid file type. Please upload Markdown, PDF, plain text, or Microsoft Word files.' });
      }

      console.log("File and assistantId:", { file: file.originalFilename, assistantId });

      // Upload file to Vapi
      const formData = new FormData();
      formData.append('file', fs.createReadStream(file.filepath), {
        filename: file.originalFilename || 'uploaded_file',
        contentType: file.mimetype || 'application/octet-stream',
      });

      try {
        console.log("Uploading file to Vapi");
        const uploadResponse = await axios.post(`${process.env.VAPI_BASE_URL}/file`, formData, {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
          },
        });

        const uploadedFile = uploadResponse.data;
        console.log("File uploaded to Vapi:", uploadedFile);

        // If assistantId is provided, update the existing assistant
        if (assistantId) {
          console.log("Updating assistant with new file");
          const assistantResponse = await axios.get(`${process.env.VAPI_BASE_URL}/assistant/${assistantId}`, {
            headers: {
              'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
            },
          });

          const assistant = assistantResponse.data;

          const updatedAssistant = await axios.patch(`${process.env.VAPI_BASE_URL}/assistant/${assistantId}`, {
            model: {
              ...assistant.model,
              knowledgeBase: {
                ...assistant.model.knowledgeBase,
                fileIds: [...(assistant.model.knowledgeBase?.fileIds || []), uploadedFile.id],
              },
            },
          }, {
            headers: {
              'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
              'Content-Type': 'application/json',
            },
          });

          console.log("Assistant updated successfully");
          res.status(200).json({ message: 'File uploaded and assistant updated successfully', file: uploadedFile, assistant: updatedAssistant.data });
        } else {
          console.log("No assistantId provided, returning uploaded file info");
          res.status(200).json({ message: 'File uploaded successfully', file: uploadedFile });
        }
      } catch (error) {
        console.error('Error uploading file to Vapi:', error);
        res.status(500).json({ message: 'Error uploading file to Vapi' });
      }
    });
  } catch (error) {
    console.error('Error in upload-file handler:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}