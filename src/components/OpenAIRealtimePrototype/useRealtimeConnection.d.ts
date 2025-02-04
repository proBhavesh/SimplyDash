import { ConversationItem } from './ConversationDisplay.d';

export interface RealtimeEvent {
  time: string;
  source: 'client' | 'server';
  event: string;
  count?: number;
}

export interface RateLimit {
  name: string;
  limit: number;
  remaining: number;
  reset_seconds: number;
}

export interface UseRealtimeConnectionResult {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  conversationItems: ConversationItem[];
  realtimeEvents: RealtimeEvent[];
  rateLimits: RateLimit[];
  isMicrophoneActive: boolean;
  sessionId: string;
  conversationId: string;
  connectConversation: () => Promise<void>;
  disconnectConversation: () => Promise<void>;
  handleInterruption: () => Promise<void>;
}

declare function useRealtimeConnection(relayServerUrl: string, instructions: any): UseRealtimeConnectionResult;

export default useRealtimeConnection;