import React from 'react';
import { BotIcon } from 'lucide-react'
import { ModelInformationProps } from '../types/assistant'; // Updated import

export const ModelInformation: React.FC<ModelInformationProps> = ({
  model
}) => {
  if (!model) return null;

  return (
    <div className="bg-white shadow sm:rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
          <BotIcon className="inline-block mr-2" />
          Model Information
        </h3>
        <div className="space-y-2">
          <p><strong>Model:</strong> {model.model}</p>
          <p><strong>Provider:</strong> {model.provider}</p>
          <p><strong>Max Tokens:</strong> {model.maxTokens}</p>
          <p><strong>Temperature:</strong> {model.temperature}</p>
          <p><strong>Emotion Recognition:</strong> {model.emotionRecognitionEnabled ? 'Enabled' : 'Disabled'}</p>
        </div>
      </div>
    </div>
  );
};

export default ModelInformation;