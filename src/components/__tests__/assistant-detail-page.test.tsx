import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AssistantDetailPage } from '../assistant-detail-page';
import { Assistant } from '../../types/assistant';
import axios from 'axios';
import { auth } from '@/app/firebaseConfig';

jest.mock('axios');
jest.mock('@/app/firebaseConfig', () => ({
  auth: {
    currentUser: { getIdToken: jest.fn().mockResolvedValue('mock-token') },
    onAuthStateChanged: jest.fn((auth, callback) => {
      callback({ uid: 'mock-uid' });
      return jest.fn();
    }),
  },
}));

const mockAssistant: Assistant = {
  id: 'mock-id',
  orgId: 'mock-org-id',
  name: 'Mock Assistant',
  description: 'A mock assistant for testing',
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-02T00:00:00Z',
  isSubscribed: true,
  firstMessage: 'Hello, how can I help you?',
  model: {
    model: 'gpt-3.5-turbo',
    provider: 'OpenAI',
    maxTokens: 2000,
    temperature: 0.7,
    emotionRecognitionEnabled: true,
    messages: [{ role: 'system', content: 'You are a helpful assistant.' }],
    functions: [
      {
        name: 'mockFunction',
        async: false,
        serverUrl: 'https://example.com/api',
        parameters: {
          type: 'object',
          properties: {
            param1: { type: 'string', description: 'A mock parameter' }
          }
        },
        description: 'A mock function for testing'
      }
    ],
    knowledgeBase: {
      fileIds: ['mock-file-id'],
      provider: 'OpenAI'
    }
  },
  voice: {
    model: 'en-US-Neural2-F',
    voiceId: 'mock-voice-id',
    provider: 'Google',
    stability: 0.5,
    similarityBoost: 0.8,
    fillerInjectionEnabled: true,
    optimizeStreamingLatency: 1,
  },
  transcriber: {
    model: 'whisper-1',
    language: 'en',
    provider: 'OpenAI',
  },
  usage: {
    totalMinutes: 100,
    totalCost: 50,
    dailyData: [],
  },
  forwardingPhoneNumber: '+1234567890',
  recordingEnabled: true,
  voicemailMessage: 'Please leave a message',
  endCallFunctionEnabled: true,
  endCallMessage: 'Thank you for calling',
  clientMessages: ['conversation-update', 'function-call', 'hang', 'model-output'],
  serverMessages: ['conversation-update', 'end-of-call-report', 'function-call', 'hang'],
  responseDelaySeconds: 1,
  dialKeypadFunctionEnabled: true,
  serverUrl: 'https://example.com/server',
  hipaaEnabled: false,
  llmRequestDelaySeconds: 0.5,
  numWordsToInterruptAssistant: 3,
  backgroundSound: 'office',
  backchannelingEnabled: true,
  analysisPlan: {
    structuredDataPrompt: 'Analyze the following',
    structuredDataSchema: {
      type: 'object',
      properties: {
        key: { description: 'A key', type: 'string' }
      }
    },
    successEvaluationRubric: 'Evaluate success based on...'
  },
  backgroundDenoisingEnabled: true,
  artifactPlan: {
    videoRecordingEnabled: false
  },
  messagePlan: {
    idleMessages: ['Are you still there?']
  },
  isServerUrlSecretSet: true
};

describe('AssistantDetailPage', () => {
  beforeEach(() => {
    (axios.get as jest.Mock).mockResolvedValue({ data: mockAssistant });
    (axios.patch as jest.Mock).mockResolvedValue({ data: mockAssistant });
  });

  it('renders loading state initially', async () => {
    render(<AssistantDetailPage assistantId="mock-id" />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders assistant details after loading', async () => {
    render(<AssistantDetailPage assistantId="mock-id" />);
    
    await waitFor(() => {
      // Check for main sections
      expect(screen.getByText('Chat with Assistant')).toBeInTheDocument();
      expect(screen.getByText('Analytics')).toBeInTheDocument();
      expect(screen.getByText('AI Assistant Details')).toBeInTheDocument();
      expect(screen.getByText('Training Content')).toBeInTheDocument();
      expect(screen.getByText('Model Information')).toBeInTheDocument();
      expect(screen.getByText('Voice Details')).toBeInTheDocument();
      expect(screen.getByText('Transcriber Information')).toBeInTheDocument();
      expect(screen.getByText('Recent Conversations')).toBeInTheDocument();

      // Check for specific details
      expect(screen.getByText('Mock Assistant')).toBeInTheDocument();
      expect(screen.getByText('A mock assistant for testing')).toBeInTheDocument();
      expect(screen.getByText('Total Minutes: 100.00')).toBeInTheDocument();
      expect(screen.getByText('Total Cost: $50.00')).toBeInTheDocument();
      expect(screen.getByText('First Message')).toBeInTheDocument();
      expect(screen.getByText('Hello, how can I help you?')).toBeInTheDocument();
      expect(screen.getByText('System Prompt')).toBeInTheDocument();
      expect(screen.getByText('You are a helpful assistant.')).toBeInTheDocument();
    });
  });

  it('displays subscription message for subscribed users', async () => {
    render(<AssistantDetailPage assistantId="mock-id" />);
    
    await waitFor(() => {
      expect(screen.getByText('Thank you for subscribing!')).toBeInTheDocument();
    });
  });

  it('displays subscription required message for non-subscribed users', async () => {
    const nonSubscribedAssistant = { ...mockAssistant, isSubscribed: false };
    (axios.get as jest.Mock).mockResolvedValue({ data: nonSubscribedAssistant });

    render(<AssistantDetailPage assistantId="mock-id" />);
    
    await waitFor(() => {
      expect(screen.getByText('Subscription Required')).toBeInTheDocument();
    });
  });

  it('handles missing optional fields gracefully', async () => {
    const incompleteAssistant: Assistant = {
      id: 'mock-id',
      orgId: 'mock-org-id',
      name: 'Incomplete Assistant',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-02T00:00:00Z',
    };

    (axios.get as jest.Mock).mockResolvedValue({ data: incompleteAssistant });

    render(<AssistantDetailPage assistantId="mock-id" />);
    
    await waitFor(() => {
      expect(screen.getByText('Incomplete Assistant')).toBeInTheDocument();
      expect(screen.getByText('No description available')).toBeInTheDocument();
      expect(screen.getByText('Total Minutes: N/A')).toBeInTheDocument();
      expect(screen.getByText('Total Cost: $N/A')).toBeInTheDocument();
      expect(screen.getByText('First Message')).toBeInTheDocument();
      expect(screen.getByText('Not set')).toBeInTheDocument();
    });
  });

  it('displays error message when API call fails', async () => {
    (axios.get as jest.Mock).mockRejectedValue(new Error('API Error'));

    render(<AssistantDetailPage assistantId="mock-id" />);
    
    await waitFor(() => {
      expect(screen.getByText('API Error')).toBeInTheDocument();
    });
  });

  it('allows editing and saving of first message', async () => {
    render(<AssistantDetailPage assistantId="mock-id" />);

    await waitFor(() => {
      expect(screen.getByText('Hello, how can I help you?')).toBeInTheDocument();
    });

    // Click edit button
    fireEvent.click(screen.getByText('Edit'));

    // Find the first message input and change its value
    const firstMessageInput = screen.getByLabelText('First Message') as HTMLTextAreaElement;
    fireEvent.change(firstMessageInput, { target: { value: 'New first message' } });

    // Click save button
    fireEvent.click(screen.getByText('Save'));

    // Wait for the save to complete and check if the new message is displayed
    await waitFor(() => {
      expect(screen.getByText('New first message')).toBeInTheDocument();
    });

    // Verify that the API was called with the updated first message
    expect(axios.patch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        firstMessage: 'New first message',
      }),
      expect.any(Object)
    );
  });

  it('handles first message update failure', async () => {
    (axios.patch as jest.Mock).mockRejectedValue(new Error('Update failed'));

    render(<AssistantDetailPage assistantId="mock-id" />);

    await waitFor(() => {
      expect(screen.getByText('Hello, how can I help you?')).toBeInTheDocument();
    });

    // Click edit button
    fireEvent.click(screen.getByText('Edit'));

    // Find the first message input and change its value
    const firstMessageInput = screen.getByLabelText('First Message') as HTMLTextAreaElement;
    fireEvent.change(firstMessageInput, { target: { value: 'New first message' } });

    // Click save button
    fireEvent.click(screen.getByText('Save'));

    // Wait for the error message to be displayed
    await waitFor(() => {
      expect(screen.getByText('Update failed')).toBeInTheDocument();
    });

    // Verify that the original message is still displayed
    expect(screen.getByText('Hello, how can I help you?')).toBeInTheDocument();
  });
});