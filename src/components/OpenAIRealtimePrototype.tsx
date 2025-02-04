// src/components/OpenAIRealtimePrototype.tsx

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { Toaster } from 'react-hot-toast';
import TokenUsageStats from './TokenUsageStats';
import RealtimeEvents from './RealtimeEvents';
import { instructions } from '../utils/conversation_config';
import AudioVisualization from './OpenAIRealtimePrototype/AudioVisualization';
import useRealtimeConnection from './OpenAIRealtimePrototype/useRealtimeConnection';
import useTokenUsage from './OpenAIRealtimePrototype/useTokenUsage';
import useAudioVisualization from './OpenAIRealtimePrototype/useAudioVisualization';
import toastUtils from '../utils/toast';
import Image from 'next/image';
import { WavRecorder, WavStreamPlayer } from '../lib/wavtools/index';
import ConversationDisplay from './OpenAIRealtimePrototype/ConversationDisplay';
import type { ConversationItem } from './OpenAIRealtimePrototype/types';

const RELAY_SERVER_URL = '/api/realtime-relay';
const ADMIN_USER_EMAIL = 'vincent@getinference.com';

// Define the Config interface and default config values
interface Config {
  voiceSettings: string;
  threshold: number;
  prefixPaddingMs: number;
  silenceDurationMs: number;
  temperature: number;
}

const defaultConfig: Config = {
  voiceSettings: 'alloy',
  threshold: 0.5,
  prefixPaddingMs: 500,
  silenceDurationMs: 300,
  temperature: 0.6,
};

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
  remainingRequests: number;
  requestLimit: number;
  sessionTotalTokens: number;
}

interface RateLimit {
  name: string;
  limit: number;
  remaining: number;
  reset_seconds: number;
}

const OpenAIRealtimePrototype: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [showFullScreenImage, setShowFullScreenImage] = useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [conversationId, setConversationId] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [serverAudioDone, setServerAudioDone] = useState(false);
  const [playbackDone, setPlaybackDone] = useState(false);

  const assistantId = 'prototypeAssistantId';

  const wavRecorderRef = useRef<WavRecorder>(
    new WavRecorder({ sampleRate: 24000 })
  );
  const wavStreamPlayerRef = useRef<WavStreamPlayer>(
    new WavStreamPlayer({ sampleRate: 24000 })
  );

  const { tokenUsage, updateTokenUsage, error: tokenUsageError } = useTokenUsage(
    isConnected,
    isAdmin,
    sessionId,
    conversationId,
    assistantId
  );

  const updateTokenUsageCallback = useCallback(
    (
      usage: Partial<TokenUsage> | null,
      rateLimits: RateLimit[],
      hookSessionId: string,
      hookConversationId: string
    ) => {
      updateTokenUsage(usage, rateLimits, hookSessionId, hookConversationId);
    },
    [updateTokenUsage]
  );

  const {
    isConnected: isConnectedFromHook,
    isLoading,
    error: connectionError,
    conversationItems,
    realtimeEvents,
    rateLimits: connectionRateLimits,
    isMicrophoneActive,
    sessionId: hookSessionId,
    conversationId: hookConversationId,
    connectConversation,
    disconnectConversation,
    handleInterruption,
  } = useRealtimeConnection({
    relayServerUrl: RELAY_SERVER_URL,
    instructions,
    updateTokenUsage: updateTokenUsageCallback,
    wavStreamPlayerRef,
    config: defaultConfig,
    assistantId,
  });

  const {
    clientCanvasRef,
    serverCanvasRef,
    error: audioVisualizationError,
    resetAudioVisualization,
  } = useAudioVisualization(isConnected, wavStreamPlayerRef);

  useEffect(() => {
    setIsConnected(isConnectedFromHook);
  }, [isConnectedFromHook]);

  useEffect(() => {
    if (hookSessionId !== sessionId) {
      setSessionId(hookSessionId);
    }
    if (hookConversationId !== conversationId) {
      setConversationId(hookConversationId);
    }
  }, [hookSessionId, hookConversationId, sessionId, conversationId]);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAdmin(currentUser?.email === ADMIN_USER_EMAIL);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (tokenUsageError) {
      console.error('Token usage error:', tokenUsageError);
    }
  }, [tokenUsageError]);

  useEffect(() => {
    if (audioVisualizationError) {
      console.error('Audio visualization error:', audioVisualizationError);
    }
  }, [audioVisualizationError]);

  useEffect(() => {
    if (isConnected && sessionId && conversationId) {
      updateTokenUsage(
        null,
        connectionRateLimits || [],
        sessionId,
        conversationId
      );
    }
  }, [
    isConnected,
    sessionId,
    conversationId,
    updateTokenUsage,
    connectionRateLimits,
  ]);

  useEffect(() => {
    console.log('isConnected changed:', isConnected);
    if (isConnected) {
      console.log('Initializing WavRecorder and WavStreamPlayer');
      wavRecorderRef.current
        .begin()
        .then(() => {
          console.log('WavRecorder initialized successfully');
        })
        .catch((error) => {
          console.error('Error initializing WavRecorder:', error);
        });
      wavStreamPlayerRef.current
        .connect()
        .then(() => {
          console.log('WavStreamPlayer connected successfully');
        })
        .catch((error) => {
          console.error('Error connecting WavStreamPlayer:', error);
        });
    } else {
      console.log('Ending WavRecorder and disconnecting WavStreamPlayer');
      const recorderStatus = wavRecorderRef.current.getStatus();
      if (recorderStatus === 'recording' || recorderStatus === 'paused') {
        wavRecorderRef.current.end().catch((error) => {
          console.error('Error ending WavRecorder:', error);
        });
      }
      if (wavStreamPlayerRef.current.hasAudioData()) {
        wavStreamPlayerRef.current
          .disconnect()
          .then(() => {
            console.log('WavStreamPlayer disconnected successfully');
          })
          .catch((error) => {
            console.error('Error disconnecting WavStreamPlayer:', error);
          });
      }
      // Reset states when disconnected
      setIsAssistantSpeaking(false);
      setServerAudioDone(false);
      setPlaybackDone(false);
    }
  }, [isConnected]);

  useEffect(() => {
    const wavStreamPlayer = wavStreamPlayerRef.current;

    const handlePlaybackStarted = () => {
      console.log('Playback started');
      setIsAssistantSpeaking(true);
    };

    const handlePlaybackEnded = () => {
      console.log('Playback ended');
      setIsAssistantSpeaking(false);
    };

    wavStreamPlayer.addEventListener('playbackStarted', handlePlaybackStarted);
    wavStreamPlayer.addEventListener('playbackEnded', handlePlaybackEnded);

    return () => {
      wavStreamPlayer.removeEventListener(
        'playbackStarted',
        handlePlaybackStarted
      );
      wavStreamPlayer.removeEventListener(
        'playbackEnded',
        handlePlaybackEnded
      );
    };
  }, []);

  useEffect(() => {
    const wavStreamPlayer = wavStreamPlayerRef.current;

    const handlePlaybackDone = () => {
      console.log('Playback done');
      setPlaybackDone(true);
    };

    wavStreamPlayer.addEventListener('playbackEnded', handlePlaybackDone);

    return () => {
      wavStreamPlayer.removeEventListener('playbackEnded', handlePlaybackDone);
    };
  }, []);

  useEffect(() => {
    if (serverAudioDone && playbackDone) {
      console.log('Server audio done and playback done, resetting states');
      setServerAudioDone(false);
      setPlaybackDone(false);
    }
  }, [serverAudioDone, playbackDone]);

  const handleConnect = useCallback(() => {
    console.log('Connecting...');
    connectConversation();
  }, [connectConversation]);

  const handleDisconnect = useCallback(() => {
    console.log('Disconnecting...');
    disconnectConversation();
  }, [disconnectConversation]);

  const handleAddTestTone = useCallback(() => {
    console.log('Adding test tone');
    if (wavStreamPlayerRef.current) {
      const testTone = generateTestTone();
      wavStreamPlayerRef.current.add16BitPCM(testTone, 'test-tone');
      console.log('Test tone added');
    } else {
      console.error('WavStreamPlayer not initialized');
    }
  }, []);

  const toggleDebugPanel = useCallback(
    () => setShowDebugPanel((prev) => !prev),
    []
  );

  const toggleFullScreenImage = useCallback(
    () => setShowFullScreenImage((prev) => !prev),
    []
  );

  const handleAssistantStreamingChange = useCallback(
    (isStreaming: boolean) => {
      console.log('Assistant streaming changed:', isStreaming);
    },
    []
  );

  const renderDebugPanel = () => {
    if (!isAdmin) return null;
    return (
      <div className="mt-4 p-4 bg-gray-100 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Debug Information</h3>
        <p>Session ID: {sessionId || 'Not set'}</p>
        <p>Conversation ID: {conversationId || 'Not set'}</p>
        <p>Is Connected: {isConnected ? 'Yes' : 'No'}</p>
        <p>Is Admin: {isAdmin ? 'Yes' : 'No'}</p>
        <p>Microphone Active: {isMicrophoneActive ? 'Yes' : 'No'}</p>
        <p>Assistant Speaking: {isAssistantSpeaking ? 'Yes' : 'No'}</p>
        <h4 className="font-semibold mt-2">Token Usage:</h4>
        <pre className="bg-gray-200 p-2 rounded">
          {JSON.stringify(tokenUsage, null, 2)}
        </pre>
        <h4 className="font-semibold mt-2">Rate Limits:</h4>
        <pre className="bg-gray-200 p-2 rounded">
          {JSON.stringify(connectionRateLimits, null, 2)}
        </pre>
      </div>
    );
  };

  const renderAvatar = () => {
    const imageSrc =
      isAssistantSpeaking && !isMicrophoneActive
        ? '/static/yubotot.gif'
        : '/static/yuboto.gif';
    return (
      <div
        className="relative w-32 h-32 mx-auto mb-4 cursor-pointer"
        onClick={toggleFullScreenImage}
      >
        <Image
          src={imageSrc}
          alt="Avatar"
          width={128}
          height={128}
          objectFit="cover"
          className="rounded-full"
        />
      </div>
    );
  };

  const renderFullScreenImage = () => {
    if (!showFullScreenImage) return null;
    const imageSrc =
      isAssistantSpeaking && !isMicrophoneActive
        ? '/static/yubotot.gif'
        : '/static/yuboto.gif';
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
        onClick={toggleFullScreenImage}
      >
        <div className="relative w-3/4 h-3/4">
          <Image
            src={imageSrc}
            alt="Full Screen Avatar"
            layout="fill"
            objectFit="contain"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <Toaster position="top-right" />
      <h2 className="text-2xl font-bold mb-4">
        OpenAI Realtime API Chat with VAD
      </h2>
      {connectionError && (
        <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
          {connectionError}
        </div>
      )}
      <div className="mb-4 flex space-x-2 items-center">
        {user ? (
          <p>
            Logged in as: {user.email} {isAdmin && '(Admin)'}
          </p>
        ) : (
          <p>Not logged in</p>
        )}
        <button
          onClick={isConnected ? handleDisconnect : handleConnect}
          disabled={isLoading || !user}
          className={`px-4 py-2 rounded ${
            isConnected
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-green-500 hover:bg-green-600'
          } text-white ${
            isLoading || !user ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isLoading
            ? 'Processing...'
            : isConnected
            ? 'Disconnect'
            : 'Connect'}
        </button>
        {isConnected && (
          <div
            className={`w-4 h-4 rounded-full ${
              isMicrophoneActive ? 'bg-green-500' : 'bg-gray-500'
            }`}
          />
        )}
        {isConnected && isAdmin && (
          <button
            onClick={handleInterruption}
            className="px-4 py-2 rounded bg-yellow-500 hover:bg-yellow-600 text-white"
          >
            Debug: Trigger Interruption
          </button>
        )}
        {isAdmin && (
          <button
            onClick={toggleDebugPanel}
            className="px-4 py-2 rounded bg-blue-500 hover:bg-blue-600 text-white"
          >
            {showDebugPanel ? 'Hide Debug Panel' : 'Show Debug Panel'}
          </button>
        )}
        {isConnected && isAdmin && (
          <button
            onClick={handleAddTestTone}
            className="px-4 py-2 rounded bg-purple-500 hover:bg-purple-600 text-white"
          >
            Add Test Tone
          </button>
        )}
      </div>
      {showDebugPanel && renderDebugPanel()}
      {renderAvatar()}
      <div className="grid grid-cols-4 gap-4">
        {isAdmin && (
          <div className="col-span-1">
            <TokenUsageStats {...tokenUsage} />
          </div>
        )}
        <div className="col-span-1">
          <RealtimeEvents
            events={realtimeEvents}
            rateLimits={connectionRateLimits || []}
          />
        </div>
        <div className={isAdmin ? 'col-span-2' : 'col-span-3'}>
          <ConversationDisplay
            conversationItems={conversationItems}
            onAssistantStreamingChange={handleAssistantStreamingChange}
          />
        </div>
      </div>
      <AudioVisualization
        isConnected={isConnected}
        clientCanvasRef={clientCanvasRef}
        serverCanvasRef={serverCanvasRef}
        isUserSpeaking={isMicrophoneActive}
        isAssistantSpeaking={isAssistantSpeaking}
      />
      {isConnected && (
        <p className="text-center text-gray-600 mt-4">
          VAD mode active. Speak naturally, and the AI will respond when you
          pause. You can interrupt by speaking at any time.
        </p>
      )}
      {renderFullScreenImage()}
    </div>
  );
};

// Helper function to generate a test tone
function generateTestTone(
  duration = 1,
  frequency = 440,
  sampleRate = 24000
): Int16Array {
  const samples = duration * sampleRate;
  const buffer = new Int16Array(samples);
  for (let i = 0; i < samples; i++) {
    buffer[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 32767;
  }
  return buffer;
}

export default OpenAIRealtimePrototype;
