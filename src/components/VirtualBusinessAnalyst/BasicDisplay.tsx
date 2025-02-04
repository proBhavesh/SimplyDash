import React from 'react';
import Image from 'next/image';
import { MemoryMonitor } from '../../utils/MemoryMonitor';
import StatusIndicator from './StatusIndicator';

interface BasicDisplayProps {
  name: string;
  imageSrc: string;
  isConnected: boolean;
  isMicrophoneActive: boolean;
  isProcessing: boolean;
  isAssistantSpeaking: boolean;  // Added this prop
  onConnect: () => void;
  onDisconnect: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  selectedFile: File | null;
  transcript: string;
}

const BasicDisplay: React.FC<BasicDisplayProps> = ({
  name,
  imageSrc,
  isConnected,
  isMicrophoneActive,
  isProcessing,
  isAssistantSpeaking,  // Added this prop
  onConnect,
  onDisconnect,
  onFileChange,
  onUpload,
  selectedFile,
  transcript,
}) => {
  // Memory monitoring using MemoryMonitor utility
  React.useEffect(() => {
    const memoryMonitor = MemoryMonitor.getInstance();
    let removeListener: (() => void) | undefined;

    if (isConnected) {
      removeListener = memoryMonitor.addListener((snapshot) => {
        const trend = memoryMonitor.getMemoryTrend();
        const currentSnapshot = memoryMonitor.getCurrentSnapshot();
        
        if (trend.trend === 'increasing' && trend.averageGrowthMB > 50 && currentSnapshot?.memory) {
          const usedMemoryMB = currentSnapshot.memory.usedJSHeapSize / (1024 * 1024);
          console.warn(
            'Memory warning:',
            `Growth rate: ${trend.averageGrowthMB.toFixed(2)} MB/interval`,
            `Current usage: ${usedMemoryMB.toFixed(2)} MB`
          );
        }
      });
    }

    return () => {
      if (removeListener) {
        removeListener();
      }
      if (isConnected) {
        memoryMonitor.stopMonitoring();
      }
    };
  }, [isConnected]);

  return (
    <div className="max-w-2xl mx-auto p-6 text-center">
      {/* Title */}
      <h1 className="text-3xl font-bold mb-8">Virtual Business Analyst</h1>

      {/* Avatar and Status Indicator */}
      <div className="relative mb-6">
        <div className="w-64 h-64 mx-auto">
          <Image
            src={imageSrc}
            alt="Assistant"
            width={256}
            height={256}
            objectFit="cover"
            className="rounded-full shadow-lg"
          />
        </div>
        {/* Status Indicator */}
        <div className="mt-4">
          <StatusIndicator
            isConnected={isConnected}
            isMicrophoneActive={isMicrophoneActive}
            isAssistantSpeaking={isAssistantSpeaking}
          />
        </div>
      </div>

      {/* Buttons Group */}
      <div className="flex justify-center gap-4 mb-6">
        {/* Connect/Disconnect Button */}
        {isConnected ? (
          <button
            onClick={onDisconnect}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-full shadow-md transition duration-300"
            data-testid="disconnect-button"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={onConnect}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-full shadow-md transition duration-300"
            data-testid="connect-button"
          >
            Connect and Talk
          </button>
        )}

        {/* Upload Button */}
        <div className="flex flex-col items-center">
          <input
            type="file"
            accept=".pdf"
            onChange={onFileChange}
            className="hidden"
            id="pdf-upload"
            disabled={isProcessing}
          />
          <label
            htmlFor="pdf-upload"
            className={`px-6 py-2 font-semibold rounded-full shadow-md transition duration-300 cursor-pointer ${
              isProcessing
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            Upload PDF
          </label>
          {selectedFile && !isProcessing && (
            <button
              onClick={onUpload}
              className="mt-2 px-4 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-full shadow-md transition duration-300"
            >
              Start Processing
            </button>
          )}
        </div>
      </div>

      {/* Processing Message */}
      {isProcessing && (
        <p className="text-sm text-gray-600 mb-6">
          We will notify you by email when the processing is complete (about 25 minutes).
        </p>
      )}

      {/* Transcript Box */}
      <div className="border p-4 rounded-lg bg-white shadow-inner max-h-64 overflow-y-auto">
        <h2 className="text-xl font-semibold mb-2">Transcript:</h2>
        <div className="text-left">
          {transcript || 'No conversation yet.'}
        </div>
      </div>
    </div>
  );
};

export default BasicDisplay;
