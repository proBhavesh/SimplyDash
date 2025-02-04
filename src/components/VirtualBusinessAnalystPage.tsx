import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import { WavStreamPlayer, WavRecorder } from '../lib/wavtools/index';
import useRealtimeConnection from './OpenAIRealtimePrototype/useRealtimeConnection';
import { performanceLogger } from './OpenAIRealtimePrototype/utils/logger';
import { generatePerformanceReport } from './OpenAIRealtimePrototype/utils/performanceAnalyzer';
import { MemoryMonitor } from '../utils/MemoryMonitor';
import StatusIndicator from './VirtualBusinessAnalyst/StatusIndicator';

// Import modular components
import BasicDisplay from './VirtualBusinessAnalyst/BasicDisplay';
import AssistantProfile from './VirtualBusinessAnalyst/AssistantProfile';
import TranscriptViewer from './VirtualBusinessAnalyst/TranscriptViewer';
import Introduction from './VirtualBusinessAnalyst/Introduction';
import FileUploader from './VirtualBusinessAnalyst/FileUploader';
import ProcessStatus from './VirtualBusinessAnalyst/ProcessStatus';
import LogViewer from './VirtualBusinessAnalyst/LogViewer';
import { AssistantData, ProcessStatus as ProcessStatusType, Config } from './VirtualBusinessAnalyst/types';

interface VirtualBusinessAnalystPageProps {
  assistantData: AssistantData;
}

const VirtualBusinessAnalystPage: React.FC<VirtualBusinessAnalystPageProps> = ({
  assistantData,
}) => {
  const [isAdvancedMode, setIsAdvancedMode] = useState<boolean>(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processStatus, setProcessStatus] = useState<ProcessStatusType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState<boolean>(false);
  const [isMicrophoneActive, setIsMicrophoneActive] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Initialize refs
  const wavRecorderRef = useRef<WavRecorder | null>(null);
  const wavStreamPlayerRef = useRef<WavStreamPlayer | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef<number>(0);
  const previousProcessStatusRef = useRef<ProcessStatusType | null>(null);
  const maxRetries = 5;

  // Memoize the GIF URLs to prevent unnecessary reloads
  const gifUrls = useMemo(
    () => ({
      talking: assistantData?.talkingGifUrl || '/static/yubotot.gif',
      waiting: assistantData?.waitingGifUrl || '/static/yuboto.gif',
    }),
    [assistantData?.talkingGifUrl, assistantData?.waitingGifUrl]
  );

  // Memoize the image source selection
  const imageSrc = useMemo(
    () =>
      isAssistantSpeaking && !isMicrophoneActive ? gifUrls.talking : gifUrls.waiting,
    [isAssistantSpeaking, isMicrophoneActive, gifUrls]
  );

  const assistantId = useMemo(
    () => assistantData?.assistantId || assistantData?.id || '',
    [assistantData]
  );

  const config: Config = useMemo(
    () => ({
      voiceSettings: assistantData?.voiceSettings || 'alloy',
      threshold: assistantData?.threshold ?? 0.5,
      prefixPaddingMs: assistantData?.prefix_padding_ms ?? 500,
      silenceDurationMs: assistantData?.silence_duration_ms ?? 300,
      temperature: assistantData?.temperature ?? 0.6,
    }),
    [assistantData]
  );

  const RELAY_SERVER_URL = useMemo(
    () =>
      `/api/realtime-relay?assistantId=${encodeURIComponent(assistantId)}`,
    [assistantId]
  );

  const updateTokenUsageCallback = useCallback(
    (
      usage: any,
      rateLimits: any,
      hookSessionId: string,
      hookConversationId: string
    ) => {
      // Implement token usage tracking if needed
    },
    []
  );

  // Initialize audio resources
  const initializeAudioResources = useCallback(async () => {
    try {
      // Clean up existing instances first
      await cleanupAudioResources();

      // Create new instances
      wavStreamPlayerRef.current = new WavStreamPlayer({ sampleRate: 24000 });
      wavRecorderRef.current = new WavRecorder({ sampleRate: 24000 });

      // Initialize them
      await wavStreamPlayerRef.current.connect();
      await wavRecorderRef.current.begin();

      return true;
    } catch (error) {
      console.error('Error initializing audio resources:', error);
      return false;
    }
  }, []);

  // Cleanup audio resources
  const cleanupAudioResources = useCallback(async () => {
    try {
      if (wavRecorderRef.current) {
        const recorderStatus = wavRecorderRef.current.getStatus();
        if (recorderStatus === 'recording' || recorderStatus === 'paused') {
          await wavRecorderRef.current.end();
        }
        wavRecorderRef.current = null;
      }

      if (wavStreamPlayerRef.current) {
        if (wavStreamPlayerRef.current.hasAudioData()) {
          await wavStreamPlayerRef.current.disconnect();
        }
        wavStreamPlayerRef.current = null;
      }
    } catch (error) {
      console.error('Error cleaning up audio resources:', error);
    }
  }, []);

  const {
    isConnected,
    isMicrophoneActive: isMicrophoneActiveFromHook,
    connectConversation,
    disconnectConversation,
    sendMessage,
  } = useRealtimeConnection({
    relayServerUrl: RELAY_SERVER_URL,
    instructions: assistantData?.instructions || '',
    updateTokenUsage: updateTokenUsageCallback,
    wavStreamPlayerRef,
    config,
    assistantId,
  });

  // Handle connection and disconnection
  const handleConnect = useCallback(async () => {
    try {
      const success = await initializeAudioResources();
      if (success) {
        await connectConversation();
      } else {
        throw new Error('Failed to initialize audio resources');
      }
    } catch (error) {
      console.error('Error during connection:', error);
      await cleanupAudioResources();
    }
  }, [initializeAudioResources, cleanupAudioResources, connectConversation]);

  const handleDisconnect = useCallback(async () => {
    try {
      disconnectConversation();
      await cleanupAudioResources();
    } catch (error) {
      console.error('Error during disconnection:', error);
    }
  }, [disconnectConversation, cleanupAudioResources]);

  // Handle audio playback state
  useEffect(() => {
    if (!isConnected || !wavStreamPlayerRef.current) return;

    const wavStreamPlayer = wavStreamPlayerRef.current;

    const handlePlaybackStarted = () => {
      setIsAssistantSpeaking(true);
    };

    const handlePlaybackEnded = () => {
      setIsAssistantSpeaking(false);
    };

    wavStreamPlayer.addEventListener('playbackStarted', handlePlaybackStarted);
    wavStreamPlayer.addEventListener('playbackEnded', handlePlaybackEnded);

    return () => {
      wavStreamPlayer.removeEventListener('playbackStarted', handlePlaybackStarted);
      wavStreamPlayer.removeEventListener('playbackEnded', handlePlaybackEnded);
    };
  }, [isConnected]);

  // Update microphone state from hook
  useEffect(() => {
    setIsMicrophoneActive(isMicrophoneActiveFromHook);
  }, [isMicrophoneActiveFromHook]);

  // Comprehensive cleanup on unmount
  useEffect(() => {
    return () => {
      handleDisconnect();
      
      // Stop memory monitoring
      const memoryMonitor = MemoryMonitor.getInstance();
      memoryMonitor.reset();

      // Clean up EventSource
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [handleDisconnect]);

  // Memory monitoring
  useEffect(() => {
    const memoryMonitor = MemoryMonitor.getInstance();
    
    if (isConnected) {
      memoryMonitor.startMonitoring(10000);
      
      const removeListener = memoryMonitor.addListener((snapshot) => {
        const trend = memoryMonitor.getMemoryTrend();
        if (trend.trend === 'increasing' && trend.averageGrowthMB > 50) {
          console.warn('High memory growth detected:', trend.averageGrowthMB.toFixed(2), 'MB/interval');
        }
      });

      return () => {
        removeListener();
        memoryMonitor.stopMonitoring();
      };
    }
  }, [isConnected]);

  const handleDownloadLogs = useCallback(() => {
    performanceLogger.downloadLogs();
  }, []);

  const handleAnalyzeLogs = useCallback(() => {
    const logs = performanceLogger.getLogs();
    const report = generatePerformanceReport(logs);

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance_analysis_${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const handleClearLogs = useCallback(() => {
    performanceLogger.clearLogs();
  }, []);

  const logMessage = (message: string) => {
    console.log(message);
    setLogs((prevLogs) => [...prevLogs, message]);
  };

  const notifyAssistant = useCallback(
    async (processingResult: ProcessStatusType) => {
      try {
        logMessage('Notifying assistant about completion...');

        if (!isConnected) {
          logMessage('Assistant not connected, connecting...');
          await connectConversation();
        }

        sendMessage('User stories are optimized. Please fetch P1 issues.');

        setTranscript(
          (prev) =>
            prev +
            `\nAssistant: User stories have been optimized and prioritized.\nTotal Stories: ${processingResult.total_stories}\nSuccess Count: ${processingResult.success_count}\nFailure Count: ${processingResult.failure_count}\nTotal Time: ${processingResult.total_time.toFixed(
              2
            )} seconds`
        );

        logMessage('Assistant notified successfully.');
      } catch (error) {
        console.error('Error notifying assistant:', error);
        setError('Failed to notify assistant.');
        logMessage(`Error notifying assistant: ${error}`);
      }
    },
    [isConnected, connectConversation, sendMessage]
  );

  const setupSSEConnection = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    logMessage('Setting up SSE connection for processing status updates...');

    const eventSource = new EventSource('/api/stream_optimization_status');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      logMessage('SSE connection opened.');
      retryCountRef.current = 0;
    };

    eventSource.onmessage = (event) => {
      let eventData = event.data.trim();

      if (eventData.startsWith('data:')) {
        eventData = eventData.replace(/^\s*data:\s*/, '');
      }

      try {
        const data: ProcessStatusType = JSON.parse(eventData);

        const { total_time, start_time, ...dataToCompare } = data;
        let prevDataToCompare: Partial<ProcessStatusType> | null = null;
        if (previousProcessStatusRef.current) {
          const {
            total_time: prevTotalTime,
            start_time: prevStartTime,
            ...restPrevData
          } = previousProcessStatusRef.current;
          prevDataToCompare = restPrevData;
        }

        if (
          JSON.stringify(dataToCompare) !== JSON.stringify(prevDataToCompare)
        ) {
          logMessage(`Received SSE data: ${JSON.stringify(data)}`);
          setProcessStatus(data);
          previousProcessStatusRef.current = data;
        }

        if (
          data.status === 'completed' ||
          data.status === 'failed' ||
          data.status === 'success'
        ) {
          setIsProcessing(false);

          if (data.status === 'completed' || data.status === 'success') {
            notifyAssistant(data);
          } else {
            setError(
              'Jira subtask processing failed. Please check the logs for more details.'
            );
            logMessage('Jira subtask processing failed.');
          }

          eventSource.close();
          eventSourceRef.current = null;
        }
      } catch (parseError) {
        console.error('Error parsing SSE data:', parseError);
        logMessage(`Error parsing SSE data: ${parseError}`);
      }
    };

    eventSource.addEventListener('ping', (event) => {
      console.log(`Received ping: ${event.data}`);
    });

    eventSource.onerror = (event) => {
      console.error('SSE connection error:', event);

      let errorMessage = 'An error occurred with the SSE connection.';
      if (event instanceof MessageEvent) {
        errorMessage += ` Message: ${event.data}`;
      } else if (event instanceof Event) {
        errorMessage += ` Event type: ${event.type}`;
      }

      setError(errorMessage);
      logMessage(`SSE connection error: ${JSON.stringify(event)}`);

      eventSource.close();
      eventSourceRef.current = null;

      if (retryCountRef.current < maxRetries) {
        retryCountRef.current += 1;
        logMessage('Attempting to reconnect SSE...');
        setTimeout(() => {
          setupSSEConnection();
        }, 5000);
      } else {
        logMessage('Maximum SSE reconnection attempts reached.');
        setIsProcessing(false);
      }
    };
  }, [notifyAssistant]);

  const processJiraSubtasks = useCallback(async () => {
    try {
      logMessage('Starting Jira subtask processing...');
      const response = await axios.post('/api/process_jira_subtasks');

      if (response.status === 200) {
        const data = response.data;
        if (
          data.status === 'processing' ||
          data.status === 'success' ||
          data.status === 'idle'
        ) {
          logMessage('Jira subtask processing started.');
          setupSSEConnection();
        } else {
          throw new Error(`Unexpected response status: ${data.status}`);
        }
      } else {
        throw new Error(
          `Failed to start Jira subtask processing: ${response.statusText}`
        );
      }
    } catch (error) {
      console.error('Error starting Jira subtask processing:', error);
      setError('Failed to start Jira subtask processing. Please try again later.');
      setIsProcessing(false);
      logMessage(`Error starting Jira subtask processing: ${error}`);
    }
  }, [setupSSEConnection]);

  const processImagesSequentially = useCallback(
    async (imageUrls: string[]) => {
      for (const url of imageUrls) {
        let success = false;

        try {
          logMessage(`Processing image: ${url}`);
          const response = await axios.post(
            'https://c5kpj2.buildship.run/claudevision',
            { message: url }
          );
          if (response.status === 200) {
            logMessage(`Successfully processed image: ${url}`);
            success = true;
          } else {
            throw new Error(`Image processing failed: ${response.statusText}`);
          }
        } catch (error) {
          logMessage(`First attempt failed for image: ${url}`);
        }

        if (!success) {
          try {
            logMessage(`Retrying image: ${url}`);
            const response = await axios.post(
              'https://c5kpj2.buildship.run/claudevision',
              { message: url }
            );
            if (response.status === 200) {
              logMessage(`Successfully processed image on retry: ${url}`);
              success = true;
            } else {
              throw new Error(
                `Image processing failed on retry: ${response.statusText}`
              );
            }
          } catch (error) {
            logMessage(`Retry failed for image: ${url}, moving to next image`);
          }
        }
      }

      await processJiraSubtasks();

      try {
        await axios.post('/api/cleanup-pngs', { png_urls: imageUrls });
        logMessage('Successfully cleaned up all PNG files');
      } catch (error) {
        console.error('Error cleaning up PNGs:', error);
        logMessage('Warning: Failed to cleanup PNG files');
      }
    },
    [processJiraSubtasks]
  );

  const handleUploadPdf = useCallback(async () => {
    if (!pdfFile) {
      setError('Please select a PDF file to upload.');
      return;
    }

    setIsProcessing(true);
    setUploadProgress(0);
    setError(null);
    setProcessStatus(null);
    retryCountRef.current = 0;

    try {
      logMessage('Starting PDF upload and processing...');
      const formData = new FormData();
      formData.append('file', pdfFile);

      const uploadResponse = await axios.post('/api/process_pdf', formData, {
        onUploadProgress: (progressEvent) => {
          const { loaded, total } = progressEvent;
          if (total) {
            const percentCompleted = Math.round((loaded * 100) / total);
            setUploadProgress(percentCompleted);
            logMessage(`Upload progress: ${percentCompleted}%`);
          }
        },
      });

      if (uploadResponse.status === 200) {
        logMessage('PDF processed successfully.');
        const { png_urls } = uploadResponse.data;
        await processImagesSequentially(png_urls);
      } else {
        throw new Error(`PDF processing failed: ${uploadResponse.statusText}`);
      }
    } catch (err) {
      console.error('Error processing PDF:', err);
      setError(
        'Failed to process PDF file. Please check your network connection and try again.'
      );
      setIsProcessing(false);
      logMessage(`Error processing PDF: ${err}`);
    }
  }, [pdfFile, processImagesSequentially]);

  const handlePdfFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        setPdfFile(e.target.files[0]);
      }
    },
    []
  );

  const DisplayToggle = () => (
    <button
      onClick={() => setIsAdvancedMode(!isAdvancedMode)}
      className="fixed top-4 right-4 px-4 py-2 bg-gray-800 text-white rounded-full text-sm shadow-lg hover:bg-gray-700 transition-colors duration-200"
    >
      Switch to {isAdvancedMode ? 'Basic' : 'Advanced'} Mode
    </button>
  );

  return (
    <div className="flex flex-col md:flex-row bg-white text-gray-800">
      <DisplayToggle />
      {!isAdvancedMode ? (
        <div className="min-h-screen bg-gray-50">
          <BasicDisplay
            name={assistantData.name}
            imageSrc={imageSrc}
            isConnected={isConnected}
            isMicrophoneActive={isMicrophoneActive}
            isProcessing={isProcessing}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onFileChange={handlePdfFileChange}
            onUpload={handleUploadPdf}
            selectedFile={pdfFile}
            transcript={transcript}
            isAssistantSpeaking={isAssistantSpeaking}
          />
        </div>
      ) : (
        <div className="flex flex-col md:flex-row w-full">
          {/* Left Section */}
          <div className="md:w-1/2 p-6">
            <AssistantProfile
              name={assistantData.name}
              imageSrc={imageSrc}
              isConnected={isConnected}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
            />
            
            {/* Status Indicator */}
            <div className="mt-4">
              <StatusIndicator
                isConnected={isConnected}
                isMicrophoneActive={isMicrophoneActive}
                isAssistantSpeaking={isAssistantSpeaking}
              />
            </div>

            <TranscriptViewer transcript={transcript} />
          </div>

          {/* Right Section */}
          <div className="md:w-1/2 p-6 bg-gray-100">
            <Introduction />

            <FileUploader
              onFileChange={handlePdfFileChange}
              onUpload={handleUploadPdf}
              selectedFile={pdfFile}
            />

            <ProcessStatus
              isProcessing={isProcessing}
              uploadProgress={uploadProgress}
              processStatus={processStatus}
              error={error}
            />

            <LogViewer logs={logs} onClearLogs={() => setLogs([])} />
          </div>
        </div>
      )}
    </div>
  );
};

export default VirtualBusinessAnalystPage;
