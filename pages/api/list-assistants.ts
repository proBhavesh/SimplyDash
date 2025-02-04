import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from 'firebase-admin/auth';
import { fetchWithVapiAuth } from '../../src/utils/vapiClient';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { handleError, ErrorResponse } from '../../src/utils/errorHandler';

if (!global.firebaseAdmin) {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
      databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseio.com`,
    });
  }
}

const db = getFirestore();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('list-assistants: Handler called');

  if (req.method !== 'GET') {
    const error = new Error('Method Not Allowed');
    (error as any).code = 'METHOD_NOT_ALLOWED';
    const errorResponse = handleError(error);
    return res.status(405).json(errorResponse);
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const error = new Error('Unauthorized: Missing or invalid authorization header');
      (error as any).code = 'UNAUTHORIZED';
      const errorResponse = handleError(error);
      return res.status(401).json(errorResponse);
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      console.log('Verifying ID token');
      decodedToken = await getAuth().verifyIdToken(idToken);
      console.log('ID token verified successfully');
    } catch (error) {
      console.error('Error verifying ID token:', error);
      const customError = new Error('Unauthorized: Invalid ID token');
      (customError as any).code = 'UNAUTHORIZED';
      const errorResponse = handleError(customError);
      return res.status(401).json(errorResponse);
    }

    const uid = decodedToken.uid;
    console.log('User UID:', uid);

    let userDoc;
    try {
      console.log('Fetching user document');
      const userRef = db.collection('users').doc(uid);
      userDoc = await userRef.get();
      
      if (!userDoc.exists) {
        console.log('User document not found. Creating a new one.');
        const userData = {
          email: decodedToken.email,
          createdAt: new Date().toISOString(),
          assistants: []
        };
        await userRef.set(userData);
        userDoc = await userRef.get();
      }
      
      console.log('User document fetched/created successfully');
    } catch (error) {
      console.error('Error fetching/creating user document:', error);
      const customError = new Error('Internal Server Error: Failed to fetch/create user data');
      (customError as any).code = 'INTERNAL_SERVER_ERROR';
      const errorResponse = handleError(customError);
      return res.status(500).json(errorResponse);
    }

    const userData = userDoc.data();
    const isAdmin = userData?.isAdmin || false;
    console.log('User is admin:', isAdmin);

    let assistantsSnapshot;

    if (isAdmin) {
      console.log('Fetching all assistants for admin');
      assistantsSnapshot = await db.collection('assistants').get();
    } else {
      console.log('Fetching assistants for regular user');
      assistantsSnapshot = await db.collection('assistants').where('userId', '==', uid).get();
    }

    const assistants = [];
    for (const doc of assistantsSnapshot.docs) {
      const assistantData = doc.data();
      console.log(`Assistant ${doc.id} data:`, assistantData);
      
      const apiUrl = `${process.env.VAPI_BASE_URL}/assistant/${doc.id}`;
      console.log(`Fetching assistant from Vapi API: ${apiUrl}`);
      
      try {
        const vapiResponse = await fetchWithVapiAuth(apiUrl);
        if (!vapiResponse.ok) {
          console.error(`Vapi API error for assistant ${doc.id}: ${vapiResponse.statusText}`);
          continue;
        }
        const vapiAssistant = await vapiResponse.json();
        assistants.push({
          ...vapiAssistant,
          isSubscribed: assistantData.isSubscribed || false,
          waitingGifUrl: assistantData.waitingGifUrl || null,
          talkingGifUrl: assistantData.talkingGifUrl || null
        });
        console.log(`Assistant ${doc.id} subscription status:`, assistantData.isSubscribed);
        console.log(`Assistant ${doc.id} waiting GIF URL:`, assistantData.waitingGifUrl);
        console.log(`Assistant ${doc.id} talking GIF URL:`, assistantData.talkingGifUrl);
      } catch (error) {
        console.error(`Error fetching assistant ${doc.id}:`, error);
        // We're not throwing here to allow other assistants to be fetched
      }
    }

    console.log('Assistants fetched successfully:', assistants.length);
    console.log('Assistants with subscription status and GIF URLs:', assistants.map(a => ({ 
      id: a.id, 
      isSubscribed: a.isSubscribed,
      waitingGifUrl: a.waitingGifUrl,
      talkingGifUrl: a.talkingGifUrl
    })));
    res.status(200).json(assistants);
  } catch (error) {
    console.error('Error in list-assistants:', error);
    const customError = new Error('Internal Server Error');
    (customError as any).code = 'INTERNAL_SERVER_ERROR';
    const errorResponse = handleError(customError);
    res.status(500).json(errorResponse);
  }
}