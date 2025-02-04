import type { NextApiRequest, NextApiResponse } from 'next';
import { storage, adminAuth } from '../../src/lib/firebase-admin';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('Test Firebase Storage API - Start');

  if (req.method !== 'GET') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Check for authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Unauthorized: Missing or invalid authorization header');
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    // Verify the token
    console.log('Verifying ID token');
    const decodedToken = await adminAuth.verifyIdToken(token);
    console.log('Authenticated user:', decodedToken.uid);

    console.log('Attempting to access Firebase Storage');
    const bucket = storage.bucket();
    console.log('Firebase Storage bucket accessed successfully');
    console.log('Bucket name:', bucket.name);

    // Test bucket existence
    console.log('Checking if bucket exists');
    const [exists] = await bucket.exists();
    console.log('Bucket exists:', exists);

    if (!exists) {
      throw new Error('Bucket does not exist');
    }

    // List files in the bucket (limited to 10)
    console.log('Listing files in bucket');
    const [files] = await bucket.getFiles({ maxResults: 10 });
    console.log('Files in bucket:', files.map(file => file.name));

    // Test file upload
    console.log('Testing file upload');
    const testFileName = `test-file-${Date.now()}.txt`;
    const file = bucket.file(testFileName);
    await file.save('This is a test file', {
      metadata: { contentType: 'text/plain' }
    });
    console.log('Test file uploaded successfully:', testFileName);

    // Test file download
    console.log('Testing file download');
    const [fileContent] = await file.download();
    console.log('Test file content:', fileContent.toString());

    // Clean up: delete the test file
    console.log('Deleting test file');
    await file.delete();
    console.log('Test file deleted successfully');

    res.status(200).json({
      message: 'Firebase Storage test successful',
      bucketName: bucket.name,
      fileCount: files.length,
      files: files.map(file => file.name),
      testFileContent: fileContent.toString()
    });
  } catch (error) {
    console.error('Error in Firebase Storage test:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    res.status(500).json({
      message: 'Error in Firebase Storage test',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  console.log('Test Firebase Storage API - End');
}