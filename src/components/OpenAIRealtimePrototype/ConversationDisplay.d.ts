import { FC } from 'react';

export interface ConversationItem {
  id: string;
  role: 'user' | 'assistant' | 'system';
  type: 'message' | 'function_call' | 'function_call_output';
  content: string;
  status: 'pending' | 'completed' | 'interrupted';
  formatted: {
    text?: string;
    transcript?: string;
    audio?: Uint8Array;
    file?: { url: string };
  };
}

export interface ConversationDisplayProps {
  conversationItems: ConversationItem[];
}

declare const ConversationDisplay: FC<ConversationDisplayProps>;

export default ConversationDisplay;