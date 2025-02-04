// pages/api/get-analytics.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from 'firebase-admin/auth';
import { fetchWithVapiAuth } from '../../src/utils/vapiClient';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { handleError } from '../../src/utils/errorHandler';
import { errorLogger } from '../../src/utils/errorLogger';

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

interface CustomError extends Error {
  code?: string;
}

interface UserData {
  email?: string;
  createdAt?: string;
  assistants?: string[];
}

interface AnalyticsResultItem {
  assistantId: string;
  // Add other properties as needed based on the API response
}

interface QueryResult {
  result?: AnalyticsResultItem[];
  // Add other properties if needed
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  errorLogger.info('get-analytics: Handler called');
  if (req.method !== 'POST') {
    errorLogger.warn('get-analytics: Method not allowed');
    const error: CustomError = new Error('Method Not Allowed');
    error.code = 'METHOD_NOT_ALLOWED';
    const errorResponse = handleError(error);
    return res.status(405).json(errorResponse);
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      errorLogger.warn('get-analytics: Unauthorized - missing or invalid auth header');
      const error: CustomError = new Error('Unauthorized');
      error.code = 'UNAUTHORIZED';
      const errorResponse = handleError(error);
      return res.status(401).json(errorResponse);
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (error) {
      errorLogger.error('get-analytics: Error verifying ID token', error);
      const customError: CustomError = new Error('Invalid token');
      customError.code = 'UNAUTHORIZED';
      const errorResponse = handleError(customError);
      return res.status(401).json(errorResponse);
    }

    const uid = decodedToken.uid;
    errorLogger.info(`get-analytics: Authenticated user ${uid}`);

    // Check if user document exists, create if it doesn't
    const userRef = db.collection('users').doc(uid);
    let userDoc = await userRef.get();

    if (!userDoc.exists) {
      errorLogger.info(`get-analytics: User document not found for ${uid}. Creating a new one.`);
      const userData: UserData = {
        email: decodedToken.email,
        createdAt: new Date().toISOString(),
        assistants: []
      };
      await userRef.set(userData);
      userDoc = await userRef.get();
    }

    const userData = userDoc.data() as UserData;
    // Check if the user's email is vincent@getinference.com
    const isAdmin = userData?.email === 'vincent@getinference.com';
    errorLogger.info(`get-analytics: User ${uid} isAdmin: ${isAdmin}`);

    const { queries } = req.body;
    errorLogger.info('get-analytics: Received queries:', JSON.stringify(queries, null, 2));

    if (!Array.isArray(queries)) {
      errorLogger.warn('get-analytics: Invalid queries format');
      const error: CustomError = new Error('Invalid queries format');
      error.code = 'BAD_REQUEST';
      const errorResponse = handleError(error);
      return res.status(400).json(errorResponse);
    }

    const apiUrl = 'https://api.vapi.ai/analytics';
    errorLogger.info(`get-analytics: Fetching data from Vapi API: ${apiUrl}`);
    let vapiResponse;
    try {
      vapiResponse = await fetchWithVapiAuth(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ queries }),
      });

      if (!vapiResponse.ok) {
        errorLogger.error(`get-analytics: Vapi API error: ${vapiResponse.statusText}`);
        errorLogger.error(`get-analytics: Vapi API response status: ${vapiResponse.status}`);
        const responseText = await vapiResponse.text();
        errorLogger.error(`get-analytics: Vapi API response body: ${responseText}`);
        throw new Error(`Vapi API error: ${vapiResponse.statusText}`);
      }
    } catch (error) {
      errorLogger.error('get-analytics: Error fetching data from Vapi API', error);
      const customError: CustomError = new Error('Failed to fetch analytics data');
      customError.code = 'INTERNAL_SERVER_ERROR';
      const errorResponse = handleError(customError);
      return res.status(500).json(errorResponse);
    }

    let analyticsData: QueryResult[];
    try {
      analyticsData = await vapiResponse.json();
      errorLogger.info('get-analytics: Received analytics data from Vapi:', JSON.stringify(analyticsData, null, 2));
    } catch (error) {
      errorLogger.error('get-analytics: Error parsing Vapi API response', error);
      const customError: CustomError = new Error('Failed to parse analytics data');
      customError.code = 'INTERNAL_SERVER_ERROR';
      const errorResponse = handleError(customError);
      return res.status(500).json(errorResponse);
    }

    if (!isAdmin) {
      errorLogger.info('get-analytics: Filtering data for non-admin user');
      // Filter out data for assistants that don't belong to the user
      const userAssistantsSnapshot = await db.collection('assistants').where('userId', '==', uid).get();
      const userAssistantIds = userAssistantsSnapshot.docs.map(doc => doc.id);
      errorLogger.info(`get-analytics: User assistant IDs: ${userAssistantIds.join(', ')}`);

      analyticsData.forEach((queryResult) => {
        if (Array.isArray(queryResult.result)) {
          queryResult.result = queryResult.result.filter((item: AnalyticsResultItem) => userAssistantIds.includes(item.assistantId));
        }
      });
    } else {
      errorLogger.info('get-analytics: Returning all data for admin user');
    }

    errorLogger.info('get-analytics: Final analytics data:', JSON.stringify(analyticsData, null, 2));
    res.status(200).json(analyticsData);
  } catch (error) {
    errorLogger.error('Error in get-analytics:', error);
    const customError: CustomError = new Error('Internal Server Error');
    customError.code = 'INTERNAL_SERVER_ERROR';
    const errorResponse = handleError(customError);
    res.status(500).json(errorResponse);
  }
}
