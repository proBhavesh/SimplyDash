import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, cert } from 'firebase-admin/app';
import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('Handling request to /api/admin/list-assistants');

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.error('Authorization header is missing');
    return res.status(401).json({ error: 'Unauthorized - Missing Authorization Header' });
  }

  const token = authHeader.split('Bearer ')[1];

  if (!token) {
    console.error('Token is missing after splitting Authorization header');
    return res.status(401).json({ error: 'Unauthorized - Invalid Token Format' });
  }

  try {
    console.log('Verifying token...');
    const decodedToken = await getAuth().verifyIdToken(token);
    console.log('Decoded token:', decodedToken);

    if (decodedToken.email?.toLowerCase() !== 'vincent@getinference.com') {
      console.error('User is not admin:', decodedToken.email);
      return res.status(403).json({ error: 'Forbidden - User is not admin' });
    }

    // Use server-side environment variables
    const vapiBaseUrl = process.env.VAPI_BASE_URL;
    const vapiApiKey = process.env.VAPI_API_KEY;

    if (!vapiBaseUrl || !vapiApiKey) {
      console.error('VAPI base URL or API key is not set');
      return res.status(500).json({ error: 'VAPI base URL or API key is not set' });
    }

    const vapiUrl = `${vapiBaseUrl}/assistant`; // Updated endpoint
    console.log(`Fetching assistants from VAPI at: ${vapiUrl}`);

    const response = await fetch(vapiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`,
      },
    });

    console.log(`VAPI response status: ${response.status}`);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Error fetching assistants from VAPI:', errorData);
      return res.status(500).json({ error: 'Failed to fetch assistants from VAPI', details: errorData });
    }

    const data = await response.json();
    console.log('Assistants data from VAPI:', JSON.stringify(data, null, 2));

    res.status(200).json(data);
  } catch (error) {
    console.error('Error in admin/list-assistants handler:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}