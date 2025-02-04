// src/components/EditAssistant.tsx

import React from 'react';
import { Assistant } from '../types/assistant';

interface EditAssistantProps {
  assistant: Assistant;
  onUpdate: (updatedAssistant: Assistant) => void;
}

export const EditAssistant: React.FC<EditAssistantProps> = ({ assistant, onUpdate }) => {
  return (
    <div>
      <h2>Edit Assistant</h2>
      {/* Add edit assistant form here */}
    </div>
  );
};
