import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ChatInterface } from '../ChatInterface';
import { fetchWithAuth } from '../../utils/api';
import errorLogger from '../../utils/errorLogger';

jest.mock('../../utils/api', () => ({
  fetchWithAuth: jest.fn(),
}));

jest.mock('../../utils/errorLogger');
jest.mock('../../hooks/useAudioChat');

const mockAssistantId = '1';

describe('ChatInterface', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the chat interface', () => {
    render(<ChatInterface assistantId={mockAssistantId} />);
    expect(screen.getByPlaceholderText('Type your message here...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  });

  it('sends a message when the send button is clicked', async () => {
    (fetchWithAuth as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ response: 'Test response' }),
    });

    render(<ChatInterface assistantId={mockAssistantId} />);
    const input = screen.getByPlaceholderText('Type your message here...');
    const sendButton = screen.getByRole('button', { name: 'Send' });

    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(fetchWithAuth).toHaveBeenCalledWith('/api/chat', expect.any(Object));
      expect(screen.getByText('You: Test message')).toBeInTheDocument();
      expect(screen.getByText('Assistant: Test response')).toBeInTheDocument();
    });
  });

  it('displays an error message when the API call fails', async () => {
    (fetchWithAuth as jest.Mock).mockRejectedValue(new Error('API Error'));

    render(<ChatInterface assistantId={mockAssistantId} />);
    const input = screen.getByPlaceholderText('Type your message here...');
    const sendButton = screen.getByRole('button', { name: 'Send' });

    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(errorLogger).toHaveBeenCalledWith('Error sending message:', expect.any(Error));
      expect(screen.getByText('An error occurred while sending your message. Please try again.')).toBeInTheDocument();
    });
  });
});