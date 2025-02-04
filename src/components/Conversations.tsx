// src/components/Conversations.tsx

import React from 'react';

interface ConversationsProps {
  assistantId: string;
}

export const Conversations: React.FC<ConversationsProps> = ({ assistantId }) => {
  return (
    <div>
      <h2>Conversations</h2>
      {/* Add conversations list here */}
    </div>
  );
};
