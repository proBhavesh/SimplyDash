import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { handleError } from '../../src/utils/errorHandler';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import os from 'os';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('Unauthenticated scrape website handler started');

  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { url } = req.body;
    console.log('Received request:', { url });

    if (!url) {
      console.log('Missing required parameters');
      return res.status(400).json({ message: 'URL is required' });
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

    // Step 3: Return the file path and content to the client
    res.status(200).json({ 
      message: 'Website scraped successfully', 
      filePath: filePath,
      content: scrapedContent
    });
  } catch (error) {
    console.error('Error scraping website:', error);
    const errorResponse = handleError(error);
    if (axios.isAxiosError(error) && error.response) {
      console.error('Axios error response:', error.response.data);
    }
    res.status(typeof errorResponse.code === 'number' ? errorResponse.code : 500).json(errorResponse);
  }
}