// src/components/OpenAIAssistantDetailPage.tsx

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
} from 'firebase/firestore';
import { Toaster } from 'react-hot-toast';
import RealtimeEvents from './RealtimeEvents';
import AudioVisualization from './OpenAIRealtimePrototype/AudioVisualization';
import useRealtimeConnection from './OpenAIRealtimePrototype/useRealtimeConnection';
import useTokenUsage from './OpenAIRealtimePrototype/useTokenUsage';
import useAudioVisualization from './OpenAIRealtimePrototype/useAudioVisualization';
import toastUtils from '../utils/toast';
import Image from 'next/image';
import { WavRecorder, WavStreamPlayer } from '../lib/wavtools/index';
import { app } from '../app/firebaseConfig';
import { Header } from './Header';
import OpenAIAssistantDetails from './OpenAIAssistantDetails';
import AnalyticsBox from './AnalyticsBox';
import OpenAIGifUpload from './OpenAIGifUpload';
import TrainingContent from './TrainingContent';
import { format } from 'date-fns';
import { TrainingFile, AnalyticsData } from '../types/openai-assistant-types';
import { COST_PER_MINUTE } from '../constants/assistant-constants';
import { useRouter } from 'next/router';

const ADMIN_USER_EMAIL = 'vincent@getinference.com';

// Constants for conversion and cost calculation
const TOKENS_PER_MINUTE = 350; // 350 tokens = 1 minute

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

interface OpenAIAssistantDetailPageProps {
  assistantId: string;
}

interface Config {
  voiceSettings: string;
  threshold: number;
  prefixPaddingMs: number;
  silenceDurationMs: number;
  temperature: number;
}

const OpenAIAssistantDetailPage: React.FC<OpenAIAssistantDetailPageProps> = ({
  assistantId,
}) => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [showFullScreenImage, setShowFullScreenImage] = useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [conversationId, setConversationId] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isMicrophoneActive, setIsMicrophoneActive] = useState<boolean>(false);
  const [assistantInstructions, setAssistantInstructions] = useState<string>('');
  const [assistantName, setAssistantName] = useState<string>('Assistant');
  const [totalTokensUsed, setTotalTokensUsed] = useState<number>(0);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [assistantData, setAssistantData] = useState<any>(null);
  const [editedAssistant, setEditedAssistant] = useState<any>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [dateRange, setDateRange] = useState<{ startDate: Date; endDate: Date }>({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)),
    endDate: new Date(),
  });
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isUploadingGif, setIsUploadingGif] = useState<boolean>(false);
  const [isPublished, setIsPublished] = useState<boolean>(false);

  const [trainingFiles, setTrainingFiles] = useState<TrainingFile[]>([]);

  const wavRecorderRef = useRef<WavRecorder>(new WavRecorder({ sampleRate: 24000 }));
  const wavStreamPlayerRef = useRef<WavStreamPlayer>(
    new WavStreamPlayer({ sampleRate: 24000 })
  );

  const {
    tokenUsage,
    updateTokenUsage,
    error: tokenUsageError,
  } = useTokenUsage(isConnected, isAdmin, sessionId, conversationId, assistantId);

  const updateTokenUsageCallback = useCallback(
    async (
      usage: Partial<TokenUsage> | null,
      rateLimits: RateLimit[],
      hookSessionId: string,
      hookConversationId: string
    ) => {
      updateTokenUsage(usage, rateLimits || [], hookSessionId, hookConversationId);

      // Send token usage data to the backend
      if (usage) {
        try {
          const auth = getAuth();
          const currentUser = auth.currentUser;
          if (currentUser) {
            const token = await currentUser.getIdToken();

            await fetch('/api/log-token-usage', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                assistantId,
                sessionId: hookSessionId,
                conversationId: hookConversationId,
                tokenUsage: usage,
              }),
            });
          }
        } catch (error) {
          console.error('Error logging token usage data:', error);
          toastUtils.error('Failed to log token usage data.');
        }
      }
    },
    [updateTokenUsage, assistantId]
  );

  // Prepare the config object with assistant's settings
  const config: Config = {
    voiceSettings: assistantData?.voiceSettings || 'alloy',
    threshold: assistantData?.threshold !== undefined ? assistantData?.threshold : 0.5,
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
    isLoading,
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
    instructions: assistantInstructions,
    updateTokenUsage: updateTokenUsageCallback,
    wavStreamPlayerRef,
    config,
    assistantId,
  });

  const {
    clientCanvasRef,
    serverCanvasRef,
    error: audioVisualizationError,
  } = useAudioVisualization(isConnected, wavStreamPlayerRef);

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
      updateTokenUsage(null, connectionRateLimits || [], sessionId, conversationId);
    }
  }, [
    isConnected,
    sessionId,
    conversationId,
    updateTokenUsage,
    connectionRateLimits,
  ]);

  useEffect(() => {
    if (isConnected) {
      wavRecorderRef.current.begin().catch((error) => {
        console.error('Error initializing WavRecorder:', error);
      });
      wavStreamPlayerRef.current.connect().catch((error) => {
        console.error('Error connecting WavStreamPlayer:', error);
      });
    } else {
      const recorderStatus = wavRecorderRef.current.getStatus();
      if (recorderStatus === 'recording' || recorderStatus === 'paused') {
        wavRecorderRef.current.end().catch((error) => {
          console.error('Error ending WavRecorder:', error);
        });
      }
      if (wavStreamPlayerRef.current.hasAudioData()) {
        wavStreamPlayerRef.current.disconnect().catch((error) => {
          console.error('Error disconnecting WavStreamPlayer:', error);
        });
      }
      setIsAssistantSpeaking(false);
    }
  }, [isConnected]);

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
  }, [isConnected, wavStreamPlayerRef.current]);

  // Clean up resources on component unmount
  useEffect(() => {
    return () => {
      if (isConnected) {
        disconnectConversation();
      }
      if (wavRecorderRef.current) {
        const recorderStatus = wavRecorderRef.current.getStatus();
        if (recorderStatus === 'recording' || recorderStatus === 'paused') {
          wavRecorderRef.current.end().catch((error) => {
            console.error('Error ending WavRecorder on unmount:', error);
          });
        }
      }
      if (wavStreamPlayerRef.current && wavStreamPlayerRef.current.hasAudioData()) {
        wavStreamPlayerRef.current.disconnect().catch((error) => {
          console.error('Error disconnecting WavStreamPlayer on unmount:', error);
        });
      }
    };
  }, [isConnected, disconnectConversation]);

  useEffect(() => {
    // Fetch assistant data from Firestore
    const fetchAssistantData = async () => {
      try {
        const db = getFirestore(app);
        const assistantDocRef = doc(db, 'openaiAssistants', assistantId);
        const assistantDoc = await getDoc(assistantDocRef);

        if (assistantDoc.exists()) {
          const data = assistantDoc.data();
          setAssistantData(data);
          setEditedAssistant(data); // Set edited assistant for editing
          setAssistantInstructions(data.instructions || '');
          setAssistantName(data.name || 'Assistant');
          setIsSubscribed(data.isSubscribed || false);
          setIsPublished(data.isPublished || false); // Fetch published status
        } else {
          console.error('Assistant not found');
          toastUtils.error('Assistant not found');
        }

        // Fetch total tokens used
        const tokenUsageRef = collection(db, 'tokenUsage');
        const q = query(tokenUsageRef, where('assistantId', '==', assistantId));
        const querySnapshot = await getDocs(q);

        let totalTokens = 0;
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          totalTokens += data.tokenUsage?.totalTokens || 0;
        });

        setTotalTokensUsed(totalTokens);

        // Fetch training files
        await fetchTrainingFiles();
      } catch (error) {
        console.error('Error fetching assistant data:', error);
        toastUtils.error('Error fetching assistant data');
      } finally {
        setLoading(false);
      }
    };

    fetchAssistantData();
  }, [assistantId]);

  const fetchTrainingFiles = async () => {
    // Implementation depends on how training files are stored for OpenAI assistants
    // This can be updated as per the actual implementation
  };

  useEffect(() => {
    if (assistantData) {
      fetchAnalyticsData();
    }
  }, [assistantData, dateRange]);

  const fetchAnalyticsData = async () => {
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      const token = await currentUser.getIdToken();

      const response = await fetch(
        `/api/get-token-usage?assistantId=${assistantId}&startDate=${encodeURIComponent(
          dateRange.startDate.toISOString()
        )}&endDate=${encodeURIComponent(dateRange.endDate.toISOString())}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();

        const totalMinutes = data.totalMinutes.toFixed(2);
        const totalTokens = data.totalTokens;
        const totalCost = (parseFloat(totalMinutes) * COST_PER_MINUTE).toFixed(2);

        setAnalyticsData({
          totalMinutes,
          totalTokens,
          totalCalls: data.totalCalls || 0,
          costPerMinute: COST_PER_MINUTE,
        });
      } else {
        console.error('Failed to fetch analytics data');
        toastUtils.error('Failed to fetch analytics data');
      }
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      toastUtils.error('Error fetching analytics data');
    }
  };

  const handleConnect = useCallback(() => {
    if (!assistantInstructions) {
      toastUtils.error('Assistant instructions not loaded yet');
      return;
    }
    connectConversation();
  }, [connectConversation, assistantInstructions]);

  const handleDisconnect = useCallback(() => {
    disconnectConversation();

    if (wavRecorderRef.current) {
      const recorderStatus = wavRecorderRef.current.getStatus();
      if (recorderStatus === 'recording' || recorderStatus === 'paused') {
        wavRecorderRef.current.end().catch((error) => {
          console.error('Error ending WavRecorder:', error);
        });
      }
    }
    if (wavStreamPlayerRef.current && wavStreamPlayerRef.current.hasAudioData()) {
      wavStreamPlayerRef.current.disconnect().catch((error) => {
        console.error('Error disconnecting WavStreamPlayer:', error);
      });
    }
    setIsAssistantSpeaking(false);
  }, [disconnectConversation]);

  const toggleDebugPanel = useCallback(() => setShowDebugPanel((prev) => !prev), []);

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

  const calculateMinutesFromTokens = (tokens: number): number => {
    return tokens / TOKENS_PER_MINUTE;
  };

  const calculateCostFromMinutes = (minutes: number): number => {
    return minutes * COST_PER_MINUTE;
  };

  const totalMinutesUsed = calculateMinutesFromTokens(totalTokensUsed);
  const totalCost = calculateCostFromMinutes(totalMinutesUsed);

  const handleDateRangeChange = (newDateRange: {
    startDate: Date;
    endDate: Date;
  }) => {
    setDateRange(newDateRange);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      const token = await currentUser.getIdToken();

      // Remove undefined fields from updateData
      const updateData: any = {
        name: editedAssistant!.name,
        instructions: editedAssistant!.instructions,
        voiceSettings: editedAssistant!.voiceSettings,
        threshold: editedAssistant!.threshold,
        prefix_padding_ms: editedAssistant!.prefix_padding_ms,
        silence_duration_ms: editedAssistant!.silence_duration_ms,
        temperature: editedAssistant!.temperature,
        apiKey: editedAssistant!.apiKey,
        updatedAt: new Date(),
        workspaceId: assistantData?.workspaceId, // Ensures workspaceId is preserved
      };

      // Only include waitingGifUrl if it's defined
      if (editedAssistant!.waitingGifUrl !== undefined) {
        updateData.waitingGifUrl = editedAssistant!.waitingGifUrl;
      }

      // Only include talkingGifUrl if it's defined
      if (editedAssistant!.talkingGifUrl !== undefined) {
        updateData.talkingGifUrl = editedAssistant!.talkingGifUrl;
      }

      const db = getFirestore(app);
      const assistantDocRef = doc(db, 'openaiAssistants', assistantId);

      await updateDoc(assistantDocRef, updateData);

      setAssistantData(editedAssistant);
      setIsEditing(false);
      toastUtils.success('Assistant updated successfully');
    } catch (error) {
      console.error('Error updating assistant:', error);
      toastUtils.error('Failed to update assistant.');
    }
  };

  const handleCancel = () => {
    setEditedAssistant(assistantData);
    setIsEditing(false);
  };

  const handleGifUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    gifType: 'waiting' | 'talking'
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      toastUtils.error('No file selected');
      return;
    }

    setIsUploadingGif(true); // Set loading state to true

    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      const token = await currentUser.getIdToken();

      const formData = new FormData();
      formData.append('assistantId', assistantId);
      formData.append('type', gifType);
      formData.append('file', file);

      const response = await fetch('/api/upload-gif', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        toastUtils.success('GIF uploaded successfully');

        // Update the assistantData with the new GIF URL
        setAssistantData((prevData: any) => ({
          ...prevData,
          [`${gifType}GifUrl`]: data.url,
        }));

        // Update the editedAssistant to include the new GIF URL
        setEditedAssistant((prevData: any) => ({
          ...prevData,
          [`${gifType}GifUrl`]: data.url,
        }));
      } else {
        const errorData = await response.json();
        console.error('Error uploading GIF:', errorData);
        toastUtils.error(errorData.message || 'Failed to upload GIF');
      }
    } catch (error) {
      console.error('Error uploading GIF:', error);
      toastUtils.error('Failed to upload GIF');
    } finally {
      setIsUploadingGif(false); // Set loading state back to false
    }
  };

  const handlePublish = async () => {
    if (!assistantData) return;

    if (!assistantData.isSubscribed && !assistantData.apiKey) {
      toastUtils.error(
        'Please add an OpenAI API key to your assistant or subscribe to enable publishing.'
      );
      return;
    }

    try {
      const db = getFirestore(app);
      const assistantDocRef = doc(db, 'openaiAssistants', assistantId);

      await updateDoc(assistantDocRef, { isPublished: true });
      setIsPublished(true);
      toastUtils.success('Assistant published successfully.');
    } catch (error) {
      console.error('Error publishing assistant:', error);
      toastUtils.error('Failed to publish assistant.');
    }
  };

  const renderAvatar = () => {
    const imageSrc =
      isAssistantSpeaking && !isMicrophoneActive
        ? assistantData?.talkingGifUrl || '/static/yubotot.gif'
        : assistantData?.waitingGifUrl || '/static/yuboto.gif';
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

  const publishButtonDisabled =
    !assistantData?.isSubscribed && !assistantData?.apiKey;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
          <p className="mt-4 text-xl font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  // Get the current host for baseUrl
  const currentHost =
    typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <>
      <Header />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {assistantData?.isSubscribed || assistantData?.apiKey ? (
          isPublished ? (
            <div
              className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4"
              role="alert"
            >
              <p className="font-bold">Your assistant is published!</p>
              <p>
                Public URL:{' '}
                <a
                  href={`/${assistantData.workspaceId}/${assistantData.name}`}
                  className="text-blue-500 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {currentHost}/{assistantData.workspaceId}/{assistantData.name}
                </a>
              </p>
              {/* Embed Code */}
              <div className="mt-4">
                <p className="font-bold">Embed Assistant into your Website:</p>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto">
                  {`<script src="${currentHost}/embed.js"></script>
<script>
  initAssistant({
    baseUrl: '${currentHost}',
    workspaceId: '${assistantData.workspaceId}',
    assistantName: '${assistantData.name}'
  });
</script>`}
                </pre>
              </div>
            </div>
          ) : (
            <button
              onClick={handlePublish}
              disabled={publishButtonDisabled}
              className={`mb-4 px-4 py-2 rounded ${
                publishButtonDisabled
                  ? 'bg-gray-500 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600'
              } text-white`}
            >
              Publish
            </button>
          )
        ) : (
          <div
            className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4"
            role="alert"
          >
            <p className="font-bold">Publish Feature Disabled</p>
            <p>
              Please add an OpenAI API key to your assistant or subscribe to enable
              publishing.
            </p>
          </div>
        )}

        <div className="flex flex-col md:flex-row space-y-6 md:space-y-0 md:space-x-6">
          {/* Avatar and Voice Frequencies Layout */}
          <div className="flex flex-col md:flex-row w-full md:w-2/3 space-y-4 md:space-y-0 md:space-x-4">
            {/* Avatar and Connect Button */}
            <div className="flex flex-col items-center w-full md:w-1/3">
              {renderAvatar()}
              <button
                onClick={isConnected ? handleDisconnect : handleConnect}
                disabled={isLoading || !user}
                className={`mt-4 px-4 py-2 rounded ${
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
                  className={`w-4 h-4 rounded-full mt-2 ${
                    isMicrophoneActive ? 'bg-green-500' : 'bg-gray-500'
                  }`}
                />
              )}
            </div>
            {/* Voice Frequencies */}
            <div className="w-full md:w-2/3">
              <AudioVisualization
                isConnected={isConnected}
                clientCanvasRef={clientCanvasRef}
                serverCanvasRef={serverCanvasRef}
                isUserSpeaking={isMicrophoneActive}
                isAssistantSpeaking={isAssistantSpeaking}
              />
            </div>
          </div>
        </div>

        {/* Analytics Section */}
        {analyticsData && (
          <AnalyticsBox
            analyticsData={analyticsData}
            dateRange={dateRange}
            onDateRangeChange={handleDateRangeChange}
          />
        )}

        {/* OpenAI Assistant Details Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* First Box (Editable): Name and Instructions */}
          <OpenAIAssistantDetails
            assistant={assistantData}
            editedAssistant={editedAssistant}
            isEditing={isEditing}
            onEdit={handleEdit}
            onSave={handleSave}
            onCancel={handleCancel}
            setEditedAssistant={setEditedAssistant}
            fieldsToShow={['name', 'instructions']}
          />

          {/* Second Box (Editable): Other Settings */}
          <OpenAIAssistantDetails
            assistant={assistantData}
            editedAssistant={editedAssistant}
            isEditing={isEditing}
            onEdit={handleEdit}
            onSave={handleSave}
            onCancel={handleCancel}
            setEditedAssistant={setEditedAssistant}
            fieldsToShow={[
              'voiceSettings',
              'threshold',
              'prefix_padding_ms',
              'silence_duration_ms',
              'temperature',
              'apiKey',
              'isSubscribed',
              'createdAt',
              'updatedAt',
            ]}
          />
        </div>

        {/* OpenAI GIF Upload Section */}
        <OpenAIGifUpload
          assistant={assistantData}
          onGifUpload={handleGifUpload}
          isUploadingGif={isUploadingGif} // Pass loading state as prop
        />

        {/* Training Content Section */}
        <TrainingContent
          assistantId={assistantId}
          trainingFiles={trainingFiles}
          onFileChange={fetchTrainingFiles}
        />
      </div>
    </>
  );

  // Rest of the component remains the same...
};

export default OpenAIAssistantDetailPage;
