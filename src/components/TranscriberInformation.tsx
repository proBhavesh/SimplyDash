import React from 'react';
import { TranscriberInformationProps } from '../types/assistant'; // Updated import;

export const TranscriberInformation: React.FC<TranscriberInformationProps> = ({
  transcriber
}) => {
  if (!transcriber) return null;

  return (
    <div className="bg-white shadow sm:rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
          Transcriber Information
        </h3>
        <div className="space-y-2">
          <p><strong>Model:</strong> {transcriber.model}</p>
          <p><strong>Language:</strong> {transcriber.language}</p>
          <p><strong>Provider:</strong> {transcriber.provider}</p>
        </div>
      </div>
    </div>
  );
};

export default TranscriberInformation;