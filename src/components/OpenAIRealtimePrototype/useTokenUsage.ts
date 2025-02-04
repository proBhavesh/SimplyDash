// src/components/OpenAIRealtimePrototype/useTokenUsage.ts

import { useState, useRef, useEffect, useCallback } from 'react';
import { storeTokenUsage } from '../../utils/firestore';
import toastUtils from '../../utils/toast';

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
  sessionTotalTokens: number;
}

interface RateLimit {
  name: string;
  limit: number;
  remaining: number;
  reset_seconds: number;
}

const useTokenUsage = (
  isConnected: boolean,
  isAdmin: boolean,
  initialSessionId: string,
  initialConversationId: string,
  assistantId: string
) => {
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>({
    totalTokens: 0,
    inputTokens: { total: 0, cached: 0, text: 0, audio: 0 },
    outputTokens: { total: 0, text: 0, audio: 0 },
    remainingRequests: 20000,
    requestLimit: 20000,
    sessionTotalTokens: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>(initialSessionId);
  const [conversationId, setConversationId] = useState<string>(initialConversationId);

  const latestTokenUsageRef = useRef<TokenUsage>(tokenUsage);

  useEffect(() => {
    console.log('useTokenUsage: Connection state changed', { isConnected, sessionId, conversationId });
  }, [isConnected, sessionId, conversationId]);

  useEffect(() => {
    setSessionId(initialSessionId);
    setConversationId(initialConversationId);
  }, [initialSessionId, initialConversationId]);

  const updateTokenUsage = useCallback(
    (
      usage: Partial<TokenUsage> | null,
      rateLimits: RateLimit[],
      newSessionId: string,
      newConversationId: string
    ) => {
      console.log('updateTokenUsage called with:', { usage, rateLimits, newSessionId, newConversationId });
      if (newSessionId !== sessionId) {
        setSessionId(newSessionId);
        console.log('Session ID updated:', newSessionId);
      }
      if (newConversationId !== conversationId) {
        setConversationId(newConversationId);
        console.log('Conversation ID updated:', newConversationId);
      }

      setTokenUsage((prevUsage) => {
        let updatedTokenUsage: TokenUsage;

        if (!usage) {
          console.log('Usage data is null, only updating rate limits');
          const requestLimit = rateLimits.find((limit) => limit.name === 'requests');
          if (requestLimit) {
            updatedTokenUsage = {
              ...prevUsage,
              remainingRequests: requestLimit.remaining,
              requestLimit: requestLimit.limit,
            };
          } else {
            updatedTokenUsage = { ...prevUsage };
          }
        } else {
          updatedTokenUsage = {
            totalTokens: usage.totalTokens ?? prevUsage.totalTokens,
            inputTokens: {
              total: usage.inputTokens?.total ?? prevUsage.inputTokens.total,
              cached: usage.inputTokens?.cached ?? prevUsage.inputTokens.cached,
              text: usage.inputTokens?.text ?? prevUsage.inputTokens.text,
              audio: usage.inputTokens?.audio ?? prevUsage.inputTokens.audio,
            },
            outputTokens: {
              total: usage.outputTokens?.total ?? prevUsage.outputTokens.total,
              text: usage.outputTokens?.text ?? prevUsage.outputTokens.text,
              audio: usage.outputTokens?.audio ?? prevUsage.outputTokens.audio,
            },
            remainingRequests: prevUsage.remainingRequests,
            requestLimit: prevUsage.requestLimit,
            sessionTotalTokens: prevUsage.sessionTotalTokens + (usage.totalTokens ?? 0),
          };

          // Update rate limits if provided
          const requestLimit = rateLimits.find((limit) => limit.name === 'requests');
          if (requestLimit) {
            updatedTokenUsage.remainingRequests = requestLimit.remaining;
            updatedTokenUsage.requestLimit = requestLimit.limit;
          }
        }

        latestTokenUsageRef.current = updatedTokenUsage;
        console.log('Latest token usage updated:', updatedTokenUsage);
        return updatedTokenUsage;
      });

      // Store token usage data in Firestore for all users who are connected
      if (isConnected && newSessionId && newConversationId) {
        console.log('Attempting to store token usage data');
        console.log('Session ID:', newSessionId);
        console.log('Conversation ID:', newConversationId);
        storeTokenUsage(
          latestTokenUsageRef.current,
          rateLimits,
          newSessionId,
          newConversationId,
          assistantId
        )
          .then((docId) => {
            console.log('Token usage data stored successfully in Firestore. Document ID:', docId);
          })
          .catch((error) => {
            console.error('Error storing token usage in Firestore:', error);
            setError('Failed to store token usage data');
          });
      } else {
        console.log('Not storing token usage data:');
        console.log('Is connected:', isConnected);
        console.log('Session ID:', newSessionId);
        console.log('Conversation ID:', newConversationId);
      }
    },
    [isConnected, sessionId, conversationId, assistantId]
  );

  return {
    tokenUsage,
    updateTokenUsage,
    error,
  };
};

export default useTokenUsage;
