import {
  getFirestore,
  doc,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { app } from '../../../app/firebaseConfig';
import type { ConversationItem } from '../types';

const db = getFirestore(app);

export const saveMessageToFirestore = async (
  item: ConversationItem,
  assistantId: string,
  conversationId: string,
  userIdentifier: string | null,
  accessMethod: 'phone_number' | 'web' | null
) => {
  if (!assistantId || !conversationId) return;

  try {
    const conversationRef = doc(db, 'openaiAssistants', assistantId, 'conversations', conversationId);
    const messagesRef = collection(conversationRef, 'messages');

    const messageData = {
      id: item.id,
      role: item.role,
      type: item.type,
      content: item.formatted?.transcript || item.formatted?.text || item.formatted?.output || '',
      timestamp: serverTimestamp(),
      status: item.status || 'completed',
      user: {
        identifier: userIdentifier,
        accessMethod: accessMethod,
      },
      formatted: item.formatted || {},
    };

    await addDoc(messagesRef, messageData);
  } catch (error) {
    console.error('Error saving message to Firestore:', error);
  }
};

export const loadConversationHistory = async (
  assistantId: string,
  conversationId: string
): Promise<ConversationItem[]> => {
  if (!assistantId || !conversationId) return [];

  try {
    const conversationRef = doc(db, 'openaiAssistants', assistantId, 'conversations', conversationId);
    const messagesRef = collection(conversationRef, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: data.id,
        role: data.role,
        type: data.type,
        content: data.content,
        status: data.status || 'completed',
        formatted: data.formatted || {},
      } as ConversationItem;
    });
  } catch (error) {
    console.error('Error loading conversation history:', error);
    return [];
  }
};
