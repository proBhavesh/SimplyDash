// src/components/assistant-detail-page.tsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { auth } from '@/app/firebaseConfig'; // Corrected import path
import { useRouter } from 'next/router';
import { onAuthStateChanged } from 'firebase/auth';
import VapiChatInterface from './VapiChatInterface';
import {
  Assistant,
  TrainingFile,
  Conversation,
  AnalyticsData,
} from '../types/assistant'; // Updated import
import ErrorMessage from './ErrorMessage';
import { Header } from './Header';
import { handleError, ErrorResponse } from '../utils/errorHandler';
import toastUtils from '../utils/toast';
import ErrorBoundary from './ErrorBoundary';
import { errorLogger } from '../utils/errorLogger';
import { COST_PER_MINUTE } from '../constants/assistant-constants';
import AssistantDetails from './AssistantDetails';
import AnalyticsBox from './AnalyticsBox';
import GifUpload from './GifUpload';
import TrainingContent from './TrainingContent';
import ModelInformation from './ModelInformation';
import VoiceDetails from './VoiceDetails';
import TranscriberInformation from './TranscriberInformation';
import RecentConversations from './RecentConversations';

export function AssistantDetailPage({ assistantId }: { assistantId: string }) {
  const [assistant, setAssistant] = useState<Assistant | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedAssistant, setEditedAssistant] = useState<Assistant | null>(null);
  const [trainingFiles, setTrainingFiles] = useState<TrainingFile[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState<ErrorResponse | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    totalMinutes: assistant?.usage?.totalMinutes || 0, // Removed .toString() and changed fallback to 0
    totalCalls: assistant?.usage?.dailyData.length || 0,
    callTypeBreakdown: {},
    costPerMinute: COST_PER_MINUTE,
  });
  const [dateRange, setDateRange] = useState<{ startDate: Date; endDate: Date }>({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)),
    endDate: new Date(),
  });
  const [isUploadingGif, setIsUploadingGif] = useState<boolean>(false); // Added state for GIF upload
  const router = useRouter();
  const { session_id } = router.query;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const token = await user.getIdToken(true);
        if (session_id) {
          await verifySubscriptionSession(session_id as string, token);
        } else {
          await fetchAssistantDetails(token);
        }
      } else {
        setLoading(false);
        router.push('/login');
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [assistantId, session_id]);

  useEffect(() => {
    if (assistant && assistant.usage) {
      fetchAnalyticsData();
    }
  }, [assistant, dateRange]);

  const handleApiError = (error: any, context: string) => {
    const errorResponse = handleError(error);
    errorLogger.error(`Error in ${context}:`, errorResponse);
    setError(errorResponse);
    toastUtils.error(errorResponse.message);
  };

  const fetchAssistantDetails = async (token: string) => {
    try {
      const response = await axios.get(`/api/get-assistant?id=${assistantId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 10000,
      });
      const assistantData: Assistant = response.data;

      setAssistant(assistantData);
      setEditedAssistant(assistantData);

      if (assistantData.usage) {
        setAnalyticsData({
          totalMinutes: assistantData.usage.totalMinutes, // Removed .toString()
          totalCalls: assistantData.usage.dailyData.length,
          callTypeBreakdown: {},
          costPerMinute: COST_PER_MINUTE,
        });
      }

      await Promise.all([fetchTrainingFiles(token), fetchConversations(token)]);
    } catch (error) {
      handleApiError(error, 'fetchAssistantDetails');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalyticsData = async () => {
    if (!assistant || !assistant.usage) return;

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await axios.get(`/api/get-assistant-usage`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          assistantId,
          startDate: dateRange.startDate.toISOString(),
          endDate: dateRange.endDate.toISOString(),
        },
      });

      setAnalyticsData(response.data);
    } catch (error) {
      handleApiError(error, 'fetchAnalyticsData');
    }
  };

  const fetchTrainingFiles = async (token: string) => {
    try {
      const response = await axios.get(
        `/api/get-training-files?assistantId=${assistantId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setTrainingFiles(response.data);
    } catch (error) {
      handleApiError(error, 'fetchTrainingFiles');
    }
  };

  const fetchConversations = async (token: string) => {
    try {
      const response = await axios.get(
        `/api/get-conversations?assistantId=${assistantId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setConversations(response.data);
    } catch (error) {
      handleApiError(error, 'fetchConversations');
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Prepare the update data according to VAPI documentation
      const updateData: Partial<Assistant> = {
        name: editedAssistant?.name,
        firstMessage: editedAssistant?.firstMessage,
        waitingGifUrl: editedAssistant?.waitingGifUrl,
        talkingGifUrl: editedAssistant?.talkingGifUrl,
        model: editedAssistant?.model
          ? {
              ...editedAssistant.model,
              messages: [
                ...(editedAssistant.model.messages || []).filter(
                  (msg) => msg.role !== 'assistant'
                ),
                {
                  role: 'assistant',
                  content: editedAssistant.firstMessage || '',
                },
              ],
            }
          : undefined,
        voice: editedAssistant?.voice,
        transcriber: editedAssistant?.transcriber,
      };

      // Remove undefined fields
      Object.keys(updateData).forEach((key) => {
        if (updateData[key as keyof Partial<Assistant>] === undefined) {
          delete updateData[key as keyof Partial<Assistant>];
        }
      });

      console.log('Sending update data:', JSON.stringify(updateData, null, 2));

      const response = await axios.patch(
        `/api/update-assistant`,
        { id: assistantId, ...updateData },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('Update response:', JSON.stringify(response.data, null, 2));

      if (!response.data) {
        throw new Error('No data received from update-assistant API');
      }

      // Merge the updated data with the existing assistant data
      const updatedAssistant: Assistant = {
        ...assistant!,
        ...response.data,
        waitingGifUrl: editedAssistant?.waitingGifUrl || assistant?.waitingGifUrl,
        talkingGifUrl: editedAssistant?.talkingGifUrl || assistant?.talkingGifUrl,
        model: {
          ...assistant?.model,
          ...response.data.model,
          messages: response.data.model?.messages || assistant?.model?.messages,
        },
        isSubscribed: assistant?.isSubscribed ?? false,
      };

      console.log('Updated assistant:', JSON.stringify(updatedAssistant, null, 2));

      setAssistant(updatedAssistant);
      setEditedAssistant(updatedAssistant);
      setIsEditing(false);
      toastUtils.success('Assistant updated successfully');
    } catch (error) {
      console.error('Error in handleSave:', error);
      if (axios.isAxiosError(error)) {
        console.error('Axios error details:', {
          response: error.response?.data,
          status: error.response?.status,
          headers: error.response?.headers,
        });
      }
      handleApiError(error, 'handleSave');
    }
  };

  const handleCancel = () => {
    setEditedAssistant(assistant);
    setIsEditing(false);
  };

  const verifySubscriptionSession = async (
    sessionId: string,
    token: string
  ) => {
    try {
      const response = await fetch(
        `/api/verify-subscription?session_id=${sessionId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        console.log('Subscription verification response:', data);

        // Fetch the updated assistant details
        await fetchAssistantDetails(token);
        toastUtils.success('Subscription verified successfully');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to verify subscription');
      }
    } catch (error) {
      handleApiError(error, 'verifySubscriptionSession');
    } finally {
      setLoading(false);
    }
  };

  const handleGifUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    gifType: 'waiting' | 'talking'
  ) => {
    const file = event.target.files?.[0];
    if (!file || !assistant) return;

    setIsUploadingGif(true); // Set loading state to true

    const formData = new FormData();
    formData.append('file', file);
    formData.append('assistantId', assistantId);
    formData.append('type', gifType);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await axios.post('/api/upload-gif', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          // Removed 'Content-Type' header to let Axios set it automatically
        },
      });

      if (response.data.url) {
        const updatedAssistant: Assistant = {
          ...assistant,
          [gifType === 'waiting' ? 'waitingGifUrl' : 'talkingGifUrl']:
            response.data.url,
        };
        setAssistant(updatedAssistant);
        setEditedAssistant(updatedAssistant);
        toastUtils.success(
          `${gifType.charAt(0).toUpperCase() + gifType.slice(1)} GIF uploaded successfully`
        );
      }
    } catch (error) {
      handleApiError(error, 'handleGifUpload');
    } finally {
      setIsUploadingGif(false); // Set loading state back to false
    }
  };

  const handleDateRangeChange = (newDateRange: {
    startDate: Date;
    endDate: Date;
  }) => {
    setDateRange(newDateRange);
  };

  const handleFileChange = async () => {
    const token = await auth.currentUser?.getIdToken();
    if (token) {
      await fetchTrainingFiles(token);
    }
  };

  const renderContent = () => {
    if (loading || authLoading) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
            <p className="mt-4 text-xl font-semibold">Loading...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <ErrorMessage message={error.message} />
            <button
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              onClick={async () => {
                setError(null);
                setLoading(true);
                const token = await auth.currentUser?.getIdToken();
                if (token) {
                  await fetchAssistantDetails(token);
                } else {
                  handleApiError(
                    new Error('Failed to get authentication token'),
                    'retryFetch'
                  );
                  setLoading(false);
                }
              }}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    if (!assistant) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <p className="text-xl font-semibold">Assistant not found</p>
            <button
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              onClick={() => router.push('/dashboard')}
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow bg-gray-100">
          <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            {assistant.isSubscribed ? (
              <div
                className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4"
                role="alert"
              >
                <p className="font-bold">Thank you for subscribing!</p>
                <p>Your account manager will be in touch about your phone number.</p>
              </div>
            ) : (
              <div
                className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4"
                role="alert"
              >
                <p className="font-bold">Subscription Required</p>
                <p>
                  To publish your assistant and receive your phone number, please
                  subscribe.
                </p>
              </div>
            )}

            <div className="flex flex-col md:flex-row space-y-6 md:space-y-0 md:space-x-6">
              <div className="flex-grow space-y-6">
                <VapiChatInterface
                  assistantId={assistantId}
                  waitingGifUrl={assistant.waitingGifUrl || '/static/cloud.gif'}
                  talkingGifUrl={assistant.talkingGifUrl || '/static/cloudt.gif'}
                />
                {assistant.usage && (
                  <AnalyticsBox
                    analyticsData={analyticsData}
                    dateRange={dateRange}
                    onDateRangeChange={handleDateRangeChange}
                  />
                )}
                <AssistantDetails
                  assistant={assistant}
                  editedAssistant={editedAssistant}
                  isEditing={isEditing}
                  onEdit={handleEdit}
                  onSave={handleSave}
                  onCancel={handleCancel}
                  setEditedAssistant={setEditedAssistant}
                />
                <GifUpload
                  assistant={assistant}
                  onGifUpload={handleGifUpload}
                  isUploadingGif={isUploadingGif} // Pass loading state as prop
                />
                <TrainingContent
                  assistantId={assistantId}
                  trainingFiles={trainingFiles}
                  onFileChange={handleFileChange}
                />
                <ModelInformation model={assistant.model} />
                <VoiceDetails voice={assistant.voice} />
                <TranscriberInformation transcriber={assistant.transcriber} />
              </div>
              <div className="md:w-1/3">
                <RecentConversations conversations={conversations} />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  };

  return (
    <ErrorBoundary
      fallback={
        <ErrorMessage message="Something went wrong. Please try again later." />
      }
    >
      {renderContent()}
    </ErrorBoundary>
  );
}
