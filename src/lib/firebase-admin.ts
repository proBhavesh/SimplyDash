// src/lib/firebase-admin.ts

import * as admin from 'firebase-admin';

console.log('Starting Firebase Admin SDK initialization');

if (!admin.apps.length) {
  try {
    console.log('Environment variables:');
    console.log('NEXT_PUBLIC_FIREBASE_PROJECT_ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
    console.log('FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL);
    console.log('FIREBASE_PRIVATE_KEY length:', process.env.FIREBASE_PRIVATE_KEY?.length);
    console.log('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:', process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);

    // Correctly parse the private key
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('FIREBASE_PRIVATE_KEY is not set');
    }

    // Remove any surrounding quotes (in case the key is wrapped in quotes)
    privateKey = privateKey.replace(/^"|"$/g, '');

    // Replace escaped newline characters with actual newline characters
    privateKey = privateKey.replace(/\\n/g, '\n');

    const serviceAccount = {
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    };

    console.log('Service Account:');
    console.log('projectId:', serviceAccount.projectId);
    console.log('clientEmail:', serviceAccount.clientEmail);
    console.log('privateKey length:', serviceAccount.privateKey?.length);

    if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
      throw new Error('Firebase service account configuration is incomplete');
    }

    const storageBucket =
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
      `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.appspot.com`;
    console.log('Using storage bucket:', storageBucket);

    console.log('Initializing Firebase Admin SDK...');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      storageBucket: storageBucket,
    });

    console.log('Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
} else {
  console.log('Firebase Admin SDK already initialized');
}

console.log('Initializing Firebase services...');

let adminAuth: admin.auth.Auth;
let db: admin.firestore.Firestore;
let storage: admin.storage.Storage;

try {
  console.log('Initializing Firebase Auth');
  adminAuth = admin.auth();
  console.log('Firebase Auth initialized successfully');

  console.log('Initializing Firestore');
  db = admin.firestore();
  console.log('Firestore initialized successfully');

  console.log('Initializing Firebase Storage');
  storage = admin.storage();
  console.log('Firebase Storage initialized successfully');

  const storageBucket =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.appspot.com`;
  const bucket = storage.bucket(storageBucket);
  console.log('Firebase storage bucket initialized successfully:', bucket.name);
} catch (error) {
  console.error('Error initializing Firebase services:', error);
  if (error instanceof Error) {
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
  }
  throw error;
}

console.log('All Firebase services initialized successfully');

export { admin, adminAuth, db, storage };
