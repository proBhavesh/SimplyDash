// pages/api/delete-assistant.ts

import type { NextApiRequest, NextApiResponse } from 'next';
import { adminAuth, db } from '../../src/lib/firebase-admin';
import { handleError } from '../../src/utils/errorHandler';
import { fetchWithVapiAuth } from '../../src/utils/vapiClient';
import { FieldValue } from 'firebase-admin/firestore';

interface CustomError extends Error {
  code?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    const error: CustomError = new Error('Method Not Allowed');
    error.code = 'METHOD_NOT_ALLOWED';
    const errorResponse = handleError(error);
    return res.status(405).json(errorResponse);
  }

  try {
    // Extract assistantId from query parameters
    const assistantId = req.query.assistantId;
    if (!assistantId || typeof assistantId !== 'string') {
      const error: CustomError = new Error('Assistant ID is required');
      error.code = 'BAD_REQUEST';
      const errorResponse = handleError(error);
      return res.status(400).json(errorResponse);
    }

    // Verify the user's token from the Authorization header
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      const error: CustomError = new Error('Unauthorized');
      error.code = 'UNAUTHORIZED';
      const errorResponse = handleError(error);
      return res.status(401).json(errorResponse);
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      console.error('Error verifying token:', error);
      const customError: CustomError = new Error('Invalid token');
      customError.code = 'UNAUTHORIZED';
      const errorResponse = handleError(customError);
      return res.status(401).json(errorResponse);
    }

    const userId = decodedToken.uid;

    // Check if user document exists, create if it doesn't
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.log('User document not found. Creating a new one.');
      const userData = {
        email: decodedToken.email,
        createdAt: new Date().toISOString(),
        assistants: [],
      };
      await userRef.set(userData);
    }

    // Get the assistant document from Firestore
    const assistantDocRef = db.collection('assistants').doc(assistantId);
    const assistantDoc = await assistantDocRef.get();

    if (!assistantDoc.exists) {
      const error: CustomError = new Error('Assistant not found');
      error.code = 'NOT_FOUND';
      const errorResponse = handleError(error);
      return res.status(404).json(errorResponse);
    }

    const assistantData = assistantDoc.data();

    // Verify that the assistant belongs to the authenticated user
    if (assistantData?.userId !== userId) {
      const error: CustomError = new Error('Forbidden: You do not have permission to delete this assistant');
      error.code = 'FORBIDDEN';
      const errorResponse = handleError(error);
      return res.status(403).json(errorResponse);
    }

    // Delete assistant from Firestore
    try {
      await assistantDocRef.delete();
      console.log(`Successfully deleted assistant ${assistantId} from Firestore`);

      // Remove assistant from user's assistants array
      await userRef.update({
        assistants: FieldValue.arrayRemove(assistantId),
      });
    } catch (firestoreError) {
      console.error(`Error deleting assistant ${assistantId} from Firestore:`, firestoreError);
      const error: CustomError = new Error('Failed to delete assistant from Firestore');
      error.code = 'INTERNAL_SERVER_ERROR';
      const errorResponse = handleError(error);
      return res.status(500).json(errorResponse);
    }

    // Delete assistant from VAPI
    try {
      const vapiResponse = await fetchWithVapiAuth(`${process.env.VAPI_BASE_URL}/assistant/${assistantId}`, {
        method: 'DELETE',
      });

      if (!vapiResponse.ok) {
        throw new Error(await vapiResponse.text());
      }
    } catch (vapiError) {
      console.error('Error deleting assistant from VAPI:', vapiError);
      const error: CustomError = new Error('Failed to delete assistant from VAPI');
      error.code = 'INTERNAL_SERVER_ERROR';
      const errorResponse = handleError(error);
      return res.status(500).json(errorResponse);
    }

    return res.status(200).json({ message: 'Assistant deleted successfully' });
  } catch (error) {
    console.error('Error deleting assistant:', error);
    const customError: CustomError = new Error('Internal server error');
    customError.code = 'INTERNAL_SERVER_ERROR';
    const errorResponse = handleError(customError);
    return res.status(500).json(errorResponse);
  }
}

// Enable body parsing for DELETE requests
export const config = {
  api: {
    bodyParser: true,
  },
};
