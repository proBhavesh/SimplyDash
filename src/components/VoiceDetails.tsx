import React from 'react';
import { MicIcon } from 'lucide-react'
import { VoiceDetailsProps } from '../types/assistant'; // Updated import

export const VoiceDetails: React.FC<VoiceDetailsProps> = ({
  voice
}) => {
  if (!voice) return null;

  return (
    <div className="bg-white shadow sm:rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
          <MicIcon className="inline-block mr-2" />
          Voice Details
        </h3>
        <div className="space-y-2">
          <p><strong>Model:</strong> {voice.model}</p>
          <p><strong>Voice ID:</strong> {voice.voiceId}</p>
          <p><strong>Provider:</strong> {voice.provider}</p>
          <p><strong>Stability:</strong> {voice.stability}</p>
          <p><strong>Similarity Boost:</strong> {voice.similarityBoost}</p>
          <p><strong>Filler Injection:</strong> {voice.fillerInjectionEnabled ? 'Enabled' : 'Disabled'}</p>
          <p><strong>Optimize Streaming Latency:</strong> {voice.optimizeStreamingLatency ? 'Enabled' : 'Disabled'}</p>
        </div>
      </div>
    </div>
  );
};

export default VoiceDetails;