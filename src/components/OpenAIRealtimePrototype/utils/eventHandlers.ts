import type {
  ConversationItem,
  TokenUsage,
  RateLimit,
  HistoryItem,
  MessageContent,
  AudioContent,
} from "../types";
import {
  handleAudioDelta,
  markTrackComplete,
  getIsAudioProcessing,
  setIsAudioProcessing,
} from "./audio";
import { saveMessageToFirestore, loadConversationHistory } from "./firestore";
import {
  sendSessionUpdate,
  sendInitialUserMessage,
  sendErrorResponse,
} from "./websocket";
import { processFunctionCallArguments } from "./functionCalls";
import { performanceLogger, Components, log } from "./logger";

// Constants for performance optimization
const MAX_AUDIO_CHUNKS = 30;
const AUDIO_CHUNK_CLEANUP_THRESHOLD = 15;
const RESPONSE_TIMEOUT = 2000;
const EVENT_PROCESSING_TIMEOUT = 2000;
const CLEANUP_INTERVAL = 250;

// Track audio chunks per item for playback management
let audioChunksMap = new WeakMap<{ id: string }, number>();
const keyMap = new Map<string, { id: string }>();

let cleanupIntervalId: NodeJS.Timeout | null = null;

const createItemKey = (itemId: string) => {
  let key = keyMap.get(itemId);
  if (!key) {
    key = { id: itemId };
    keyMap.set(itemId, key);
  }
  return key;
};

const cleanupKeyMap = (itemId: string) => {
  keyMap.delete(itemId);
};

const isAudioContent = (content: MessageContent): content is AudioContent => {
  return content.type === "audio" || content.type === "input_audio";
};

const getTranscriptFromContent = (content: MessageContent[]): string => {
  return content
    .map((c) => {
      if (isAudioContent(c)) return c.transcript || "";
      if (c.type === "text") return c.text;
      return "";
    })
    .filter(Boolean)
    .join(" ");
};

const cleanupAudioChunks = (itemId: string) => {
  const itemKey = keyMap.get(itemId);
  if (!itemKey) return false;

  const chunks = audioChunksMap.get(itemKey) || 0;
  let totalChunks = 0;
  keyMap.forEach((key) => {
    totalChunks += audioChunksMap.get(key) || 0;
  });

  const metrics = {
    itemId,
    chunks,
    totalChunks,
    totalItems: keyMap.size,
    timestamp: Date.now(),
  };

  if (chunks > AUDIO_CHUNK_CLEANUP_THRESHOLD) {
    audioChunksMap.delete(itemKey);
    cleanupKeyMap(itemId);

    // Log detailed cleanup metrics
    log("Audio chunks cleanup", {
      component: Components.AUDIO,
      type: "info",
      details: {
        ...metrics,
        action: "cleaned",
        remainingChunks: Array.from(keyMap.values()).reduce(
          (sum, key) => sum + (audioChunksMap.get(key) || 0),
          0
        ),
        remainingItems: keyMap.size,
      },
    });

    // Track cleanup in performance logger
    performanceLogger.logState(Components.AUDIO, "chunkCleanup", metrics);
    return true;
  }

  // Log skipped cleanup
  log("Audio chunks check", {
    component: Components.AUDIO,
    type: "info",
    details: {
      ...metrics,
      action: "skipped",
      reason: "below threshold",
    },
  });
  return false;
};

// MODIFIED: Only start cleanup if audio processing is active
const startPeriodicCleanup = () => {
  if (cleanupIntervalId || !getIsAudioProcessing()) return;

  cleanupIntervalId = setInterval(() => {
    // Stop cleanup if audio processing is no longer active
    if (!getIsAudioProcessing()) {
      stopPeriodicCleanup();
      return;
    }

    let totalChunks = 0;
    keyMap.forEach((key, itemId) => {
      const chunks = audioChunksMap.get(key) || 0;
      totalChunks += chunks;
      if (chunks > AUDIO_CHUNK_CLEANUP_THRESHOLD) {
        audioChunksMap.delete(key);
        cleanupKeyMap(itemId);
        log(`Periodic cleanup: removed chunks for item ${itemId}`, {
          component: Components.AUDIO,
          type: "info",
        });
      }
    });

    if (totalChunks > MAX_AUDIO_CHUNKS) {
      log(`Total chunks (${totalChunks}) exceeded limit, clearing all`, {
        component: Components.AUDIO,
        type: "warn",
      });
      audioChunksMap = new WeakMap();
      keyMap.clear();
    }
  }, CLEANUP_INTERVAL);
};

const stopPeriodicCleanup = () => {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
  setIsAudioProcessing(false);
  audioChunksMap = new WeakMap();
  keyMap.clear();
};

const createResponseTimeout = (
  itemId: string,
  currentItemIdRef: React.MutableRefObject<string | null>,
  currentResponseIdRef: React.MutableRefObject<string | null>,
  setConversationItems: React.Dispatch<React.SetStateAction<ConversationItem[]>>
) => {
  return setTimeout(() => {
    if (currentItemIdRef.current === itemId) {
      performanceLogger.logState(Components.WEBSOCKET, "responseTimeout", {
        itemId,
        timestamp: Date.now(),
      });

      setConversationItems((prevItems) =>
        prevItems.map((item) => {
          if (item.id === itemId) {
            return {
              ...item,
              status: "interrupted",
              formatted: {
                ...item.formatted,
                text:
                  (item.formatted?.text || "") +
                  " (Response interrupted due to timeout)",
              },
            };
          }
          return item;
        })
      );
      currentItemIdRef.current = null;
      currentResponseIdRef.current = null;

      // Clean up audio chunks and key
      const itemKey = keyMap.get(itemId);
      if (itemKey) {
        audioChunksMap.delete(itemKey);
        cleanupKeyMap(itemId);
      }
    }
  }, RESPONSE_TIMEOUT);
};

// Add these type declarations at the top with other imports
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface ExtendedPerformance extends Performance {
  memory?: PerformanceMemory;
}

declare const performance: ExtendedPerformance;

export const handleConversationItemCreated = async (
  item: any,
  setConversationItems: React.Dispatch<
    React.SetStateAction<ConversationItem[]>
  >,
  assistantId: string,
  conversationId: string,
  userIdentifier: string | null,
  accessMethod: "phone_number" | "web" | null
) => {
  if (!item || !item.id) {
    console.warn("Received invalid conversation item:", item);
    return;
  }

  try {
    console.log("Handling conversation item creation:", item);

    // Initialize audio chunks counter for new items
    const itemKey = createItemKey(item.id);
    if (!audioChunksMap.has(itemKey)) {
      audioChunksMap.set(itemKey, 0);
    }

    // Extract the actual content from the item
    let content: MessageContent[] = [];
    let textContent = "";

    if (item.content) {
      if (Array.isArray(item.content)) {
        content = item.content.map((c: any) => {
          if (c.type === "text") {
            textContent += c.text + " ";
            return { type: "text", text: c.text };
          }
          if (c.type === "input_audio" || c.type === "audio") {
            textContent += c.transcript + " ";
            return {
              type: c.type,
              transcript: c.transcript,
              audio: undefined, // Don't store audio data
            };
          }
          return { type: "text", text: "" };
        });
      } else {
        textContent = item.content;
        content = [{ type: "text", text: item.content }];
      }
    }

    const newItem: ConversationItem = {
      id: item.id,
      role: item.role || "system",
      type: item.type || "message",
      content: content,
      status: item.status || "pending",
      formatted: {
        text: textContent.trim(),
        transcript: textContent.trim(),
        audio: undefined, // Don't store audio data
        file: item.formatted?.file,
        tool: item.formatted?.tool,
        output: item.formatted?.output,
      },
    };

    setConversationItems((prevItems) => {
      const existingItemIndex = prevItems.findIndex((i) => i.id === item.id);

      if (existingItemIndex !== -1) {
        const updatedItems = [...prevItems];
        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          ...newItem,
          formatted: {
            ...updatedItems[existingItemIndex].formatted,
            ...newItem.formatted,
          },
        };
        return updatedItems;
      }

      return [...prevItems, newItem];
    });

    await saveMessageToFirestore(
      newItem,
      assistantId,
      conversationId,
      userIdentifier,
      accessMethod
    );
  } catch (error) {
    console.error("Error handling conversation item:", error);
    // Clean up on error
    const itemKey = keyMap.get(item.id);
    if (itemKey) {
      audioChunksMap.delete(itemKey);
      cleanupKeyMap(item.id);
    }
  }
};

export const handleInputAudioBufferCommitted = async (
  data: any,
  setConversationItems: React.Dispatch<
    React.SetStateAction<ConversationItem[]>
  >,
  addToConversationHistory: (historyItem: HistoryItem) => void,
  assistantId: string,
  conversationId: string,
  userIdentifier: string | null,
  accessMethod: "phone_number" | "web" | null
) => {
  if (!data.transcript) return;

  const itemId = `user-${Date.now()}`;

  try {
    const content: MessageContent[] = [
      {
        type: "input_audio",
        transcript: data.transcript,
        audio: undefined, // Don't store audio data
      },
    ];

    const newItem: ConversationItem = {
      id: itemId,
      role: "user",
      type: "message",
      content: content,
      status: "completed",
      formatted: {
        transcript: data.transcript,
        text: data.transcript,
        audio: undefined, // Don't store audio data
      },
    };

    setConversationItems((prevItems) => {
      const filteredItems = prevItems.filter(
        (item) => !(item.role === "user" && item.status === "pending")
      );
      return [...filteredItems, newItem];
    });

    addToConversationHistory({
      type: "audio",
      role: "user",
      content: data.transcript,
    });

    await saveMessageToFirestore(
      newItem,
      assistantId,
      conversationId,
      userIdentifier,
      accessMethod
    );
  } catch (error) {
    console.error("Error handling audio buffer commit:", error);
    // Clean up on error
    const itemKey = keyMap.get(itemId);
    if (itemKey) {
      audioChunksMap.delete(itemKey);
      cleanupKeyMap(itemId);
    }
  }
};

export const handleErrorEvent = (
  error: any,
  setConversationItems: React.Dispatch<
    React.SetStateAction<ConversationItem[]>
  >,
  currentItemIdRef: React.MutableRefObject<string | null>,
  currentResponseIdRef: React.MutableRefObject<string | null>
) => {
  console.error("Server error:", error);

  if (error.message?.includes("Item with item_id not found")) {
    const itemId = error.message.match(/item_id not found: (.+)/)?.[1];
    if (itemId) {
      setConversationItems((prevItems) => {
        const filteredItems = prevItems.filter((item) => item.id !== itemId);

        if (currentItemIdRef.current === itemId) {
          currentItemIdRef.current = null;
          currentResponseIdRef.current = null;
          const itemKey = keyMap.get(itemId);
          if (itemKey) {
            audioChunksMap.delete(itemKey);
            cleanupKeyMap(itemId);
          }
        }

        return filteredItems;
      });
      return;
    }
  }

  console.error("Server error:", error);
};

export const handleInternalServerEvent = async (
  data: any,
  addRealtimeEvent: (source: "client" | "server", event: string) => void,
  wavStreamPlayerRef: React.RefObject<any>,
  currentItemIdRef: React.MutableRefObject<string | null>,
  currentResponseIdRef: React.MutableRefObject<string | null>,
  setConversationItems: React.Dispatch<
    React.SetStateAction<ConversationItem[]>
  >,
  setIsAssistantStreaming: (value: boolean) => void,
  setIsMicrophoneActive: (value: boolean) => void,
  setRateLimits: React.Dispatch<React.SetStateAction<RateLimit[]>>,
  updateTokenUsage: (
    usage: Partial<TokenUsage> | null,
    rateLimits: RateLimit[],
    sessionId: string,
    conversationId: string
  ) => void,
  rateLimits: RateLimit[],
  sessionId: string,
  conversationId: string,
  wsRef: React.MutableRefObject<WebSocket | null>,
  threadIdRef: React.MutableRefObject<string>,
  assistantId: string,
  userIdentifier: string | null,
  accessMethod: "phone_number" | "web" | null,
  instructions: string,
  config: any,
  handleInterruption: () => Promise<void>,
  addToConversationHistory: (historyItem: HistoryItem) => void
) => {
  const monitorPerformance = () => {
    if (performance.memory) {
      const memoryUsage = performance.memory.usedJSHeapSize / 1024 / 1024;
      if (memoryUsage > 100) {
        // Alert if over 100MB
        log("High memory usage detected", {
          component: Components.WEBSOCKET,
          type: "warn",
          details: {
            memoryUsage: `${memoryUsage.toFixed(2)}MB`,
            audioChunks: keyMap.size,
            timestamp: Date.now(),
          },
        });
      }
    }
  };

  // Add periodic monitoring
  setInterval(monitorPerformance, 5000);

  const eventType = data.type;
  const eventId = `${eventType}-${Date.now()}`;
  const startTime = performance.now();

  // Start timing this event
  performanceLogger.startTiming(eventId);
  addRealtimeEvent("server", eventType);

  // MODIFIED: Only start cleanup for audio events
  if (
    eventType === "response.audio.delta" ||
    eventType === "input_audio_buffer.speech_started" ||
    eventType === "input_audio_buffer.committed"
  ) {
    setIsAudioProcessing(true);
    startPeriodicCleanup();
  }

  // Add WebSocket close handler for cleanup
  wsRef.current?.addEventListener("close", () => {
    if (currentItemIdRef.current) {
      const itemKey = keyMap.get(currentItemIdRef.current);
      if (itemKey) {
        audioChunksMap.delete(itemKey);
        cleanupKeyMap(currentItemIdRef.current);
      }
    }
    stopPeriodicCleanup();
  });

  // Log event receipt with detailed WebSocket state
  performanceLogger.logState(Components.WEBSOCKET, "eventReceived", {
    type: eventType,
    itemId: data.item_id,
    timestamp: Date.now(),
    wsState: {
      bufferedAmount: wsRef.current?.bufferedAmount || 0,
      readyState: wsRef.current?.readyState,
      audioChunksCount: keyMap.size,
    },
    sessionInfo: {
      sessionId,
      conversationId,
      assistantId,
    },
  });

  let responseTimeout: NodeJS.Timeout | null = null;
  const eventTimeout = setTimeout(() => {
    log(`Event processing timeout: ${eventType}`, {
      component: Components.WEBSOCKET,
      type: "warn",
    });
    performanceLogger.logState(Components.WEBSOCKET, "eventTimeout", {
      type: eventType,
      duration: EVENT_PROCESSING_TIMEOUT,
      wsState: {
        bufferedAmount: wsRef.current?.bufferedAmount || 0,
        readyState: wsRef.current?.readyState,
        audioChunksCount: keyMap.size,
      },
    });
  }, EVENT_PROCESSING_TIMEOUT);

  try {
    // Track event processing time
    const processingStartTime = performance.now();

    switch (eventType) {
      case "response.audio.delta": {
        if (data.delta) {
          // Track and manage audio chunks with better error handling
          if (currentItemIdRef.current) {
            const itemKey = createItemKey(currentItemIdRef.current);
            const chunks = (audioChunksMap.get(itemKey) || 0) + 1;
            audioChunksMap.set(itemKey, chunks);

            performanceLogger.logState(Components.AUDIO, "audioChunks", {
              itemId: currentItemIdRef.current,
              chunks,
              timestamp: Date.now(),
              deltaSize: data.delta.length,
              totalChunks: keyMap.size,
            });

            // Check audio context state before processing
            if (wavStreamPlayerRef.current) {
              const status = await wavStreamPlayerRef.current.getStatus();
              if (status.contextState === "suspended") {
                log("Attempting to resume suspended audio context", {
                  component: Components.AUDIO,
                });
                try {
                  await wavStreamPlayerRef.current.reset();
                } catch (error) {
                  log("Error resetting audio context:", {
                    component: Components.AUDIO,
                    type: "error",
                    details: { error },
                  });
                }
              }
            }

            // More gradual cleanup approach
            if (chunks > MAX_AUDIO_CHUNKS) {
              log(`High audio chunk count (${chunks}), performing cleanup`, {
                component: Components.AUDIO,
                type: "warn",
              });

              try {
                // Try flushing first
                if (wavStreamPlayerRef.current) {
                  await wavStreamPlayerRef.current.flush();
                }

                // Only interrupt if still having issues
                if (chunks > MAX_AUDIO_CHUNKS * 1.5) {
                  await handleInterruption();
                  return;
                }
              } catch (error) {
                log("Error during audio cleanup:", {
                  component: Components.AUDIO,
                  type: "error",
                  details: { error },
                });
              }
            }
          }

          const audioStartTime = performance.now();
          await handleAudioDelta(data, wavStreamPlayerRef, currentItemIdRef);
          const audioProcessingTime = performance.now() - audioStartTime;
          performanceLogger.logAudioLatency(audioProcessingTime);

          // Log detailed audio processing metrics
          if (audioProcessingTime > 100) {
            // 100ms threshold
            log(`Slow audio processing: ${audioProcessingTime.toFixed(2)}ms`, {
              component: Components.AUDIO,
              type: "warn",
            });
          }

          if (currentItemIdRef.current) {
            const updateStartTime = performance.now();
            setConversationItems((prevItems) =>
              prevItems.map((item) => {
                if (item.id === currentItemIdRef.current) {
                  const content = Array.isArray(item.content)
                    ? [...item.content]
                    : [];
                  const audioContentIndex = content.findIndex((c) =>
                    isAudioContent(c)
                  );

                  if (audioContentIndex >= 0) {
                    // Don't store audio data
                    const audioContent = content[
                      audioContentIndex
                    ] as AudioContent;
                    audioContent.audio = undefined;
                  } else {
                    content.push({
                      type: "audio",
                      transcript: "",
                      audio: undefined,
                    });
                  }

                  return {
                    ...item,
                    content,
                    formatted: {
                      ...item.formatted,
                      audio: undefined, // Don't store audio data
                    },
                  };
                }
                return item;
              })
            );
            const updateTime = performance.now() - updateStartTime;
            if (updateTime > 50) {
              // 50ms threshold
              log(`Slow conversation update: ${updateTime.toFixed(2)}ms`, {
                component: Components.WEBSOCKET,
                type: "warn",
              });
            }
          }
        }
        setIsAssistantStreaming(true);
        break;
      }

      case "response.audio.done": {
        setIsAssistantStreaming(false);
        if (currentItemIdRef.current) {
          markTrackComplete(currentItemIdRef.current);
          const itemKey = keyMap.get(currentItemIdRef.current);
          if (itemKey) {
            audioChunksMap.delete(itemKey);
            cleanupKeyMap(currentItemIdRef.current);
          }
        }
        // Stop audio processing
        setIsAudioProcessing(false);
        stopPeriodicCleanup();
        break;
      }

      case "response.audio_transcript.delta": {
        if (data.delta?.text && currentItemIdRef.current) {
          // Reset response timeout on new data
          if (responseTimeout) {
            clearTimeout(responseTimeout);
          }
          responseTimeout = createResponseTimeout(
            currentItemIdRef.current,
            currentItemIdRef,
            currentResponseIdRef,
            setConversationItems
          );

          setConversationItems((prevItems) =>
            prevItems.map((item) => {
              if (item.id === currentItemIdRef.current) {
                const content = Array.isArray(item.content)
                  ? [...item.content]
                  : [];
                const audioContentIndex = content.findIndex((c) =>
                  isAudioContent(c)
                );

                if (audioContentIndex >= 0) {
                  const audioContent = content[
                    audioContentIndex
                  ] as AudioContent;
                  audioContent.transcript =
                    (audioContent.transcript || "") + data.delta.text;
                } else {
                  content.push({
                    type: "audio",
                    transcript: data.delta.text,
                    audio: undefined,
                  });
                }

                const transcript = getTranscriptFromContent(content);

                return {
                  ...item,
                  content,
                  formatted: {
                    ...item.formatted,
                    text: (item.formatted?.text || "") + data.delta.text,
                    transcript,
                  },
                };
              }
              return item;
            })
          );
        }
        break;
      }

      case "response.audio_transcript.done": {
        if (responseTimeout) {
          clearTimeout(responseTimeout);
        }
        if (currentItemIdRef.current) {
          setConversationItems((prevItems) =>
            prevItems.map((item) => {
              if (item.id === currentItemIdRef.current) {
                return {
                  ...item,
                  status: "completed",
                };
              }
              return item;
            })
          );
          // Clean up audio chunks after completion
          const itemKey = keyMap.get(currentItemIdRef.current);
          if (itemKey) {
            audioChunksMap.delete(itemKey);
            cleanupKeyMap(currentItemIdRef.current);
          }
        }
        // Stop audio processing
        setIsAudioProcessing(false);
        stopPeriodicCleanup();
        break;
      }

      case "session.created": {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          sendSessionUpdate(
            wsRef.current,
            instructions,
            config,
            addRealtimeEvent
          );
          sendInitialUserMessage(wsRef.current, addRealtimeEvent);
        }
        break;
      }

      case "conversation.created": {
        await loadConversationHistory(assistantId, conversationId);
        break;
      }

      case "conversation.item.created": {
        await handleConversationItemCreated(
          data.item,
          setConversationItems,
          assistantId,
          conversationId,
          userIdentifier,
          accessMethod
        );
        break;
      }

      case "input_audio_buffer.speech_started": {
        setIsMicrophoneActive(true);
        addRealtimeEvent("server", "input_audio_buffer.speech_started");

        // Only send cancel if there's an active response
        if (
          currentResponseIdRef.current &&
          wsRef.current?.readyState === WebSocket.OPEN
        ) {
          const cancelEvent = {
            type: "response.cancel",
          };
          wsRef.current.send(JSON.stringify(cancelEvent));
          addRealtimeEvent("client", "response.cancel");
        }

        // Then handle audio cleanup
        if (wavStreamPlayerRef.current) {
          try {
            await Promise.race([
              wavStreamPlayerRef.current.flush(),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Flush timeout")), 1000)
              ),
            ]);
          } catch (error) {
            console.warn("Audio flush timeout:", error);
            // Force disconnect on timeout
            await wavStreamPlayerRef.current.disconnect().catch(console.error);
          }
        }

        // Finally handle the interruption
        try {
          await Promise.race([
            handleInterruption(),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Audio interruption timeout")),
                2000
              )
            ),
          ]);
        } catch (error) {
          console.warn("Audio interruption timed out:", error);
          // Force cleanup on timeout
          if (wavStreamPlayerRef.current) {
            await wavStreamPlayerRef.current.flush().catch(console.error);
            await wavStreamPlayerRef.current.reset().catch(console.error);
          }
        }
        break;
      }

      case "input_audio_buffer.speech_stopped": {
        setIsMicrophoneActive(false);
        addRealtimeEvent("server", "input_audio_buffer.speech_stopped");
        // Stop audio processing
        setIsAudioProcessing(false);
        stopPeriodicCleanup();
        break;
      }

      case "input_audio_buffer.committed": {
        await handleInputAudioBufferCommitted(
          data,
          setConversationItems,
          addToConversationHistory,
          assistantId,
          conversationId,
          userIdentifier,
          accessMethod
        );
        break;
      }

      case "input_audio_buffer.cleared": {
        console.log("Input audio buffer cleared");
        // Reset any local states related to input audio
        break;
      }

      case "response.created": {
        currentResponseIdRef.current = data.response.id;
        break;
      }

      case "rate_limits.updated": {
        setRateLimits(data.rate_limits);
        break;
      }

      case "error": {
        // Enhanced error handling with recovery attempts
        const isNetworkError = data.error?.type === "network_error";
        const isCancellationError = data.error?.message?.includes(
          "Cancellation failed"
        );
        const isAudioError = data.error?.type === "audio_error";

        log(`Handling error: ${data.error?.type}`, {
          component: Components.WEBSOCKET,
          type: "error",
          details: { error: data.error },
        });

        // Handle different error types
        if (isCancellationError) {
          log("Cancellation failed, forcing cleanup", {
            component: Components.WEBSOCKET,
            type: "warn",
            details: data.error,
          });

          // Force cleanup of current response
          if (currentItemIdRef.current) {
            setConversationItems((prevItems) =>
              prevItems.map((item) =>
                item.id === currentItemIdRef.current
                  ? { ...item, status: "interrupted" }
                  : item
              )
            );
          }

          // Reset state
          currentResponseIdRef.current = null;
          currentItemIdRef.current = null;
          setIsAudioProcessing(false);

          // Try to recover audio system
          if (wavStreamPlayerRef.current) {
            try {
              await wavStreamPlayerRef.current.reset();
              log("Audio system reset successful after cancellation failure", {
                component: Components.AUDIO,
              });
            } catch (error) {
              log("Failed to reset audio system", {
                component: Components.AUDIO,
                type: "error",
                details: { error },
              });
              // Force disconnect as last resort
              await wavStreamPlayerRef.current
                .disconnect()
                .catch(console.error);
            }
          }
        } else if (isNetworkError) {
          // For network errors, try to recover the connection
          handleErrorEvent(
            data.error,
            setConversationItems,
            currentItemIdRef,
            currentResponseIdRef
          );

          // Signal connection issues to parent components
          if (wsRef.current?.readyState !== WebSocket.OPEN) {
            addRealtimeEvent("server", "connection.error");
          }
        } else if (isAudioError) {
          // For audio errors, try to recover the audio system
          log("Attempting audio system recovery", {
            component: Components.AUDIO,
            type: "warn",
          });

          if (wavStreamPlayerRef.current) {
            try {
              await wavStreamPlayerRef.current.reset();
              await wavStreamPlayerRef.current.connect();
              log("Audio system recovered successfully", {
                component: Components.AUDIO,
              });
            } catch (error) {
              log("Audio system recovery failed", {
                component: Components.AUDIO,
                type: "error",
                details: { error },
              });
            }
          }
        } else {
          // Handle other errors normally
          handleErrorEvent(
            data.error,
            setConversationItems,
            currentItemIdRef,
            currentResponseIdRef
          );
        }

        // Always stop audio processing on error
        setIsAudioProcessing(false);
        stopPeriodicCleanup();
        break;
      }

      case "response.done": {
        const usage = data.response.usage;
        const newUsage: TokenUsage = {
          totalTokens: usage.total_tokens,
          inputTokens: {
            total: usage.input_tokens,
            cached: usage.input_token_details?.cached_tokens || 0,
            text: usage.input_token_details?.text_tokens || 0,
            audio: usage.input_token_details?.audio_tokens || 0,
          },
          outputTokens: {
            total: usage.output_tokens,
            text: usage.output_token_details?.text_tokens || 0,
            audio: usage.output_token_details?.audio_tokens || 0,
          },
          remainingRequests: 20000, // Default value
          requestLimit: 20000, // Default value
          sessionTotalTokens: usage.total_tokens, // Initialize with current total
        };
        updateTokenUsage(newUsage, rateLimits, sessionId, conversationId);
        currentResponseIdRef.current = null;
        break;
      }

      case "response.function_call_arguments.done": {
        await processFunctionCallArguments(
          data,
          threadIdRef,
          wsRef,
          addRealtimeEvent,
          assistantId,
          conversationId,
          userIdentifier,
          accessMethod
        );
        break;
      }

      default:
        break;
    }

    // Log processing time for monitoring
    const processingTime = performance.now() - processingStartTime;
    if (processingTime > 1000) {
      // 1 second threshold
      log(
        `High processing time for ${eventType}: ${processingTime.toFixed(2)}ms`,
        {
          component: Components.WEBSOCKET,
          type: "warn",
        }
      );

      performanceLogger.logState(Components.WEBSOCKET, "slowProcessing", {
        eventType,
        processingTime,
        audioChunksCount: keyMap.size,
        wsBufferedAmount: wsRef.current?.bufferedAmount || 0,
        wsReadyState: wsRef.current?.readyState,
        timestamp: Date.now(),
        sessionInfo: {
          sessionId,
          conversationId,
          assistantId,
        },
      });
    }

    performanceLogger.endTiming(eventId);
  } catch (error) {
    log(`Error handling server event: ${error}`, {
      component: Components.WEBSOCKET,
      type: "error",
    });
    performanceLogger.logState(Components.WEBSOCKET, "eventError", {
      type: eventType,
      error,
      wsState: {
        bufferedAmount: wsRef.current?.bufferedAmount || 0,
        readyState: wsRef.current?.readyState,
        audioChunksCount: keyMap.size,
      },
      timestamp: Date.now(),
    });
    if (responseTimeout) {
      clearTimeout(responseTimeout);
    }
    // Stop audio processing on error
    setIsAudioProcessing(false);
    stopPeriodicCleanup();
  } finally {
    clearTimeout(eventTimeout);
    // Clean up on close event
    if (eventType === "close") {
      stopPeriodicCleanup();
      audioChunksMap = new WeakMap();
      keyMap.clear();
    }
  }
};
