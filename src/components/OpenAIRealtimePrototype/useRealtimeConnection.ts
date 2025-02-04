import { useState, useRef, useCallback, useEffect } from 'react';
import { WavRecorder, WavStreamPlayer } from '../../lib/wavtools';
import { getAuth } from 'firebase/auth';
import { v4 as uuidv4 } from 'uuid';
import type {
  ConversationItem,
  RealtimeEvent,
  RateLimit,
  UseRealtimeConnectionProps,
  UseRealtimeConnectionReturn,
} from './types';
import {
  startAudioRecording,
  stopAudioRecording,
  stopAudioPlayback,
  markTrackInterrupted
} from './utils/audio';
import {
  sendSessionUpdate,
  sendInitialUserMessage,
  sendMessage as sendWebSocketMessage,
} from './utils/websocket';
import { handleInternalServerEvent } from './utils/eventHandlers';
import { log, Components } from './utils/logger';
import { MemoryMonitor } from '../../utils/MemoryMonitor';

// Constants
const MAX_CONVERSATION_ITEMS = 20;
const MAX_REALTIME_EVENTS = 20;
const CLEANUP_DELAY = 1000;
const MEMORY_CHECK_INTERVAL = 5000;

type HandleInterruptionFunction = () => Promise<void>;

const useRealtimeConnection = ({
  relayServerUrl,
  instructions,
  updateTokenUsage,
  wavStreamPlayerRef,
  config,
  assistantId,
}: UseRealtimeConnectionProps): UseRealtimeConnectionReturn => {
  // State Management
  const [state, setState] = useState({
    isConnected: false,
    isLoading: false,
    error: null as string | null,
    isMicrophoneActive: false,
    isAssistantStreaming: false,
    sessionId: '',
    conversationId: '',
    userIdentifier: null as string | null,
    accessMethod: null as 'phone_number' | 'web' | null
  });

  const [conversationItems, setConversationItems] = useState<ConversationItem[]>([]);
  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);
  const [rateLimits, setRateLimits] = useState<RateLimit[]>([]);

  // Refs
  const refs = {
    wavRecorder: useRef<WavRecorder>(new WavRecorder({ sampleRate: 24000 })),
    ws: useRef<WebSocket | null>(null),
    currentResponseId: useRef<string | null>(null),
    currentItemId: useRef<string | null>(null),
    startTime: useRef<number>(Date.now()),
    sessionId: useRef<string>(''),
    conversationId: useRef<string>(''),
    threadId: useRef<string>(''),
    cleanupInProgress: useRef<boolean>(false),
    audioInitialized: useRef<boolean>(false),
    handleInterruption: useRef<HandleInterruptionFunction | null>(null),
    memoryMonitorUnsubscribe: useRef<(() => void) | null>(null),
    // Timing refs
    userSpeechStart: useRef<number | null>(null),
    userSpeechEnd: useRef<number | null>(null),
    assistantReplyStart: useRef<number | null>(null),
    assistantReplyEnd: useRef<number | null>(null),
    interruptionTime: useRef<number | null>(null)
  };

  // Helper Functions
  const formatTime = useCallback((timestamp: number) => {
    const delta = timestamp - refs.startTime.current;
    return `${String(Math.floor(delta / 1000)).padStart(2, '0')}.${String(delta % 1000).padStart(3, '0')}`;
  }, []);

  const addRealtimeEvent = useCallback((source: 'client' | 'server', event: string) => {
    setRealtimeEvents(prevEvents => {
      const newEvent: RealtimeEvent = {
        time: formatTime(Date.now()),
        source,
        event,
      };

      const lastEvent = prevEvents[prevEvents.length - 1];
      if (lastEvent?.event === event && lastEvent.source === source) {
        const updatedEvents = [...prevEvents.slice(0, -1), 
          { ...lastEvent, count: (lastEvent.count || 1) + 1 }
        ];
        return updatedEvents.length > MAX_REALTIME_EVENTS 
          ? updatedEvents.slice(-MAX_REALTIME_EVENTS) 
          : updatedEvents;
      }

      const updatedEvents = [...prevEvents, newEvent];
      return updatedEvents.length > MAX_REALTIME_EVENTS 
        ? updatedEvents.slice(-MAX_REALTIME_EVENTS) 
        : updatedEvents;
    });
  }, [formatTime]);

  const handleInterruption = useCallback(async () => {
    const ws = refs.ws.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    // Implement proper debouncing with state tracking
    const now = Date.now();
    if (refs.interruptionTime.current && now - refs.interruptionTime.current < 1000) {
      log('Interruption debounced', { 
        component: Components.WEBSOCKET,
        details: { timeSinceLastInterrupt: now - refs.interruptionTime.current }
      });
      return;
    }
    refs.interruptionTime.current = now;

    try {
      // 1. First cancel the response to stop generation
      if (refs.currentResponseId.current) {
        const cancelEvent = {
          type: 'response.cancel'
        };
        ws.send(JSON.stringify(cancelEvent));
        addRealtimeEvent('client', 'response.cancel');
        
        // Wait briefly for cancellation to be processed
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // 2. Then get current playback position and truncate if needed
      if (refs.currentItemId.current && wavStreamPlayerRef.current) {
        try {
          const status = wavStreamPlayerRef.current.getStatus();
          if (status?.isConnected) {
            const playbackOffset = await wavStreamPlayerRef.current.getPlaybackOffset();
            // Only truncate if we have a meaningful offset
            if (playbackOffset > 0 && playbackOffset < 200000) { // Avoid truncating if offset is too large
              log('Sending truncation', {
                component: Components.AUDIO,
                details: { 
                  itemId: refs.currentItemId.current,
                  playbackOffset 
                }
              });

              const truncateEvent = {
                type: 'conversation.item.truncate',
                item_id: refs.currentItemId.current,
                content_index: 0,
                audio_end_ms: Math.floor(playbackOffset)
              };
              ws.send(JSON.stringify(truncateEvent));
              addRealtimeEvent('client', 'conversation.item.truncate');
            }
          }
        } catch (error) {
          log('Error during truncation:', {
            component: Components.AUDIO,
            type: 'error',
            details: { error }
          });
        }
      }

      // 3. Finally clean up audio state
      if (wavStreamPlayerRef.current) {
        try {
          await wavStreamPlayerRef.current.flush();
        } catch (error) {
          log('Audio flush error:', {
            component: Components.AUDIO,
            type: 'warn',
            details: { error }
          });
          // Force reset on error
          await wavStreamPlayerRef.current.reset();
        }
      }

    } catch (error) {
      log('Interruption error:', {
        component: Components.AUDIO,
        type: 'error',
        details: { error }
      });
    } finally {
      // Always clean up refs and mark track as interrupted
      if (refs.currentItemId.current) {
        markTrackInterrupted(refs.currentItemId.current);
      }
      refs.currentResponseId.current = null;
      refs.currentItemId.current = null;
    }
  }, [addRealtimeEvent, wavStreamPlayerRef]);

  // Create a stable message handler reference
  const messageHandler = useCallback((event: MessageEvent) => {
    const data = JSON.parse(event.data);
    handleInternalServerEvent(
      data,
      addRealtimeEvent,
      wavStreamPlayerRef,
      refs.currentItemId,
      refs.currentResponseId,
      setConversationItems,
      (streaming: boolean) => setState(prev => ({ ...prev, isAssistantStreaming: streaming })),
      (active: boolean) => setState(prev => ({ ...prev, isMicrophoneActive: active })),
      setRateLimits,
      updateTokenUsage,
      rateLimits,
      state.sessionId,
      state.conversationId,
      refs.ws,
      refs.threadId,
      assistantId,
      state.userIdentifier,
      state.accessMethod,
      instructions,
      config,
      handleInterruption,
      () => {/* No conversation history needed */} // Empty function for addToConversationHistory
    );
  }, [
    addRealtimeEvent,
    wavStreamPlayerRef,
    setConversationItems,
    updateTokenUsage,
    rateLimits,
    state.sessionId,
    state.conversationId,
    state.userIdentifier,
    state.accessMethod,
    assistantId,
    instructions,
    config,
    handleInterruption
  ]);

  // Enhanced WebSocket cleanup
  const cleanupWebSocket = useCallback(() => {
    const ws = refs.ws.current;
    if (ws) {
      // Remove message handler and close connection
      if (ws.onmessage) {
        ws.onmessage = null;
      }
      ws.onerror = null;
      ws.onclose = null;
      ws.onopen = null;

      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      refs.ws.current = null;
    }

    // Clean up any AudioWorklet message handlers
    if (wavStreamPlayerRef.current) {
      const player = wavStreamPlayerRef.current as any;
      if (player.port?.onmessage) {
        player.port.onmessage = null;
      }
    }
  }, [wavStreamPlayerRef]);

  const handlePlaybackStarted = useCallback(() => {
    setState(prev => ({ ...prev, isAssistantStreaming: true }));
    refs.assistantReplyStart.current = Date.now();
    log('Assistant started replying', { component: Components.ASSISTANT });

    if (refs.userSpeechEnd.current) {
      const delta = refs.assistantReplyStart.current - refs.userSpeechEnd.current;
      log(`Response latency: ${delta}ms`, { component: Components.ASSISTANT });
    }
  }, []);

  const handlePlaybackEnded = useCallback(() => {
    setState(prev => ({ ...prev, isAssistantStreaming: false }));
    refs.assistantReplyEnd.current = Date.now();
    
    if (refs.assistantReplyStart.current) {
      const duration = refs.assistantReplyEnd.current - refs.assistantReplyStart.current;
      log(`Assistant reply duration: ${duration}ms`, { component: Components.ASSISTANT });
    }
  }, []);

  const setupMemoryMonitoring = useCallback(() => {
    const memoryMonitor = MemoryMonitor.getInstance();
    
    if (memoryMonitor.isMonitoring()) {
      return;
    }

    const unsubscribe = memoryMonitor.addListener((snapshot) => {
      const usedMemoryMB = snapshot.memory.usedJSHeapSize / (1024 * 1024);
      const trend = memoryMonitor.getMemoryTrend();

      if (trend.trend === 'increasing' && trend.averageGrowthMB > 5) {
        log(`High memory growth detected: ${trend.averageGrowthMB.toFixed(2)}MB/sample`, {
          component: Components.STREAM_PROCESSOR,
          type: 'warn'
        });
        addRealtimeEvent('client', `memory.high_growth.${Math.round(trend.averageGrowthMB)}mb`);
      }
    });

    refs.memoryMonitorUnsubscribe.current = unsubscribe;
    memoryMonitor.startMonitoring(MEMORY_CHECK_INTERVAL);
  }, [addRealtimeEvent]);

  useEffect(() => {
    refs.handleInterruption.current = handleInterruption;
  }, [handleInterruption]);

  const disconnectConversation = useCallback(async () => {
    if (refs.cleanupInProgress.current) {
      return;
    }

    refs.cleanupInProgress.current = true;
    try {
      await Promise.all([
        stopAudioRecording(refs.wavRecorder),
        stopAudioPlayback(wavStreamPlayerRef)
      ]);

      if (wavStreamPlayerRef.current) {
        wavStreamPlayerRef.current.removeEventListener('playbackStarted', handlePlaybackStarted);
        wavStreamPlayerRef.current.removeEventListener('playbackEnded', handlePlaybackEnded);
        // Clean up AudioWorklet message handler
        const player = wavStreamPlayerRef.current as any;
        if (player.port?.onmessage) {
          player.port.onmessage = null;
        }
      }

      cleanupWebSocket();

      if (refs.memoryMonitorUnsubscribe.current) {
        refs.memoryMonitorUnsubscribe.current();
        refs.memoryMonitorUnsubscribe.current = null;
      }
      MemoryMonitor.getInstance().stopMonitoring();

      setState(prev => ({
        ...prev,
        isConnected: false,
        isMicrophoneActive: false,
        sessionId: '',
        conversationId: '',
      }));
      setConversationItems([]);
      setRealtimeEvents([]);

      // Reset all refs except wavRecorder and cleanupInProgress
      Object.keys(refs).forEach(key => {
        if (key !== 'wavRecorder' && key !== 'cleanupInProgress') {
          (refs as any)[key].current = null;
        }
      });

      log('Disconnection completed', { component: Components.WEBSOCKET });
    } catch (error) {
      console.error('Error during disconnection:', error);
      log(`Disconnection error: ${error}`, {
        component: Components.WEBSOCKET,
        type: 'error',
        details: { error }
      });
    } finally {
      refs.cleanupInProgress.current = false;
    }
  }, [wavStreamPlayerRef, handlePlaybackStarted, handlePlaybackEnded, cleanupWebSocket]);

  const initializeAudio = useCallback(async () => {
    if (!wavStreamPlayerRef.current) {
      console.error('WavStreamPlayer not available');
      return;
    }

    try {
      // First disconnect if already connected
      await wavStreamPlayerRef.current.disconnect().catch(console.error);
      
      // Then initialize fresh
      refs.audioInitialized.current = false;
      await wavStreamPlayerRef.current.connect();
      
      // Verify connection was successful
      const status = wavStreamPlayerRef.current.getStatus();
      if (!status.isConnected || status.contextState !== 'running') {
        throw new Error('Audio initialization failed: ' + JSON.stringify(status));
      }
      
      if (!refs.audioInitialized.current) {
        // Add event listeners only if not already initialized
        wavStreamPlayerRef.current.addEventListener('playbackStarted', handlePlaybackStarted);
        wavStreamPlayerRef.current.addEventListener('playbackEnded', handlePlaybackEnded);
        refs.audioInitialized.current = true;
        log('Audio system initialized successfully', { 
          component: Components.AUDIO,
          details: {
            status,
            timestamp: Date.now()
          }
        });
      }
    } catch (error) {
      console.error('Error initializing audio system:', error);
      refs.audioInitialized.current = false;
      // Try to recover
      if (wavStreamPlayerRef.current) {
        await wavStreamPlayerRef.current.reset().catch(console.error);
      }
      throw error;
    }
  }, [wavStreamPlayerRef, handlePlaybackStarted, handlePlaybackEnded]);

  const connectConversation = useCallback(async () => {
    if (refs.cleanupInProgress.current) {
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    refs.startTime.current = Date.now();
    setRealtimeEvents([]);

    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;
    let retryCount = 0;

    const connectWithRetry = async (): Promise<WebSocket> => {
      try {
        await initializeAudio();

        const ws = new WebSocket(relayServerUrl);
        refs.ws.current = ws;

        return await new Promise<WebSocket>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('WebSocket connection timeout'));
          }, 30000);

          ws.onopen = () => {
            clearTimeout(timeout);
            setState(prev => ({ ...prev, isConnected: true }));
            addRealtimeEvent('client', 'connect');
            resolve(ws);
          };

          ws.onerror = error => {
            clearTimeout(timeout);
            reject(error);
          };

          ws.onclose = async (event) => {
            setState(prev => ({ ...prev, isConnected: false }));
            log('WebSocket connection closed', { 
              component: Components.WEBSOCKET,
              details: {
                code: event.code,
                reason: event.reason,
                wasClean: event.wasClean
              }
            });

            // Attempt reconnection if not a clean closure
            if (!event.wasClean && retryCount < MAX_RETRIES) {
              retryCount++;
              log(`Attempting reconnection ${retryCount}/${MAX_RETRIES}`, {
                component: Components.WEBSOCKET
              });
              await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
              try {
                const newWs = await connectWithRetry();
                refs.ws.current = newWs;
              } catch (error) {
                log('Reconnection failed', {
                  component: Components.WEBSOCKET,
                  type: 'error',
                  details: { error }
                });
              }
            }
          };
        });
      } catch (error) {
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          log(`Connection attempt ${retryCount} failed, retrying...`, {
            component: Components.WEBSOCKET,
            type: 'warn',
            details: { error }
          });
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          return connectWithRetry();
        }
        throw error;
      }
    };

    try {
      const ws = await connectWithRetry();

      await startAudioRecording(refs.wavRecorder, refs.ws, addRealtimeEvent);

      // Use the stable message handler
      ws.onmessage = messageHandler;

    } catch (error) {
      console.error('Failed to connect:', error);
      setState(prev => ({
        ...prev,
        error: `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isConnected: false
      }));
      cleanupWebSocket();
    } finally {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [
    relayServerUrl,
    addRealtimeEvent,
    initializeAudio,
    cleanupWebSocket,
    messageHandler,
  ]);

  useEffect(() => {
    return () => {
      disconnectConversation();
    };
  }, [disconnectConversation]);

  //Adjust the MemoryMonitor to start monitoring only when the assistant is actively interacting (e.g., when the microphone is active or when the assistant is speaking
  useEffect(() => {
    if (state.isAssistantStreaming || state.isMicrophoneActive) {
      setupMemoryMonitoring();
    } else if (refs.memoryMonitorUnsubscribe.current) {
      refs.memoryMonitorUnsubscribe.current();
      refs.memoryMonitorUnsubscribe.current = null;
      MemoryMonitor.getInstance().stopMonitoring();
    }
  }, [state.isAssistantStreaming, state.isMicrophoneActive]);

  useEffect(() => {
    if (conversationItems.length > MAX_CONVERSATION_ITEMS) {
      setConversationItems(prev => prev.slice(prev.length - MAX_CONVERSATION_ITEMS));
    }
  }, [conversationItems]);

  useEffect(() => {
    if (!state.isConnected || !wavStreamPlayerRef.current) return;

    const initAudio = async () => {
      try {
        if (refs.audioInitialized.current) {
          log('Audio already initialized, skipping', { component: Components.AUDIO });
          return;
        }

        // Wait a short moment for WebSocket to fully establish
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Try initialization up to 3 times
        for (let i = 0; i < 3; i++) {
          try {
            await initializeAudio();
            log('Audio initialization successful', { 
              component: Components.AUDIO,
              details: { attempt: i + 1 }
            });
            return;
          } catch (error) {
            log('Audio initialization attempt failed', {
              component: Components.AUDIO,
              type: 'warn',
              details: { 
                attempt: i + 1,
                error: error instanceof Error ? error.message : String(error)
              }
            });
            if (i < 2) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }
        throw new Error('Failed to initialize audio after 3 attempts');
      } catch (error) {
        console.error('Audio initialization failed completely:', error);
        setState(prev => ({
          ...prev,
          error: 'Failed to initialize audio system. Please refresh the page.'
        }));
      }
    };

    const initTimeout = setTimeout(initAudio, 100);

    return () => {
      clearTimeout(initTimeout);
      if (wavStreamPlayerRef.current) {
        const player = wavStreamPlayerRef.current;
        player.removeEventListener('playbackStarted', handlePlaybackStarted);
        player.removeEventListener('playbackEnded', handlePlaybackEnded);
        // Clean up AudioWorklet message handler
        const playerAny = player as any;
        if (playerAny.port?.onmessage) {
          playerAny.port.onmessage = null;
        }
        // Ensure disconnection
        player.disconnect().catch(console.error);
      }
    };
  }, [state.isConnected, initializeAudio, handlePlaybackStarted, handlePlaybackEnded, wavStreamPlayerRef, setState]);

  useEffect(() => {
    if (state.isMicrophoneActive) {
      if (!refs.userSpeechStart.current) {
        refs.userSpeechStart.current = Date.now();
        log('User started speaking', { component: Components.USER });
      }
    } else if (refs.userSpeechStart.current) {
      refs.userSpeechEnd.current = Date.now();
      const duration = refs.userSpeechEnd.current - refs.userSpeechStart.current;
      log(`User speech duration: ${duration}ms`, { component: Components.USER });
      refs.userSpeechStart.current = null;
    }
  }, [state.isMicrophoneActive]);

  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    
    if (user) {
      setState(prev => ({
        ...prev,
        userIdentifier: user.uid,
        accessMethod: 'web'
      }));
    } else {
      let tempUserId = localStorage.getItem('tempUserId');
      if (!tempUserId) {
        tempUserId = uuidv4();
        localStorage.setItem('tempUserId', tempUserId);
      }
      setState(prev => ({
        ...prev,
        userIdentifier: tempUserId,
        accessMethod: 'web'
      }));
    }
  }, []);

  const sendMessage = useCallback((messageContent: string) => {
    if (refs.ws.current?.readyState === WebSocket.OPEN) {
      sendWebSocketMessage(refs.ws.current, messageContent, addRealtimeEvent);
    }
  }, [addRealtimeEvent]);

  return {
    isConnected: state.isConnected,
    isLoading: state.isLoading,
    error: state.error,
    conversationItems,
    realtimeEvents,
    rateLimits,
    isMicrophoneActive: state.isMicrophoneActive,
    sessionId: state.sessionId,
    conversationId: state.conversationId,
    connectConversation,
    disconnectConversation,
    handleInterruption,
    isAssistantStreaming: state.isAssistantStreaming,
    setIsAssistantStreaming: (streaming: boolean) => 
      setState(prev => ({ ...prev, isAssistantStreaming: streaming })),
    sendMessage,
  };
};

export default useRealtimeConnection;
