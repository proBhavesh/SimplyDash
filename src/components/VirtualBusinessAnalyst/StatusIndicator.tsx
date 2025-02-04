import React from 'react';

interface StatusIndicatorProps {
  isConnected: boolean;
  isMicrophoneActive: boolean;
  isAssistantSpeaking: boolean;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  isConnected,
  isMicrophoneActive,
  isAssistantSpeaking,
}) => {
  const getStatusIndicator = () => {
    if (!isConnected) {
      return {
        color: 'bg-gray-400',
        text: 'Disconnected'
      };
    }
    if (isMicrophoneActive) {
      return {
        color: 'bg-red-500',
        text: 'User Speaking'
      };
    }
    if (isAssistantSpeaking) {
      return {
        color: 'bg-blue-500',
        text: 'Assistant Speaking'
      };
    }
    return {
      color: 'bg-green-500',
      text: 'Connected'
    };
  };

  const status = getStatusIndicator();

  return (
    <div className="flex justify-center items-center">
      <div
        className={`w-4 h-4 rounded-full ${status.color} transition-colors duration-300`}
      ></div>
      <span className="ml-2 text-sm text-gray-600">
        {status.text}
      </span>
    </div>
  );
};

export default StatusIndicator;
