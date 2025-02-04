import React from 'react';

interface TranscriptViewerProps {
  transcript: string;
}

const TranscriptViewer: React.FC<TranscriptViewerProps> = ({ transcript }) => {
  return (
    <div className="border p-4 h-64 overflow-y-auto mt-6 bg-gray-50 rounded-lg shadow-inner">
      <h2 className="text-xl font-semibold mb-2">Transcript:</h2>
      <div className="h-48 overflow-y-auto">
        {transcript || 'No conversation yet.'}
      </div>
    </div>
  );
};

export default TranscriptViewer;
