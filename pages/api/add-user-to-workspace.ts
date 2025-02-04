// pages/api/add-user-to-workspace.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { admin, db } from '../../src/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Verify the authenticated user
    const authorizationHeader = req.headers.authorization || '';
    const token = authorizationHeader.startsWith('Bearer ')
      ? authorizationHeader.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify the ID token using admin.auth()
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;

    // Get the workspace ID of the authenticated user
    const userDocRef = db.collection('users').doc(uid);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User document not found.' });
    }

    const userData = userDoc.data();
    const workspaceId = userData?.workspaceId;

    if (!workspaceId) {
      return res.status(400).json({ error: 'Workspace ID not found for user.' });
    }

    // Create the new user
    const newUser = await admin.auth().createUser({
      email,
      password,
      displayName: name || '',
    });

    // Set the user data in Firestore
    await db.collection('users').doc(newUser.uid).set({
      email,
      name: name || '',
      workspaceId,
      createdAt: admin.firestore.Timestamp.now(),
    });

    res.status(200).json({ message: 'User added to workspace successfully.' });
  } catch (error) {
    console.error('Error adding user to workspace:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}
