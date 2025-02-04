import { WavStreamPlayer } from '../../lib/wavtools';

// Define the Config interface and default config values
export interface Config {
  voiceSettings: string;
  threshold: number;
  prefixPaddingMs: number;
  silenceDurationMs: number;
  temperature: number;
}

export interface TokenUsage {
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

export interface RateLimit {
  name: string;
  limit: number;
  remaining: number;
  reset_seconds: number;
}

export interface AudioContent {
  type: 'audio' | 'input_audio';
  transcript?: string;
  audio?: string;
}

export interface TextContent {
  type: 'text';
  text: string;
}

export type MessageContent = AudioContent | TextContent;

export interface ConversationItem {
  id: string;
  role: 'user' | 'assistant' | 'system';
  type: 'message' | 'function_call' | 'function_call_output';
  content: MessageContent[] | string;
  status: 'pending' | 'completed' | 'interrupted';
  formatted: {
    text?: string;
    transcript?: string;
    audio?: string;
    file?: { url: string };
    tool?: {
      name: string;
      arguments: string;
    };
    output?: string;
  };
}

export interface RealtimeEvent {
  time: string;
  source: 'client' | 'server';
  event: string;
  count?: number;
}

export interface HistoryItem {
  type: 'audio' | 'text';
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface UseRealtimeConnectionProps {
  relayServerUrl: string;
  instructions: string;
  updateTokenUsage: (
    usage: Partial<TokenUsage> | null,
    rateLimits: RateLimit[],
    sessionId: string,
    conversationId: string
  ) => void;
  wavStreamPlayerRef: React.RefObject<WavStreamPlayer>;
  config: Config;
  assistantId: string;
}

export interface UseRealtimeConnectionReturn {
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
  isAssistantStreaming: boolean;
  setIsAssistantStreaming: (value: boolean) => void;
  sendMessage: (messageContent: string) => void;
}

export interface LogEntry {
  timestamp: string;
  component: string;
  line: number;
  type: 'info' | 'warn' | 'error';
  message: string;
}

export interface LogStats {
  totalLines: number;
  errors: number;
  warnings: number;
  info: number;
  components: { [key: string]: number };
  fileSize: string;
  lastModified: string;
}

export interface LogOptions {
  component: string;
  line: number;
  type?: 'info' | 'warn' | 'error';
}

export interface ConversationDisplayProps {
  conversationItems: ConversationItem[];
  onAssistantStreamingChange: (isStreaming: boolean) => void;
}
