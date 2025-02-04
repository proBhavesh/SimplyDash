// src/components/Analytics.tsx

import React from 'react';

interface AnalyticsProps {
  assistantId: string;
}

export const Analytics: React.FC<AnalyticsProps> = ({ assistantId }) => {
  return (
    <div>
      <h2>Analytics</h2>
      {/* Add analytics content here */}
    </div>
  );
};
