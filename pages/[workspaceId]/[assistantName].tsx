// pages/[workspaceId]/[assistantName].tsx

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, query, where, limit, getDocs } from 'firebase/firestore';
import Image from 'next/image';
import AudioVisualization from '../../src/components/OpenAIRealtimePrototype/AudioVisualization';
import useAudioVisualization from '../../src/components/OpenAIRealtimePrototype/useAudioVisualization';
import { WavRecorder, WavStreamPlayer } from '../../src/lib/wavtools/index';
import useRealtimeConnection from '../../src/components/OpenAIRealtimePrototype/useRealtimeConnection';
import { app } from '../../src/app/firebaseConfig';
import Head from 'next/head';

import VirtualBusinessAnalystPage from '../../src/components/VirtualBusinessAnalystPage';
import DefaultAssistantPage from '../../src/components/DefaultAssistantPage';
// Import other assistant components here
// import OtherTemplatePage from '../../src/components/OtherTemplatePage';

const templateComponents: { [key: string]: React.FC<any> } = {
  virtual_business_analyst: VirtualBusinessAnalystPage,
  default: DefaultAssistantPage,
  // Add other templates here
  // other_template: OtherTemplatePage,
};

interface Config {
  voiceSettings: string;
  threshold: number;
  prefixPaddingMs: number;
  silenceDurationMs: number;
  temperature: number;
}

interface RateLimit {
  name: string;
  limit: number;
  remaining: number;
  reset_seconds: number;
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

const PublicAssistantPage: React.FC = () => {
  const router = useRouter();
  const { workspaceId, assistantName } = router.query;

  const [assistantData, setAssistantData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
    error: audioVisualizationError,
  } = useAudioVisualization(isConnected, wavStreamPlayerRef);

  // Placeholder for updateTokenUsageCallback function
  const updateTokenUsageCallback = useCallback(
    (
      usage: Partial<TokenUsage> | null,
      rateLimits: RateLimit[],
      hookSessionId: string,
      hookConversationId: string
    ) => {
      // Implement the function or import it if already defined
    },
    []
  );

  useEffect(() => {
    const fetchAssistantData = async () => {
      try {
        const db = getFirestore(app);
        const assistantsRef = collection(db, 'openaiAssistants');
        const assistantsQuery = query(
          assistantsRef,
          where('workspaceId', '==', workspaceId),
          where('name', '==', assistantName),
          where('isPublished', '==', true),
          limit(1)
        );
        const querySnapshot = await getDocs(assistantsQuery);

        if (!querySnapshot.empty) {
          const assistantDoc = querySnapshot.docs[0];
          const data = assistantDoc.data();
          setAssistantData(data);
        } else {
          setError('Assistant not found');
        }
      } catch (err) {
        console.error('Error fetching assistant data:', err);
        setError('Error fetching assistant data');
      } finally {
        setLoading(false);
      }
    };

    if (workspaceId && assistantName) {
      fetchAssistantData();
    }
  }, [workspaceId, assistantName]);

  const assistantId = assistantData?.assistantId || assistantData?.id;

  // Prepare the config object with assistant's settings
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

  // RELAY_SERVER_URL without environment variable dependency
  const RELAY_SERVER_URL = `/api/realtime-relay?assistantId=${encodeURIComponent(
    assistantId
  )}`;

  const {
    isConnected: isConnectedFromHook,
    isLoading: isConnectionLoading,
    error: connectionError,
    conversationItems,
    realtimeEvents,
    rateLimits: connectionRateLimits,
    isMicrophoneActive: isMicrophoneActiveFromHook,
    sessionId: hookSessionId,
    conversationId: hookConversationId,
    connectConversation,
    disconnectConversation,
    handleInterruption,
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
      // Only show function output if it exists
      content = item.formatted?.output || '';
    } else if (item.formatted?.tool) {
      content = `${item.formatted.tool.name}(${item.formatted.tool.arguments})`;
    } else if (item.role === 'user') {
      // For user messages, prioritize transcript over text
      content =
        item.formatted?.transcript ||
        item.formatted?.text ||
        (item.formatted?.audio?.length ? '(transcribing...)' : '');
    } else if (item.role === 'assistant') {
      // For assistant messages, prioritize text over transcript
      content =
        item.formatted?.text ||
        item.formatted?.transcript ||
        (item.status === 'interrupted' ? '(interrupted)' : '');
    }

    // Don't render empty messages or processing messages without content
    if (!content && item.status === 'completed') {
      return null;
    }

    // Don't show processing indicator for completed messages
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
    const embedCode = `<script src="https://${window.location.host}/embed.js"></script>
<script>
  initAssistant({
    workspaceId: "${workspaceId}",
    assistantName: "${assistantName}",
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

  if (loading || isConnectionLoading) {
    return <div>Loading assistant...</div>;
  }

  if (error || connectionError) {
    return <div>Error: {error || connectionError}</div>;
  }

  // Determine which component to render based on the assistant's template
  const template = assistantData?.template || 'default';
  const TemplateComponent = templateComponents[template];

  if (TemplateComponent) {
    return <TemplateComponent assistantData={assistantData} />;
  }

  // Render the default assistant page if no specific template is found
  return <DefaultAssistantPage assistantData={assistantData} />;
};


export default PublicAssistantPage;
