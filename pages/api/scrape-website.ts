import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { adminAuth } from '../../src/lib/firebase-admin';
import { handleError } from '../../src/utils/errorHandler';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import os from 'os';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('Scrape website handler started');

  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Unauthorized: No valid authorization header');
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    console.log('Verifying token');
    await adminAuth.verifyIdToken(token);
    console.log('Token verified successfully');

    const { url, assistantId } = req.body;
    console.log('Received request:', { url, assistantId });

    if (!url || !assistantId) {
      console.log('Missing required parameters');
      return res.status(400).json({ message: 'URL and assistantId are required' });
    }

    // Step 1: Scrape the website
    const jinaReaderUrl = `https://r.jina.ai/${url}`;
    console.log('Jina Reader URL:', jinaReaderUrl);
    
    console.log('Sending request to Jina Reader...');
    const jinaResponse = await axios.get(jinaReaderUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.JINA_API_KEY}`
      }
    });
    console.log('Jina Reader response status:', jinaResponse.status);

    const scrapedContent = jinaResponse.data;
    console.log('Scraped content length:', scrapedContent.length);

    // Step 2: Create a temporary file
    const tempDir = os.tmpdir();
    const fileName = `scraped_content_${Date.now()}.txt`;
    const filePath = path.join(tempDir, fileName);
    
    console.log('Creating temporary file:', filePath);
    fs.writeFileSync(filePath, scrapedContent);
    console.log('Temporary file created');

    // Step 3: Upload the file to VAPI
    console.log('Uploading file to VAPI');
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath), {
      filename: fileName,
      contentType: 'text/plain',
    });

    const uploadResponse = await axios.post(`${process.env.VAPI_BASE_URL}/file`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
      },
    });

    const uploadedFile = uploadResponse.data;
    console.log('File uploaded to VAPI:', uploadedFile);

    // Update the assistant with the new file
    console.log('Updating assistant with new file');
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
          provider: 'canonical', // Add this line to specify the provider
        },
      },
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Assistant updated successfully');

    // Clean up the temporary file
    fs.unlinkSync(filePath);
    console.log('Temporary file deleted');

    res.status(200).json({ message: 'Website scraped, file uploaded, and assistant updated successfully', file: uploadedFile, assistant: updatedAssistant.data });
  } catch (error) {
    console.error('Error scraping website:', error);
    const errorResponse = handleError(error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('Axios error response:', error.response.data);
    }
    res.status(typeof errorResponse.code === 'number' ? errorResponse.code : 500).json(errorResponse);
  }
}