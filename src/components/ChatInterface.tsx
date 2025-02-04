// src/components/ChatInterface.tsx

import React, { useState } from 'react';
import { useAudioChat } from '../hooks/useAudioChat';
import { fetchWithAuth } from '../utils/api';
import { errorLogger } from '../utils/errorLogger';

interface ChatInterfaceProps {
  assistantId: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ assistantId }) => {
  const [messages, setMessages] = useState<string[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const {
    isRecording,
    startRecording,
    stopRecording,
    audioUrl,
    transcription,
    isTranscribing,
  } = useAudioChat();

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    setMessages([...messages, `You: ${inputMessage}`]);
    setInputMessage('');

    try {
      const response = await fetchWithAuth('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: inputMessage, assistantId }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages((prevMessages) => [...prevMessages, `Assistant: ${data.response}`]);
      } else {
        throw new Error('Failed to send message');
      }
    } catch (err) {
      setError('An error occurred while sending your message. Please try again.');
      errorLogger.error(err instanceof Error ? err : new Error(String(err)));
    }
  };

  if (isTranscribing) {
    return <div>Transcribing audio...</div>;
  }

  return (
    <div>
      <div>
        {messages.map((message, index) => (
          <div key={index}>{message}</div>
        ))}
      </div>
      <input
        type="text"
        value={inputMessage}
        onChange={(e) => setInputMessage(e.target.value)}
        placeholder="Type your message here..."
      />
      <button onClick={sendMessage}>Send</button>
      <button onClick={isRecording ? stopRecording : startRecording}>
        {isRecording ? 'Stop Recording' : 'Start Recording'}
      </button>
      {audioUrl && <audio src={audioUrl} controls />}
      {transcription && <div>Transcription: {transcription}</div>}
      {error && <div>{error}</div>}
    </div>
  );
};
