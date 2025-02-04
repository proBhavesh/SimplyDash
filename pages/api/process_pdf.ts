// pages/api/process_pdf.ts

import { NextApiRequest, NextApiResponse } from 'next';
import * as pdfjsLib from 'pdfjs-dist';
import fs from 'fs';
import os from 'os';
import sharp from 'sharp';
import multer from 'multer';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createCanvas } from 'canvas';
import { admin, storage } from '../../src/lib/firebase-admin';

// Configure Multer for temporary file upload handling
const multerStorage = multer.diskStorage({
  destination: function (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void
  ) {
    cb(null, os.tmpdir());
  },
  filename: function (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void
  ) {
    cb(null, `${uuidv4()}-${file.originalname}`);
  },
});

const upload = multer({ storage: multerStorage });

// Get bucket reference with explicit bucket name
const firebaseBucket = storage.bucket('simplytalk-admin.appspot.com');
console.log('Bucket reference obtained:', firebaseBucket.name);

export const config = {
  api: {
    bodyParser: false,
  },
};

const shouldExcludePage = async (pageText: string): Promise<boolean> => {
  const excludePhrases = [
    'APPLICATION OVERVIEW DOCUMENT',
    'Application Context',
    'Data Objects & Integrations',
    'Live Data',
    'Personas',
  ];

  for (const phrase of excludePhrases) {
    if (pageText.includes(phrase)) {
      return true;
    }
  }
  return false;
};

const renderPageToImage = async (page: any, viewport: any): Promise<Buffer> => {
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext('2d');

  // Set white background
  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, viewport.width, viewport.height);

  try {
    // Draw the page content without calling .promise()
    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    // Convert canvas to PNG buffer
    return canvas.toBuffer('image/png');
  } catch (error) {
    console.error('Error rendering page:', error);
    throw error;
  }
};

const uploadToFirebase = async (
  buffer: Buffer,
  filename: string
): Promise<string> => {
  // Define the destination path in Firebase Storage
  const destination = `uploads/png/${filename}`;

  const file = firebaseBucket.file(destination);
  console.log('Uploading to Firebase Storage:', destination);

  try {
    await file.save(buffer, {
      metadata: {
        contentType: 'image/png',
        cacheControl: 'public, max-age=31536000',
      },
      public: true,
      resumable: false,
    });

    // Ensure the file is publicly accessible
    const [exists] = await file.exists();
    console.log(`File exists after upload: ${exists}`);

    if (!exists) {
      throw new Error('File was not saved properly to Firebase Storage.');
    }

    // Make the file public
    await file.makePublic();

    // Get the public URL
    const publicUrl = `https://storage.googleapis.com/${firebaseBucket.name}/${destination}`;
    console.log('Generated public URL:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('Error uploading to Firebase:', error);
    throw error;
  }
};

const processPdf = async (pdfPath: string): Promise<string[]> => {
  const pngUrls: string[] = [];
  const timestamp = Date.now();

  try {
    // Dynamically import pdf.js
    const pdfjsLib = await import('pdfjs-dist');

    // Initialize pdf.js without worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';

    // Read the PDF file
    const pdfData = new Uint8Array(fs.readFileSync(pdfPath));

    // Load the PDF document
    const pdfDocument = await pdfjsLib.getDocument({
      data: pdfData,
      disableFontFace: true,
    }).promise;

    const numPages = pdfDocument.numPages;
    console.log(`Processing PDF with ${numPages} pages`);

    let startProcessing = false; // Flag to indicate if we've found the start page
    let includeNextPage = true; // Flag for alternating pattern

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      console.log(`Processing page ${pageNum}`);
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');

      // Log the first 200 characters of each page's text for debugging
      console.log(
        `Page ${pageNum} content preview:`,
        pageText.substring(0, 200)
      );

      // Check if page should be excluded based on common exclusions
      if (await shouldExcludePage(pageText)) {
        console.log(`Skipping page ${pageNum} - excluded content`);
        if (pageText.includes('Data Objects & Integrations')) {
          console.log(
            'Found Data Objects & Integrations page - stopping processing'
          );
          break; // Stop processing when we hit Data Objects & Integrations
        }
        continue;
      }

      // Check if this is the start page - look for variations of the text
      if (
        !startProcessing &&
        (pageText.includes('Workflows (Case Types)') ||
          pageText.includes('Workflows(Case Types)') ||
          pageText.includes('Workflows (CaseTypes)') ||
          pageText.includes('Case Types') ||
          (pageText.toLowerCase().includes('workflows') &&
            pageText.toLowerCase().includes('case types')))
      ) {
        console.log(`Found start page at ${pageNum}`);
        startProcessing = true;
        includeNextPage = true; // Include this page
      }

      // Only process pages after we've found the start page
      if (startProcessing) {
        if (includeNextPage) {
          console.log(`Including page ${pageNum} in output`);
          // Get page dimensions and render to image
          const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better quality
          const imageBuffer = await renderPageToImage(page, viewport);

          // Process with sharp to optimize the image
          const optimizedBuffer = await sharp(imageBuffer).png().toBuffer();

          // Upload to Firebase Storage
          const filename = `case_type_${timestamp}_${pageNum}.png`;
          const publicUrl = await uploadToFirebase(optimizedBuffer, filename);

          console.log(`Successfully processed and uploaded page ${pageNum}`);
          pngUrls.push(publicUrl);
        } else {
          console.log(`Skipping page ${pageNum} - alternating pattern`);
        }

        // Toggle the flag for next page
        includeNextPage = !includeNextPage;
      } else {
        console.log(`Skipping page ${pageNum} - before start page`);
      }
    }

    if (pngUrls.length === 0) {
      console.log('No pages were processed. Start page was never found.');
      throw new Error('No case type pages found');
    }

    console.log('Final generated URLs:', pngUrls);
    return pngUrls;
  } catch (error) {
    console.error('Error processing PDF:', error);
    throw error;
  }
};

export default async function handler(
  req: NextApiRequest & { file?: Express.Multer.File },
  res: NextApiResponse
) {
  console.log('Starting PDF processing request');
  const uploadMiddleware = upload.single('file');

  try {
    await new Promise<void>((resolve, reject) => {
      uploadMiddleware(req as unknown as Request, res as any, (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const tempPdfPath = req.file.path;
    console.log('Temporary PDF path:', tempPdfPath);

    try {
      const pngUrls = await processPdf(tempPdfPath);
      // Remove temporary PDF file
      fs.unlinkSync(tempPdfPath);

      console.log('Processing completed successfully');
      return res.status(200).json({
        message: 'PDF processed successfully',
        png_urls: pngUrls,
      });
    } catch (error: any) {
      console.error('Error processing PDF:', error);
      if (fs.existsSync(tempPdfPath)) {
        fs.unlinkSync(tempPdfPath);
      }
      return res.status(500).json({ error: error.message });
    }
  } catch (error: any) {
    console.error('Error handling file upload:', error);
    return res.status(500).json({ error: 'File upload failed' });
  }
}
