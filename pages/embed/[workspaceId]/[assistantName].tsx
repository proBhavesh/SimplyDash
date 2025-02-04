import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { WavRecorder, WavStreamPlayer } from '../../../src/lib/wavtools/index';
import useRealtimeConnection from '../../../src/components/OpenAIRealtimePrototype/useRealtimeConnection';
import useAudioVisualization from '../../../src/components/OpenAIRealtimePrototype/useAudioVisualization';
import AudioVisualization from '../../../src/components/OpenAIRealtimePrototype/AudioVisualization';
import Head from 'next/head';

interface Config {
  voiceSettings: string;
  threshold: number;
  prefixPaddingMs: number;
  silenceDurationMs: number;
  temperature: number;
}

interface TokenUsage {
  totalTokens: number;
  inputTokens: {
    total: number;
    cached: number;
    text: number;
    audio: number;
  };
  outputTokens: {
    total: number;
    text: number;
    audio: number;
  };
}

interface RateLimit {
  name: string;
  limit: number;
  remaining: number;
  reset_seconds: number;
}

interface AssistantData {
  assistantId: string;
  embeddedToken: string;
  instructions?: string;
  voiceSettings?: string;
  threshold?: number;
  prefixPaddingMs?: number;
  silenceDurationMs?: number;
  temperature?: number;
  talkingGifUrl?: string;
  waitingGifUrl?: string;
}

export default function EmbedPage() {
  const router = useRouter();
  const { workspaceId, assistantName } = router.query;
  const [assistantData, setAssistantData] = useState<AssistantData | null>(null);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFrameVisible, setIsFrameVisible] = useState(false);
  const [audioContextInitialized, setAudioContextInitialized] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [isAudioInitialized, setIsAudioInitialized] = useState(false);

  // Initialize with browser's default sample rate
  const wavRecorderRef = useRef<WavRecorder | null>(null);
  const wavStreamPlayerRef = useRef<WavStreamPlayer | null>(null);

  // Default config
  const config: Config = {
    voiceSettings: assistantData?.voiceSettings || 'alloy',
    threshold: assistantData?.threshold !== undefined ? assistantData.threshold : 0.5,
    prefixPaddingMs: assistantData?.prefixPaddingMs !== undefined ? assistantData.prefixPaddingMs : 500,
    silenceDurationMs: assistantData?.silenceDurationMs !== undefined ? assistantData.silenceDurationMs : 300,
    temperature: assistantData?.temperature !== undefined ? assistantData.temperature : 0.6,
  };

  // Listen for frame visibility message
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data.type === 'assistant-frame-visible') {
        setIsFrameVisible(true);
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Initialize audio context and worklet
  const initializeAudio = async () => {
    try {
      // Create AudioContext first
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
        latencyHint: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 'playback' : 'interactive'
      });
      audioContextRef.current = ctx;

      // Request microphone permissions directly
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        
        // Resume context immediately
        await ctx.resume();
        console.log('AudioContext resumed successfully');

        // Continue initialization with the active stream
        await continueInitialization(stream);
      } catch (err) {
        console.error('Error requesting microphone permission:', err);
        setError('Please allow microphone access to continue.');
        
        // Clean up on error
        if (audioContextRef.current) {
          await audioContextRef.current.close();
          audioContextRef.current = null;
        }
        return;
      }
    } catch (error) {
      console.error('Error in initializeAudio:', error);
      setError('Failed to start audio. Please check your audio settings and try again.');
      // Clean up on error
      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }
      wavRecorderRef.current = null;
      wavStreamPlayerRef.current = null;
      setAudioContextInitialized(false);
      setIsAudioInitialized(false);
    }
  };

  const continueInitialization = async (stream: MediaStream) => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    try {
      // Initialize recorder
      wavRecorderRef.current = new WavRecorder({ 
        sampleRate: ctx.sampleRate,
        debug: true // Enable debug mode for better error logging
      });

      // Set up the stream for recording
      const source = ctx.createMediaStreamSource(stream);
      const destination = ctx.createMediaStreamDestination();
      source.connect(destination);
      
      wavStreamPlayerRef.current = new WavStreamPlayer({ 
        sampleRate: ctx.sampleRate,
        debug: true // Enable debug mode for better error logging
      });

      // Load worklet using fetch to get the content
      try {
        const workletResponse = await fetch('/wavtools/worklets/stream_processor.js');
        if (!workletResponse.ok) {
          throw new Error(`Failed to load worklet: ${workletResponse.statusText}`);
        }

        const workletText = await workletResponse.text();
        const workletBlob = new Blob([workletText], { 
          type: 'application/javascript; charset=utf-8' 
        });
        const workletUrl = URL.createObjectURL(workletBlob);

        await ctx.audioWorklet.addModule(workletUrl);
        console.log('AudioWorklet loaded successfully');
        URL.revokeObjectURL(workletUrl);

        // Connect player after worklet is loaded
        if (wavStreamPlayerRef.current) {
          // For mobile, set up audio nodes
          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
          if (isMobile) {
            // Create and connect a compressor node for better mobile audio
            const compressor = ctx.createDynamicsCompressor();
            compressor.threshold.value = -50;
            compressor.knee.value = 40;
            compressor.ratio.value = 12;
            compressor.attack.value = 0;
            compressor.release.value = 0.25;
            compressor.connect(ctx.destination);

            // Create a gain node to boost the volume on mobile
            const gainNode = ctx.createGain();
            gainNode.gain.value = 2.0; // Boost volume
            gainNode.connect(compressor);

            // Connect the gain node to the destination
            gainNode.connect(ctx.destination);
          }

          await wavStreamPlayerRef.current.connect();
          console.log('WavStreamPlayer connected successfully');
          setAudioContextInitialized(true);
          setIsAudioInitialized(true);
          
          // Automatically connect conversation after successful initialization
          connectConversation();
        }
      } catch (error) {
        console.error('Error loading worklet:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error initializing audio:', error);
      setError('Failed to start audio. Please check your audio settings and try again.');
      // Clean up on error
      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }
      wavRecorderRef.current = null;
      wavStreamPlayerRef.current = null;
      setAudioContextInitialized(false);
      setIsAudioInitialized(false);
    }
  };

  // Handle connect button click
  const handleConnect = async () => {
    if (!isAudioInitialized) {
      await initializeAudio();
    }
  };

  // Fetch assistant data
  useEffect(() => {
    if (workspaceId && assistantName) {
      fetch(`/api/openai-assistant-config?workspaceId=${workspaceId}&assistantName=${assistantName}`)
        .then(response => {
          if (!response.ok) throw new Error('Failed to fetch assistant data');
          return response.json();
        })
        .then(data => {
          setAssistantData(data);
        })
        .catch(err => {
          console.error('Error fetching assistant data:', err);
          setError('Failed to load assistant');
        });
    }
  }, [workspaceId, assistantName]);

  const updateTokenUsage = async (usage: any, rateLimits: any[], sessionId: string, conversationId: string) => {
    if (!assistantData?.assistantId || !workspaceId || !assistantName) {
      console.error('Missing required data for token tracking:', {
        assistantId: assistantData?.assistantId,
        workspaceId,
        assistantName
      });
      return;
    }

    try {
      // First, validate we have all required token data
      if (!usage || typeof usage.totalTokens === 'undefined') {
        console.error('Invalid token usage data:', usage);
        return;
      }

      // Get the embedded token from the assistant data
      const embeddedToken = assistantData.embeddedToken;
      if (!embeddedToken) {
        console.error('Missing embedded token for authentication');
        return;
      }

      // Prepare the token usage data with proper typing
      const tokenUsageData = {
        assistantId: assistantData.assistantId,
        workspaceId: workspaceId as string,
        assistantName: assistantName as string,
        sessionId,
        conversationId,
        tokenUsage: {
          totalTokens: usage.totalTokens,
          inputTokens: {
            total: usage.inputTokens.total,
            cached: usage.inputTokens.cached,
            text: usage.inputTokens.text,
            audio: usage.inputTokens.audio
          },
          outputTokens: {
            total: usage.outputTokens.total,
            text: usage.outputTokens.text,
            audio: usage.outputTokens.audio
          }
        },
        rateLimits,
        source: 'embedded' as const,
        metadata: {
          origin: window.location.origin,
          referrer: document.referrer,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent
        }
      };

      // Send the token usage data with embedded authentication
      const response = await fetch('/api/log-token-usage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${embeddedToken}`,
          'X-Assistant-ID': assistantData.assistantId,
          'X-Workspace-ID': workspaceId as string,
          'X-Assistant-Name': assistantName as string,
          'X-Source': 'embedded'
        },
        body: JSON.stringify(tokenUsageData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to log token usage: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Token usage logged successfully:', {
        sessionId,
        conversationId,
        totalTokens: usage.totalTokens,
        inputTokens: usage.inputTokens.total,
        outputTokens: usage.outputTokens.total
      });
    } catch (error) {
      // Log error but don't throw to avoid interrupting the conversation
      console.error('Error logging token usage:', error);
    }
  };

  const RELAY_SERVER_URL = `/api/realtime-relay?assistantId=${encodeURIComponent(assistantData?.assistantId || '')}`;

  const {
    isConnected,
    isLoading,
    error: connectionError,
    isMicrophoneActive,
    connectConversation,
    disconnectConversation,
    handleInterruption,
  } = useRealtimeConnection({
    relayServerUrl: RELAY_SERVER_URL,
    instructions: assistantData?.instructions || '',
    updateTokenUsage,
    wavStreamPlayerRef,
    config,
    assistantId: assistantData?.assistantId || '',
  });

  const {
    clientCanvasRef,
    serverCanvasRef,
    error: audioVisualizationError,
  } = useAudioVisualization(
    isConnected && audioContextInitialized,
    wavStreamPlayerRef,
    wavRecorderRef
  );

  // Only initialize audio when frame is visible and audio context is ready
  useEffect(() => {
    if (!isFrameVisible || !audioContextInitialized || !wavRecorderRef.current || !wavStreamPlayerRef.current) return;

    if (isConnected) {
      wavRecorderRef.current?.begin().catch(console.error);
      wavStreamPlayerRef.current?.connect().catch(console.error);
    } else {
      const recorderStatus = wavRecorderRef.current?.getStatus();
      if (recorderStatus === 'recording' || recorderStatus === 'paused') {
        wavRecorderRef.current?.end().catch(console.error);
      }
      if (wavStreamPlayerRef.current?.hasAudioData()) {
        wavStreamPlayerRef.current?.disconnect().catch(console.error);
      }
    }
  }, [isFrameVisible, audioContextInitialized, isConnected]);

  useEffect(() => {
    if (!isConnected || !wavStreamPlayerRef.current) return;

    const wavStreamPlayer = wavStreamPlayerRef.current;

    const handlePlaybackStarted = () => setIsAssistantSpeaking(true);
    const handlePlaybackEnded = () => setIsAssistantSpeaking(false);

    wavStreamPlayer.addEventListener('playbackStarted', handlePlaybackStarted);
    wavStreamPlayer.addEventListener('playbackEnded', handlePlaybackEnded);

    return () => {
      wavStreamPlayer.removeEventListener('playbackStarted', handlePlaybackStarted);
      wavStreamPlayer.removeEventListener('playbackEnded', handlePlaybackEnded);
    };
  }, [isConnected]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isConnected) {
        disconnectConversation();
      }
      if (wavRecorderRef.current) {
        const recorderStatus = wavRecorderRef.current?.getStatus();
        if (recorderStatus === 'recording' || recorderStatus === 'paused') {
          wavRecorderRef.current?.end().catch(console.error);
        }
      }
      if (wavStreamPlayerRef.current?.hasAudioData()) {
        wavStreamPlayerRef.current?.disconnect().catch(console.error);
      }
      if (audioContextRef.current) {
        audioContextRef.current?.close().catch(console.error);
        audioContextRef.current = null;
      }
      setAudioContextInitialized(false);
      setIsAudioInitialized(false);
    };
  }, [isConnected, disconnectConversation]);

  if (error || connectionError || audioVisualizationError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-red-500">
          {error || connectionError || audioVisualizationError}
        </div>
      </div>
    );
  }

  if (!assistantData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <style>{`
          body {
            margin: 0;
            padding: 0;
            overflow: hidden;
            height: 100vh;
            width: 100vw;
            background: white;
          }
          #__next {
            height: 100%;
          }
          canvas {
            image-rendering: pixelated;
          }
        `}</style>
      </Head>
      <div className="fixed inset-0 flex flex-col bg-white">
        {/* Main Container */}
        <div className="flex-1 flex flex-col items-center p-4 overflow-hidden">
          {/* Avatar Section - Fixed size, centered */}
          <div className="w-full flex justify-center mb-6">
            <div className="relative w-24 h-24 rounded-full overflow-hidden shadow-lg">
              <img
                src={isAssistantSpeaking ? (assistantData?.talkingGifUrl || '/static/yubotot.gif') : (assistantData?.waitingGifUrl || '/static/yuboto.gif')}
                alt="Assistant Avatar"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Controls Section - Fixed height */}
          <div className="w-full flex flex-col items-center space-y-4 mb-6">
            {/* Connect Button */}
            <button
              onClick={isConnected ? disconnectConversation : handleConnect}
              disabled={isLoading || !isFrameVisible}
              className={`px-6 py-2 rounded-full text-lg font-medium transition-all duration-200 transform hover:scale-105 ${
                isConnected ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
              } text-white shadow-md ${
                (isLoading || !isFrameVisible) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              style={{ minWidth: '120px' }}
            >
              {isLoading ? 'Processing...' : isConnected ? 'Disconnect' : 'Connect'}
            </button>

            {/* Microphone Status */}
            {isConnected && (
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${isMicrophoneActive ? 'bg-green-500' : 'bg-gray-500'} shadow-sm`} />
                <span className="text-sm text-gray-600">
                  {isMicrophoneActive ? 'Speaking' : 'Listening'}
                </span>
              </div>
            )}
          </div>

          {/* Audio Visualization Section - Flex grow with fixed aspect ratio */}
          <div className="w-full flex-1 min-h-0">
            <AudioVisualization
              isConnected={isConnected && audioContextInitialized}
              clientCanvasRef={clientCanvasRef}
              serverCanvasRef={serverCanvasRef}
              isUserSpeaking={isMicrophoneActive}
              isAssistantSpeaking={isAssistantSpeaking}
              className="h-full"
            />
          </div>
        </div>

        {/* Error Display */}
        {(error || connectionError || audioVisualizationError) && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90">
            <div className="max-w-md p-4 rounded-lg bg-red-50 border border-red-200">
              <p className="text-red-600 text-center">
                {error || connectionError || audioVisualizationError}
              </p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {!assistantData && (
          <div className="absolute inset-0 flex items-center justify-center bg-white">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-gray-800"></div>
          </div>
        )}
      </div>
    </>
  );
}
