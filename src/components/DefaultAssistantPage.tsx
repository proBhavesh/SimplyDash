// src/components/DefaultAssistantPage.tsx

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import AudioVisualization from './OpenAIRealtimePrototype/AudioVisualization';
import useAudioVisualization from './OpenAIRealtimePrototype/useAudioVisualization';
import { WavStreamPlayer } from '../lib/wavtools/index';
import useRealtimeConnection from './OpenAIRealtimePrototype/useRealtimeConnection';

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
  tokensLeftThisMinute?: number;
}

interface RateLimit {
  name: string;
  limit: number;
  remaining: number;
  reset_seconds: number;
}

interface DefaultAssistantPageProps {
  assistantData: any;
}

const DefaultAssistantPage: React.FC<DefaultAssistantPageProps> = ({ assistantData }) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState<boolean>(false);
  const [isMicrophoneActive, setIsMicrophoneActive] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [conversationId, setConversationId] = useState<string>('');

  const wavStreamPlayerRef = useRef<WavStreamPlayer>(
    new WavStreamPlayer({ sampleRate: 24000 })
  );

  const {
    clientCanvasRef,
    serverCanvasRef,
  } = useAudioVisualization(isConnected, wavStreamPlayerRef);

  const updateTokenUsageCallback = useCallback(
    (
      usage: Partial<TokenUsage> | null,
      rateLimits: RateLimit[],
      hookSessionId: string,
      hookConversationId: string
    ) => {
      // Implement this function if needed
    },
    []
  );

  const assistantId = assistantData?.assistantId || assistantData?.id;

  const config: Config = {
    voiceSettings: assistantData?.voiceSettings || 'alloy',
    threshold:
      assistantData?.threshold !== undefined ? assistantData?.threshold : 0.5,
    prefixPaddingMs:
      assistantData?.prefix_padding_ms !== undefined
        ? assistantData?.prefix_padding_ms
        : 500,
    silenceDurationMs:
      assistantData?.silence_duration_ms !== undefined
        ? assistantData?.silence_duration_ms
        : 300,
    temperature:
      assistantData?.temperature !== undefined ? assistantData?.temperature : 0.6,
  };

  const RELAY_SERVER_URL = `/api/realtime-relay?assistantId=${encodeURIComponent(
    assistantId
  )}`;

  const {
    isConnected: isConnectedFromHook,
    isLoading: isConnectionLoading,
    error: connectionError,
    conversationItems,
    isMicrophoneActive: isMicrophoneActiveFromHook,
    sessionId: hookSessionId,
    conversationId: hookConversationId,
    connectConversation,
    disconnectConversation,
  } = useRealtimeConnection({
    relayServerUrl: RELAY_SERVER_URL,
    instructions: assistantData?.instructions || '',
    updateTokenUsage: updateTokenUsageCallback,
    wavStreamPlayerRef,
    config,
    assistantId,
  });

  // Rest of the component remains the same...
  useEffect(() => {
    setIsConnected(isConnectedFromHook);
  }, [isConnectedFromHook]);

  useEffect(() => {
    setIsMicrophoneActive(isMicrophoneActiveFromHook);
  }, [isMicrophoneActiveFromHook]);

  useEffect(() => {
    if (hookSessionId !== sessionId) {
      setSessionId(hookSessionId);
    }
    if (hookConversationId !== conversationId) {
      setConversationId(hookConversationId);
    }
  }, [hookSessionId, hookConversationId, sessionId, conversationId]);

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
      wavStreamPlayer.removeEventListener(
        'playbackStarted',
        handlePlaybackStarted
      );
      wavStreamPlayer.removeEventListener('playbackEnded', handlePlaybackEnded);
    };
  }, [isConnected]);

  const handleConnect = () => {
    if (!assistantData?.instructions) {
      console.error('Assistant instructions not loaded yet');
      return;
    }
    connectConversation();
  };

  const handleDisconnect = () => {
    disconnectConversation();
  };

  const renderAvatar = () => {
    const imageSrc =
      isAssistantSpeaking && !isMicrophoneActive
        ? assistantData?.talkingGifUrl || '/static/yubotot.gif'
        : assistantData?.waitingGifUrl || '/static/yuboto.gif';
    return (
      <div className="relative w-64 h-64 mx-auto mb-4">
        <Image
          src={imageSrc}
          alt="Avatar"
          width={256}
          height={256}
          objectFit="cover"
          className="rounded-full"
        />
      </div>
    );
  };

  const renderConversationItem = (item: any) => {
    const speaker = item.role === 'user' ? 'You' : 'Assistant';
    let content = '';

    if (item.type === 'function_call_output') {
      content = item.formatted?.output || '';
    } else if (item.formatted?.tool) {
      content = `${item.formatted.tool.name}(${item.formatted.tool.arguments})`;
    } else if (item.role === 'user') {
      content =
        item.formatted?.transcript ||
        item.formatted?.text ||
        (item.formatted?.audio?.length ? '(transcribing...)' : '');
    } else if (item.role === 'assistant') {
      content =
        item.formatted?.text ||
        item.formatted?.transcript ||
        (item.status === 'interrupted' ? '(interrupted)' : '');
    }

    if (!content && item.status === 'completed') {
      return null;
    }

    if (item.status === 'completed' && content === '(processing...)') {
      return null;
    }

    return (
      <div key={item.id} className="mb-4 p-4 rounded-lg bg-white shadow-sm">
        <div className="flex items-start space-x-2">
          <span className="font-semibold text-gray-700 min-w-[80px]">
            {speaker}:
          </span>
          <span className="text-gray-800 flex-1">
            {content || (item.status === 'pending' ? '(processing...)' : '')}
          </span>
        </div>
        {item.formatted?.file && (
          <div className="mt-2 pl-[80px]">
            <audio src={item.formatted.file.url} controls className="w-full" />
          </div>
        )}
        {item.status === 'interrupted' && (
          <div className="mt-1 pl-[80px] text-sm text-gray-500 italic">
            (Message was interrupted)
          </div>
        )}
      </div>
    );
  };

  const renderEmbedCode = () => {
    if (typeof window === 'undefined') return null;

    const embedCode = `<script src="https://${window.location.host}/embed.js"></script>
<script>
  initAssistant({
    workspaceId: "${assistantData.workspaceId}",
    assistantName: "${assistantData.name}",
    baseUrl: "https://${window.location.host}"
  });
</script>`;
    return (
      <div className="mt-8 px-4">
        <h2 className="text-2xl font-semibold mb-2">
          Embed Assistant into Your Website
        </h2>
        <p className="mb-4">
          Copy and paste the following code into the header of your website:
        </p>
        <pre className="bg-gray-100 p-4 rounded overflow-x-auto">
          <code>{embedCode}</code>
        </pre>
      </div>
    );
  };

  if (isConnectionLoading) {
    return <div>Loading assistant...</div>;
  }

  if (connectionError) {
    return <div>Error: {connectionError}</div>;
  }

  return (
    <>
      <div className="max-w-3xl mx-auto p-4">
        <h1 className="text-center text-3xl font-bold mb-4">
          {assistantData.name || 'Assistant'}
        </h1>
        {renderAvatar()}
        <div className="flex justify-center mb-4">
          <button
            onClick={isConnected ? handleDisconnect : handleConnect}
            className={`px-4 py-2 rounded ${
              isConnected
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-green-500 hover:bg-green-600'
            } text-white`}
          >
            {isConnected ? 'Disconnect' : 'Connect'}
          </button>
        </div>
        <AudioVisualization
          isConnected={isConnected}
          clientCanvasRef={clientCanvasRef}
          serverCanvasRef={serverCanvasRef}
          isUserSpeaking={isMicrophoneActive}
          isAssistantSpeaking={isAssistantSpeaking}
        />

        <div className="mt-6 space-y-4 max-h-[400px] overflow-y-auto p-4 bg-gray-50 rounded-lg">
          {conversationItems.length === 0 ? (
            <div className="text-center text-gray-500">
              {isConnected
                ? 'Start speaking to begin the conversation'
                : 'Connect to start chatting'}
            </div>
          ) : (
            conversationItems.map(renderConversationItem)
          )}
        </div>

        {renderEmbedCode()}
      </div>
    </>
  );
};

export default DefaultAssistantPage;
