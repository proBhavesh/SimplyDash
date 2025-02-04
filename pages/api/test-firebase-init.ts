import type { NextApiRequest, NextApiResponse } from 'next'
import { db, storage } from '../../src/lib/firebase-admin'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('GET /api/test-firebase-init - Start');

  // Log Firebase-related environment variables (without exposing sensitive data)
  console.log('NEXT_PUBLIC_FIREBASE_PROJECT_ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  console.log('FIREBASE_CLIENT_EMAIL is set:', !!process.env.FIREBASE_CLIENT_EMAIL);
  console.log('FIREBASE_PRIVATE_KEY is set:', !!process.env.FIREBASE_PRIVATE_KEY);
  console.log('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:', process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);

  try {
    // Test Firestore
    console.log('Testing Firestore...');
    const testDoc = await db.collection('test').doc('test').get();
    console.log('Firestore test successful');

    // Test Storage
    console.log('Testing Storage...');
    const bucket = storage.bucket();
    console.log('Storage bucket name:', bucket.name);
    const [files] = await bucket.getFiles({ maxResults: 1 });
    console.log('Storage test successful');

    res.status(200).json({ 
      message: 'Firebase initialization successful', 
      firestoreTest: !!testDoc, 
      storageTest: !!files,
      bucketName: bucket.name
    });
  } catch (error) {
    console.error('Error in test-firebase-init:', error);
    let errorMessage = 'Firebase initialization failed';
    let errorDetails = {};

    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = {
        name: error.name,
        stack: error.stack
      };
    }

    res.status(500).json({ 
      message: errorMessage, 
      error: errorDetails,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    });
  }
}