// src/components/AssistantOverview.tsx

import React from 'react';
import { Assistant } from '../types/assistant';

interface AssistantOverviewProps {
  assistant: Assistant;
}

export const AssistantOverview: React.FC<AssistantOverviewProps> = ({ assistant }) => {
  return (
    <div>
      <h2>Assistant Overview</h2>
      {/* Add assistant overview content here */}
    </div>
  );
};
