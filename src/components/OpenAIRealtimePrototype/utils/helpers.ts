// src/components/OpenAIRealtimePrototype/utils/helpers.ts

import { useCallback } from 'react';
import { getAuth } from 'firebase/auth';
import { v4 as uuidv4 } from 'uuid';
import { RealtimeEvent, HistoryItem } from '../types';
import { Components } from './logger';
import { MAX_REALTIME_EVENTS, MAX_CONVERSATION_HISTORY } from '../constants';

// Helper function to format time
export const useFormatTime = (startTimeRef: React.MutableRefObject<number>) =>
  useCallback(
    (timestamp: number) => {
      const delta = timestamp - startTimeRef.current;
      const seconds = Math.floor(delta / 1000);
      const milliseconds = delta % 1000;
      return `${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
    },
    [startTimeRef]
  );

// Helper function to add realtime events
export const useAddRealtimeEvent = (
  formatTime: (timestamp: number) => string,
  setRealtimeEvents: React.Dispatch<React.SetStateAction<RealtimeEvent[]>>
) =>
  useCallback(
    (source: 'client' | 'server', event: string) => {
      setRealtimeEvents((prevEvents) => {
        const newEvent: RealtimeEvent = {
          time: formatTime(Date.now()),
          source,
          event,
        };

        const lastEvent = prevEvents[prevEvents.length - 1];
        let updatedEvents = prevEvents;

        if (lastEvent && lastEvent.event === event && lastEvent.source === source) {
          const updatedLastEvent = { ...lastEvent, count: (lastEvent.count || 1) + 1 };
          updatedEvents = [...prevEvents.slice(0, -1), updatedLastEvent];
        } else {
          updatedEvents = [...prevEvents, newEvent];
        }

        if (updatedEvents.length > MAX_REALTIME_EVENTS) {
          updatedEvents = updatedEvents.slice(updatedEvents.length - MAX_REALTIME_EVENTS);
        }

        return updatedEvents;
      });
    },
    [formatTime, setRealtimeEvents]
  );

// Helper function to generate a conversation ID
export const useGenerateConversationId = (
  setConversationId: React.Dispatch<React.SetStateAction<string>>,
  conversationIdRef: React.MutableRefObject<string>
) =>
  useCallback(() => {
    const id = uuidv4();
    conversationIdRef.current = id;
    setConversationId(id);
    return id;
  }, [setConversationId, conversationIdRef]);

// Helper function to identify the user
export const useIdentifyUser = (
  setUserIdentifier: React.Dispatch<React.SetStateAction<string | null>>,
  setAccessMethod: React.Dispatch<React.SetStateAction<'phone_number' | 'web' | null>>
) =>
  useCallback(() => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (user) {
        setUserIdentifier(user.uid);
        setAccessMethod('web');
      } else {
        let tempUserId = localStorage.getItem('tempUserId');
        if (!tempUserId) {
          tempUserId = uuidv4();
          localStorage.setItem('tempUserId', tempUserId);
        }
        setUserIdentifier(tempUserId);
        setAccessMethod('web');
      }
    } catch (error) {
      console.error('Error identifying user:', error);
    }
  }, [setUserIdentifier, setAccessMethod]);

// Helper function to add to conversation history
export const useAddToConversationHistory = (
  conversationHistoryRef: React.MutableRefObject<HistoryItem[]>
) =>
  useCallback(
    (historyItem: HistoryItem) => {
      conversationHistoryRef.current.push(historyItem);
      if (conversationHistoryRef.current.length > MAX_CONVERSATION_HISTORY) {
        conversationHistoryRef.current.shift();
      }
    },
    [conversationHistoryRef]
  );
