// src/utils/firestore.ts

import {
  collection,
  addDoc,
  query,
  limit,
  getDocs,
  where,
  Timestamp,
  doc,
  getDoc,
  orderBy,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../app/firebaseConfig';

interface TokenUsage {
  totalTokens: number;
  inputTokens: {
    total: number;
    cached: number;
    text: number;
    audio: number;
  };
  outputTokens: {
    total: number;
    text: number;
    audio: number;
  };
  remainingRequests: number;
  requestLimit: number;
}

interface ConversationItem {
  sessionId: string;
  conversationId: string;
  timestamp: Timestamp;
  role: 'user' | 'assistant';
  content: string;
  userId: string;
  assistantId: string;
}

export const storeConversationItem = async (
  assistantId: string,
  sessionId: string,
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
) => {
  console.log('Entering storeConversationItem function');
  try {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      console.error('Unauthorized: User not authenticated');
      throw new Error('Unauthorized: User not authenticated');
    }

    const docData: ConversationItem = {
      assistantId,
      sessionId,
      conversationId,
      timestamp: Timestamp.now(),
      role,
      content,
      userId: user.uid,
    };

    const collectionRef = collection(db, 'conversations');
    const docRef = await addDoc(collectionRef, docData);

    console.log('Conversation item stored with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error storing conversation item:', error);
    throw error;
  }
};

export const getLatestConversations = async (
  assistantId: string,
  limitCount = 10
) => {
  console.log('Entering getLatestConversations function');
  try {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      console.error('Unauthorized: User not authenticated');
      throw new Error('Unauthorized: User not authenticated');
    }

    const q = query(
      collection(db, 'conversations'),
      where('userId', '==', user.uid),
      where('assistantId', '==', assistantId),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    console.log('Number of conversations retrieved:', querySnapshot.size);
    const conversations = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as ConversationItem),
    }));

    return conversations;
  } catch (error) {
    console.error('Error retrieving latest conversations:', error);
    throw error;
  }
};

export const storeTokenUsage = async (
  tokenUsage: TokenUsage,
  rateLimits: any[],
  sessionId: string,
  conversationId: string,
  assistantId: string
) => {
  console.log('Entering storeTokenUsage function');
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    console.log('Current user:', user?.email);

    if (!user) {
      console.error('Unauthorized: User not authenticated');
      throw new Error('Unauthorized: User not authenticated');
    }

    console.log('User authenticated:', user.email);

    // Get workspaceId for the user
    const workspaceId = await getUserWorkspaceId(user.uid);

    const collectionRef = collection(db, 'tokenUsage');

    const docData = {
      tokenUsage,
      rateLimits,
      timestamp: Timestamp.now(),
      userId: user.uid,
      userEmail: user.email,
      workspaceId,
      assistantId,
      sessionId,
      conversationId,
    };

    const docRef = await addDoc(collectionRef, docData);

    console.log('Token usage document written with ID: ', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error adding token usage document: ', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
};

const getUserWorkspaceId = async (userId: string): Promise<string> => {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      const data = userDoc.data();
      return data.workspaceId;
    } else {
      throw new Error('User document not found');
    }
  } catch (error) {
    console.error('Error getting user workspace ID:', error);
    throw error;
  }
};

export const getLatestTokenUsage = async (limitCount = 10) => {
  console.log('Entering getLatestTokenUsage function');
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    console.log('Current user:', user?.email);

    if (!user) {
      console.error('Unauthorized: User not authenticated');
      throw new Error('Unauthorized: User not authenticated');
    }

    console.log('User authenticated:', user.email);

    const q = query(
      collection(db, 'tokenUsage'),
      where('userId', '==', user.uid),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    console.log('Number of documents retrieved:', querySnapshot.size);
    return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting latest token usage: ', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
};
