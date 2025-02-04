// pages/api/parse-pdf.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { formidable, File } from 'formidable';
import fs from 'fs';
import pdfParse from 'pdf-parse';

// Disable Next.js's default body parser
export const config = {
  api: {
    bodyParser: false,
  },
};

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method === 'POST') {
    // Use formidable to parse the incoming form data
    const form = formidable();

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error('Error parsing form data:', err);
        return res.status(500).json({ error: 'Error parsing form data' });
      }

      let file: File;

      if (!files.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      } else if (Array.isArray(files.file)) {
        if (files.file.length === 0) {
          return res.status(400).json({ error: 'No file uploaded' });
        }
        file = files.file[0];
      } else {
        file = files.file;
      }

      try {
        const fileData = fs.readFileSync(file.filepath);
        const data = await pdfParse(fileData);
        res.status(200).json({ text: data.text });
      } catch (error) {
        console.error('Error parsing PDF:', error);
        res.status(500).json({ error: 'Failed to parse PDF' });
      }
    });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};

export default handler;
