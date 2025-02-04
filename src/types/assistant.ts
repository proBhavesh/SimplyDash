// src/types/assistant.ts

import React from 'react';

export interface Assistant {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  type?: string;
  voice?: {
    model: string;
    voiceId: string;
    provider: string;
    stability: number;
    similarityBoost: number;
    fillerInjectionEnabled: boolean;
    optimizeStreamingLatency: number; // Changed from boolean to number
  };
  createdAt: string;
  updatedAt: string;
  model?: {
    model: string;
    messages: {
      role: string;
      content: string;
    }[];
    provider: string;
    functions: {
      name: string;
      async: boolean;
      serverUrl: string;
      parameters: {
        type: string;
        properties: {
          [key: string]: {
            type: string;
            description: string;
          };
        };
      };
      description: string;
    }[];
    maxTokens: number;
    temperature: number;
    knowledgeBase?: {
      fileIds: string[];
      provider: string;
    };
    emotionRecognitionEnabled: boolean;
  };
  forwardingPhoneNumber?: string;
  recordingEnabled?: boolean;
  firstMessage?: string;
  voicemailMessage?: string;
  endCallFunctionEnabled?: boolean;
  endCallMessage?: string;
  transcriber?: {
    model: string;
    language: string;
    provider: string;
  };
  clientMessages?: (
    | 'conversation-update'
    | 'function-call'
    | 'function-call-result'
    | 'hang'
    | 'language-changed'
    | 'metadata'
    | 'model-output'
    | 'speech-update'
    | 'status-update'
    | 'transcript'
    | 'tool-calls'
    | 'user-interrupted'
    | 'voice-input'
  )[];
  serverMessages?: (
    | 'conversation-update'
    | 'end-of-call-report'
    | 'function-call'
    | 'hang'
    | 'language-changed'
    | 'model-output'
    | 'phone-call-control'
    | 'speech-update'
    | 'status-update'
    | 'transcript'
    | 'tool-calls'
    | 'transfer-destination-request'
    | 'transfer-update'
    | 'user-interrupted'
    | 'voice-input'
  )[];
  responseDelaySeconds?: number;
  dialKeypadFunctionEnabled?: boolean;
  serverUrl?: string;
  hipaaEnabled?: boolean;
  llmRequestDelaySeconds?: number;
  numWordsToInterruptAssistant?: number;
  backgroundSound?: string;
  backchannelingEnabled?: boolean;
  analysisPlan?: {
    structuredDataPrompt: string;
    structuredDataSchema: {
      type: string;
      properties: {
        [key: string]: {
          description: string;
          type: string;
        };
      };
    };
    successEvaluationRubric: string;
  };
  backgroundDenoisingEnabled?: boolean;
  artifactPlan?: {
    videoRecordingEnabled: boolean;
  };
  messagePlan?: {
    idleMessages: string[];
  };
  isServerUrlSecretSet?: boolean;
  isSubscribed?: boolean;
  usage?: Usage;
  talkingGifUrl?: string;
  waitingGifUrl?: string;
}

export interface AssistantModel {
  model: string;
  messages: {
    role: string;
    content: string;
  }[];
  provider: string;
  functions: {
    name: string;
    async: boolean;
    serverUrl: string;
    parameters: {
      type: string;
      properties: {
        [key: string]: {
          type: string;
          description: string;
        };
      };
    };
    description: string;
  }[];
  maxTokens: number;
  temperature: number;
  knowledgeBase?: {
    fileIds: string[];
    provider: string;
  };
  emotionRecognitionEnabled: boolean;
}

export interface DailyUsage {
  date: string;
  minutes: number;
  cost: number;
}

export interface Usage {
  totalMinutes: number;
  totalCost: number;
  dailyData: DailyUsage[];
}

export interface AnalyticsQuery {
  name: string;
  table: string;
  timeRange: {
    start: string;
    end: string;
    step: string;
    timezone: string;
  };
  groupBy: string[];
  operations: {
    operation: string;
    column: string;
    alias: string;
  }[];
}

export interface AnalyticsResponse {
  result: AnalyticsResult[];
}

export interface AnalyticsResult {
  assistantId: string;
  type: string;
  totalDuration: string;
  totalCost: string;
}

// Interfaces for TrainingFile and AssistantDetailProps

export interface TrainingFile {
  id: string;
  name: string;
  size: number;
  // Add other properties as needed
}

export interface AssistantDetailProps {
  assistant: Assistant;
  editedAssistant: Assistant | null;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  setEditedAssistant: React.Dispatch<React.SetStateAction<Assistant | null>>;
}

// Interfaces for Analytics Data

export interface CallTypeData {
  calls: number;
  minutes: number;
}

export interface CallTypeBreakdown {
  [type: string]: CallTypeData;
}

export interface AnalyticsData {
  totalMinutes: number;
  totalCalls: number;
  costPerMinute: number;
  callTypeBreakdown?: CallTypeBreakdown;
}

// Interface for AnalyticsBox Props

export interface AnalyticsBoxProps {
  analyticsData: AnalyticsData;
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  onDateRangeChange: (
    newDateRange: { startDate: Date; endDate: Date }
  ) => void;
}

// Interfaces for Conversations

export interface ConversationMessage {
  role: 'user' | 'assistant' | string;
  content: string;
  timestamp: Date;
  // Add other properties as needed
}

export interface Conversation {
  id: string;
  assistantId: string;
  user: string;
  timestamp: Date;
  messages: ConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
  // Add other properties as needed
}

// Interface for GifUploadProps

export interface GifUploadProps {
  assistant: Assistant;
  onGifUpload: (
    event: React.ChangeEvent<HTMLInputElement>,
    type: 'waiting' | 'talking'
  ) => void;
}

// Interface for ModelInformationProps

export interface ModelInformationProps {
  model?: AssistantModel;
}

// Interface for RecentConversationsProps

export interface RecentConversationsProps {
  conversations: Conversation[];
}

// Interface for TranscriberInformationProps

export interface TranscriberInformationProps {
  transcriber?: {
    model: string;
    language: string;
    provider: string;
  };
}

// Interface for VoiceDetailsProps

export interface VoiceDetailsProps {
  voice?: {
    model: string;
    voiceId: string;
    provider: string;
    stability: number;
    similarityBoost: number;
    fillerInjectionEnabled: boolean;
    optimizeStreamingLatency: number; // Changed from boolean to number
  };
}

// Additional Interfaces

export type ClientMessageType =
  | 'conversation-update'
  | 'function-call'
  | 'function-call-result'
  | 'hang'
  | 'language-changed'
  | 'metadata'
  | 'model-output'
  | 'speech-update'
  | 'status-update'
  | 'transcript'
  | 'tool-calls'
  | 'user-interrupted'
  | 'voice-input';

export type ServerMessageType =
  | 'conversation-update'
  | 'end-of-call-report'
  | 'function-call'
  | 'hang'
  | 'language-changed'
  | 'model-output'
  | 'phone-call-control'
  | 'speech-update'
  | 'status-update'
  | 'transcript'
  | 'tool-calls'
  | 'transfer-destination-request'
  | 'transfer-update'
  | 'user-interrupted'
  | 'voice-input';

export interface AnalysisPlan {
  structuredDataPrompt: string;
  structuredDataSchema: {
    type: string;
    properties: {
      [key: string]: {
        description: string;
        type: string;
      };
    };
  };
  successEvaluationRubric: string;
}

export interface ArtifactPlan {
  videoRecordingEnabled: boolean;
}

export interface MessagePlan {
  idleMessages: string[];
}
