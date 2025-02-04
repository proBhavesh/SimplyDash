import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface Conversation {
  id: string;
  tokenUsage: {
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
  };
  timestamp: string;
  sessionId: string;
  conversationId: string;
}

interface TokenUsageDisplayProps {
  conversations: Conversation[];
}

const TokenUsageDisplay: React.FC<TokenUsageDisplayProps> = ({ conversations }) => {
  const calculatePrice = (tokens: number, type: 'input' | 'output', modality: 'text' | 'audio') => {
    const rates = {
      input: { text: 0.000005, audio: 0.0001 },
      output: { text: 0.00002, audio: 0.0002 },
    };
    return (tokens * rates[type][modality]).toFixed(6);
  };

  const calculateTotalPrice = (conversation: Conversation) => {
    const { inputTokens, outputTokens } = conversation.tokenUsage;
    return (
      parseFloat(calculatePrice(inputTokens.text, 'input', 'text')) +
      parseFloat(calculatePrice(inputTokens.audio, 'input', 'audio')) +
      parseFloat(calculatePrice(outputTokens.text, 'output', 'text')) +
      parseFloat(calculatePrice(outputTokens.audio, 'output', 'audio'))
    ).toFixed(6);
  };

  const groupConversationsBySession = (conversations: Conversation[]) => {
    const grouped = conversations.reduce((acc, conversation) => {
      if (!acc[conversation.sessionId]) {
        acc[conversation.sessionId] = [];
      }
      acc[conversation.sessionId].push(conversation);
      return acc;
    }, {} as Record<string, Conversation[]>);

    return Object.entries(grouped).map(([sessionId, sessionConversations]) => ({
      sessionId,
      conversations: sessionConversations,
      totalTokens: sessionConversations.reduce((sum, conv) => sum + conv.tokenUsage.totalTokens, 0),
      totalPrice: sessionConversations.reduce((sum, conv) => sum + parseFloat(calculateTotalPrice(conv)), 0).toFixed(6),
    }));
  };

  const groupedSessions = groupConversationsBySession(conversations);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Token Usage History</CardTitle>
      </CardHeader>
      <CardContent>
        {groupedSessions.length === 0 ? (
          <p>No conversation data available.</p>
        ) : (
          <div className="space-y-4">
            {groupedSessions.map((session) => (
              <Card key={session.sessionId}>
                <CardHeader>
                  <CardTitle className="text-lg">Session: {session.sessionId}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p><strong>Total Tokens:</strong> {session.totalTokens}</p>
                  <p><strong>Total Price:</strong> ${session.totalPrice}</p>
                  <div className="mt-2">
                    <h4 className="font-semibold">Conversations:</h4>
                    <ul className="list-disc pl-5">
                      {session.conversations.map((conversation) => (
                        <li key={conversation.id}>
                          <p>ID: {conversation.conversationId}</p>
                          <p>Timestamp: {new Date(conversation.timestamp).toLocaleString()}</p>
                          <p>Tokens: {conversation.tokenUsage.totalTokens}</p>
                          <p>Price: ${calculateTotalPrice(conversation)}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TokenUsageDisplay;