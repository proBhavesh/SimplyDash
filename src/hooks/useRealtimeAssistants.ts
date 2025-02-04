// src/hooks/useRealtimeAssistants.ts

import { useState, useEffect, useCallback } from 'react';
import { getAuth, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { app } from '../app/firebaseConfig';
import { Assistant } from '../types/assistant';
import { fetchWithAuth } from '../utils/api';
import { handleError, ErrorResponse } from '../utils/errorHandler';
import toastUtils from '../utils/toast';

export function useRealtimeAssistants(isAdmin: boolean) {
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorResponse | null>(null);
  const [user, setUser] = useState<FirebaseUser | null>(getAuth().currentUser);

  const db = getFirestore(app);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const fetchAssistants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!user) {
        throw new Error('User not logged in');
      }

      // Fetch OpenAI Realtime assistants from Firestore
      let realtimeAssistants: Assistant[] = [];
      try {
        const assistantsRef = collection(db, 'openaiAssistants');
        let q;

        if (isAdmin) {
          // For admin users, fetch all assistants
          q = assistantsRef;
        } else {
          // For regular users, fetch only their assistants
          q = query(assistantsRef, where('userId', '==', user.uid));
        }

        const querySnapshot = await getDocs(q);
        realtimeAssistants = querySnapshot.docs
          .map((doc) => {
            const data = doc.data();
            // Filter out assistants where deleted is true
            if (data.deleted) {
              return null;
            }
            const assistant: Assistant = {
              id: doc.id,
              orgId: data.orgId || 'default-org-id',
              name: data.name || 'Unnamed Assistant',
              description: data.instructions || '',
              createdAt: data.createdAt || new Date().toISOString(),
              updatedAt: data.updatedAt || new Date().toISOString(),
              type: 'openai-realtime',
              isSubscribed: false,
              voice: {
                model: '', // OpenAI Realtime assistants may not have a voice model
                voiceId: data.voiceSettings || 'alloy',
                provider: 'openai',
                stability: 0,
                similarityBoost: 0,
                fillerInjectionEnabled: false,
                optimizeStreamingLatency: 0,
              },
              model: {
                model: '', // Specify model if available
                messages: [], // Add messages if applicable
                provider: 'openai',
                functions: [], // Add functions if applicable
                maxTokens: 0,
                temperature: data.temperature || 0.6,
                emotionRecognitionEnabled: false,
              },
              usage: {
                totalMinutes: 0,
                totalCost: 0,
                dailyData: [],
              },
              // Add any other necessary fields
            };
            return assistant;
          })
          .filter((assistant): assistant is Assistant => assistant !== null);
      } catch (err) {
        console.error('Error fetching OpenAI Realtime assistants:', err);
        throw new Error(
          `Failed to fetch OpenAI Realtime assistants: ${
            err instanceof Error ? err.message : 'Unknown error'
          }`
        );
      }

      setAssistants(realtimeAssistants);
      toastUtils.success('Realtime assistants loaded successfully');
    } catch (err) {
      console.error('Error in fetchAssistants:', err);
      const errorResponse = handleError(err);
      setError(errorResponse);
      toastUtils.error(errorResponse.message);
    } finally {
      setLoading(false);
    }
  }, [user, db, isAdmin]);

  useEffect(() => {
    fetchAssistants();
  }, [fetchAssistants]);

  const deleteAssistant = useCallback(async (assistantId: string) => {
    try {
      const response = await fetchWithAuth(
        `/api/delete-openai-assistant?assistantId=${assistantId}`,
        {
          method: 'DELETE',
          // No headers or body needed since we're sending assistantId in the URL
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete assistant');
      }
      setAssistants((prevAssistants) =>
        prevAssistants.filter((a) => a.id !== assistantId)
      );
      toastUtils.success('Assistant deleted successfully');
    } catch (error) {
      console.error('Error deleting assistant:', error);
      const errorResponse = handleError(error);
      setError(errorResponse);
      toastUtils.error(errorResponse.message);
    }
  }, []);

  return {
    assistants,
    loading,
    error,
    fetchAssistants,
    deleteAssistant,
  };
}
