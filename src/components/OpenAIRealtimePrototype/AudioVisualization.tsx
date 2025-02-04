// src/components/OpenAIRealtimePrototype/AudioVisualization.tsx

import React, { useEffect } from 'react';

interface AudioVisualizationProps {
  isConnected: boolean;
  clientCanvasRef: React.RefObject<HTMLCanvasElement>;
  serverCanvasRef: React.RefObject<HTMLCanvasElement>;
  isUserSpeaking: boolean;
  isAssistantSpeaking: boolean;
  className?: string;
}

const AudioVisualization: React.FC<AudioVisualizationProps> = ({
  isConnected,
  clientCanvasRef,
  serverCanvasRef,
  isUserSpeaking,
  isAssistantSpeaking,
  className = '',
}) => {
  // Set canvas dimensions on mount and resize
  useEffect(() => {
    const resizeCanvas = () => {
      const setCanvasDimensions = (canvas: HTMLCanvasElement | null) => {
        if (!canvas) return;
        const container = canvas.parentElement;
        if (!container) return;

        // Get container dimensions
        const rect = container.getBoundingClientRect();
        const width = Math.floor(rect.width);
        const height = Math.floor(rect.height);

        // Only update if dimensions have changed
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
      };

      setCanvasDimensions(clientCanvasRef.current);
      setCanvasDimensions(serverCanvasRef.current);
    };

    // Initial resize
    resizeCanvas();

    // Add resize listener
    window.addEventListener('resize', resizeCanvas);

    // Cleanup
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [clientCanvasRef, serverCanvasRef]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="flex-1 flex gap-4 min-h-0">
        {/* User Voice Visualization */}
        <div className="flex-1 flex flex-col">
          <div className="relative flex-1 min-h-0">
            <canvas
              ref={clientCanvasRef}
              className="absolute inset-0 w-full h-full rounded-lg border border-gray-200"
            />
          </div>
          <div className="mt-2 text-center">
            <span className="text-sm font-medium text-gray-700">
              {isUserSpeaking ? 'You are speaking...' : 'Your Voice'}
            </span>
          </div>
        </div>

        {/* Assistant Voice Visualization */}
        <div className="flex-1 flex flex-col">
          <div className="relative flex-1 min-h-0">
            <canvas
              ref={serverCanvasRef}
              className="absolute inset-0 w-full h-full rounded-lg border border-gray-200"
            />
          </div>
          <div className="mt-2 text-center">
            <span className="text-sm font-medium text-gray-700">
              {isAssistantSpeaking ? 'Assistant is speaking...' : 'Assistant Voice'}
            </span>
          </div>
        </div>
      </div>

      {/* Debug Info - Only in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-2 text-xs text-gray-400 text-center">
          Debug: isConnected: {isConnected.toString()}, isUserSpeaking: {isUserSpeaking.toString()}, isAssistantSpeaking: {isAssistantSpeaking.toString()}
        </div>
      )}
    </div>
  );
};

export default AudioVisualization;
