import type { Config, ConversationItem } from "../types";
import { performanceLogger, Components, log } from "./logger";

// Constants for event management
const EVENT_BATCH_SIZE = 25; // Reduced batch size for shorter sequences
const EVENT_RETENTION_TIME = 5000; // Keep events longer (5 seconds) to prevent premature cleanup
const CLEANUP_INTERVAL = 1000; // Less frequent cleanup to allow more events to accumulate
const MAX_AUDIO_EVENTS = 250; // Reduced limit for audio events
const MAX_TOTAL_EVENTS = 1000; // Reduced safety limit
const MIN_AUDIO_RETENTION = 2000; // Minimum time to keep audio events even if processed

// Track events with timestamps and metadata
interface TimestampedEvent {
  timestamp: number;
  event: any;
  type: string;
  processed: boolean;
  size: number;
  isAudioEvent: boolean;
  isFunctionCall: boolean;
}

// Event queue with automatic cleanup
class EventManager {
  private readonly MAX_EVENTS = 1000;
  private readonly CLEANUP_THRESHOLD = 800;
  private events: TimestampedEvent[] = [];
  private cleanupInterval: NodeJS.Timeout | undefined; // Changed from null to undefined

  constructor() {
    // Set up periodic cleanup
    this.cleanupInterval = setInterval(() => this.cleanup(), CLEANUP_INTERVAL);
    log("EventManager initialized", { component: Components.WEBSOCKET });
  }

  addEvent(type: string, event: any) {
    if (this.events.length >= this.MAX_EVENTS) {
      // Keep only recent events
      this.events = this.events
        .slice(-this.CLEANUP_THRESHOLD)
        .filter((e) => e.type === "function_call" || !e.processed);
    }
    // Determine event characteristics
    const isAudioEvent = type.includes("audio");
    const isFunctionCall =
      type.includes("function") || event?.item?.type === "function_call";
    const size = new TextEncoder().encode(JSON.stringify(event)).length;

    // Check limits before adding
    const audioEvents = this.events.filter((e) => e.isAudioEvent).length;
    if (isAudioEvent && audioEvents >= MAX_AUDIO_EVENTS) {
      this.cleanupOldestAudioEvents();
    }

    // Add new event with metadata
    this.events.push({
      timestamp: Date.now(),
      event,
      type,
      processed: false,
      size,
      isAudioEvent,
      isFunctionCall,
    });

    // Emergency cleanup if total events too high
    if (this.events.length > MAX_TOTAL_EVENTS) {
      this.emergencyCleanup();
    }

    // Log metrics about event accumulation
    const deltaEvents = this.events.filter((e) => e.type.includes("delta"));
    if (deltaEvents.length > EVENT_BATCH_SIZE * 0.8) {
      log(`High event accumulation: ${deltaEvents.length} delta events`, {
        component: Components.WEBSOCKET,
        type: "warn",
      });
      performanceLogger.logState(Components.WEBSOCKET, "eventAccumulation", {
        deltaEvents: deltaEvents.length,
        totalEvents: this.events.length,
        timestamp: Date.now(),
      });
    }

    return event;
  }

  private cleanupOldestAudioEvents() {
    const now = Date.now();
    const beforeCount = this.events.filter((e) => e.isAudioEvent).length;

    const audioEvents = this.events
      .filter((e) => e.isAudioEvent && e.processed)
      .sort((a, b) => a.timestamp - b.timestamp);

    // Remove oldest 20% of processed audio events that are older than MIN_AUDIO_RETENTION
    const removeCount = Math.ceil(audioEvents.length * 0.2);
    const idsToRemove = new Set(
      audioEvents.slice(0, removeCount).map((e) => e.event.event_id)
    );

    this.events = this.events.filter((e) => !idsToRemove.has(e.event.event_id));
    const afterCount = this.events.filter((e) => e.isAudioEvent).length;

    // Always log audio cleanup operations
    log(`Audio events cleanup:`, {
      component: Components.WEBSOCKET,
      type: "info",
      details: {
        removedCount: idsToRemove.size,
        beforeCount,
        afterCount,
        oldestRetained: this.events
          .filter((e) => e.isAudioEvent)
          .reduce((min, e) => Math.min(min, now - e.timestamp), 0),
      },
    });
  }

  private emergencyCleanup() {
    const beforeCount = this.events.length;
    const beforeStats = {
      functionCalls: this.events.filter((e) => e.isFunctionCall).length,
      audio: this.events.filter((e) => e.isAudioEvent).length,
      delta: this.events.filter((e) => e.type.includes("delta")).length,
    };

    // Keep all function call events
    const functionCallEvents = this.events.filter((e) => e.isFunctionCall);

    // Keep recent unprocessed events
    const now = Date.now();
    const recentEvents = this.events.filter(
      (e) =>
        !e.isFunctionCall &&
        (now - e.timestamp < EVENT_RETENTION_TIME || !e.processed)
    );

    // Sort by timestamp and keep most recent
    const sortedEvents = recentEvents.sort((a, b) => b.timestamp - a.timestamp);
    const eventsToKeep = sortedEvents.slice(
      0,
      MAX_TOTAL_EVENTS - functionCallEvents.length
    );

    this.events = [...functionCallEvents, ...eventsToKeep];

    const afterCount = this.events.length;
    const afterStats = {
      functionCalls: functionCallEvents.length,
      audio: this.events.filter((e) => e.isAudioEvent).length,
      delta: this.events.filter((e) => e.type.includes("delta")).length,
    };

    // Log emergency cleanup details
    log(`Emergency cleanup performed:`, {
      component: Components.WEBSOCKET,
      type: "warn",
      details: {
        removedCount: beforeCount - afterCount,
        beforeStats,
        afterStats,
        timestamp: now,
      },
    });
  }

  markProcessed(type: string, eventId: string) {
    const event = this.events.find(
      (e) => e.type === type && e.event.event_id === eventId
    );
    if (event) {
      event.processed = true;
    }
  }

  private cleanup() {
    const now = Date.now();
    const oldLength = this.events.length;

    // Always preserve function call related events
    const functionCallEvents = this.events.filter((e) => e.isFunctionCall);

    // Filter other events
    const otherEvents = this.events
      .filter((e) => !e.isFunctionCall)
      .filter((e) => {
        const age = now - e.timestamp;
        const isDeltaEvent = e.type.includes("delta");
        const isAudioEvent = e.isAudioEvent;

        // Keep if:
        return (
          // Recent and unprocessed
          (age < EVENT_RETENTION_TIME && !e.processed) ||
          // Non-delta events that are recent
          (!isDeltaEvent && age < EVENT_RETENTION_TIME) ||
          // Unprocessed events (regardless of age)
          !e.processed ||
          // Audio events that are still within MIN_AUDIO_RETENTION
          (isAudioEvent && age < MIN_AUDIO_RETENTION)
        );
      });

    // Combine preserved events
    this.events = [...functionCallEvents, ...otherEvents];

    const removed = oldLength - this.events.length;
    const audioEventsCount = this.events.filter((e) => e.isAudioEvent).length;
    const deltaEventsCount = this.events.filter((e) =>
      e.type.includes("delta")
    ).length;

    // Always log cleanup operations, even if nothing was removed
    log(`Cleanup operation completed:`, {
      component: Components.WEBSOCKET,
      type: "info",
      details: {
        removedEvents: removed,
        remainingEvents: this.events.length,
        audioEvents: audioEventsCount,
        deltaEvents: deltaEventsCount,
        functionCallEvents: functionCallEvents.length,
      },
    });

    performanceLogger.logState(Components.WEBSOCKET, "eventCleanup", {
      removedCount: removed,
      remainingCount: this.events.length,
      audioEvents: audioEventsCount,
      deltaEvents: deltaEventsCount,
      functionCallEvents: functionCallEvents.length,
      timestamp: now,
    });
  }

  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined; // Changed from null to undefined
    }
    log("EventManager stopped", { component: Components.WEBSOCKET });
  }

  getStats() {
    const now = Date.now();
    const stats = {
      totalEvents: this.events.length,
      deltaEvents: this.events.filter((e) => e.type.includes("delta")).length,
      processedEvents: this.events.filter((e) => e.processed).length,
      unprocessedEvents: this.events.filter((e) => !e.processed).length,
      oldestEvent: Math.min(...this.events.map((e) => e.timestamp)),
      newestEvent: Math.max(...this.events.map((e) => e.timestamp)),
      eventTypes: {} as Record<string, number>,
    };

    // Count events by type
    this.events.forEach((e) => {
      stats.eventTypes[e.type] = (stats.eventTypes[e.type] || 0) + 1;
    });

    return stats;
  }
}

// Singleton instance
let eventManagerInstance: EventManager | null = null;

// Create a single event manager instance
const eventManager = (() => {
  if (typeof window === "undefined") {
    // Return a mock instance for SSR/static generation
    return {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      addEvent: () => {},
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      markProcessed: () => {},
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      stop: () => {},
      getStats: () => ({}),
    };
  }

  if (!eventManagerInstance) {
    eventManagerInstance = new EventManager();
  }
  return eventManagerInstance;
})();

export const sendSessionUpdate = (
  ws: WebSocket,
  instructions: string,
  config: Config,
  addRealtimeEvent: (source: "client" | "server", event: string) => void
) => {
  try {
    performanceLogger.startTiming("sessionUpdate");
    log("Sending session update", { component: Components.WEBSOCKET });

    const sessionUpdateEvent = {
      type: "session.update",
      session: {
        modalities: ["audio", "text"],
        instructions: instructions,
        voice: config.voiceSettings,
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: {
          model: "whisper-1",
        },
        turn_detection: {
          type: "server_vad",
          threshold: config.threshold,
          prefix_padding_ms:
            config.prefixPaddingMs >= 300 ? config.prefixPaddingMs : 300, // Use user config if >= 300ms
          silence_duration_ms:
            config.silenceDurationMs >= 500 ? config.silenceDurationMs : 500, // Use user config if >= 500ms
        },
        tool_choice: "auto",
        temperature: config.temperature,
        tools: [
          {
            type: "function",
            name: "question_and_answer",
            description: "Get answers to customer questions",
            parameters: {
              type: "object",
              properties: {
                question: { type: "string" },
              },
              required: ["question"],
            },
          },
          {
            type: "function",
            name: "book_tow",
            description: "Book a service for a customer",
            parameters: {
              type: "object",
              properties: {
                address: { type: "string" },
              },
              required: ["address"],
            },
          },
          {
            type: "function",
            name: "jira_fetch_issues",
            description:
              "Fetch Jira issues with a specified priority level (P0, P1, P2, P3, etc.)",
            parameters: {
              type: "object",
              properties: {
                priority: {
                  type: "string",
                  description: "Priority level (e.g., P0, P1, P2, P3)",
                  pattern: "^P[0-9]$",
                },
              },
              required: ["priority"],
            },
          },
          {
            type: "function",
            name: "jira_get_issue_details",
            description: "Get detailed information about a specific Jira issue",
            parameters: {
              type: "object",
              properties: {
                issueKey: {
                  type: "string",
                  description: "The Jira issue key (e.g., QWER-1269)",
                  pattern: "^[A-Z]+-\\d+$",
                },
                showAcceptanceCriteria: {
                  type: "boolean",
                  description:
                    "Whether to show acceptance criteria in the response",
                },
              },
              required: ["issueKey"],
            },
          },
          {
            type: "function",
            name: "jira_update_issue",
            description:
              "Update a Jira issue with new details. Note: When updating description, provide the complete content including both user story and acceptance criteria.",
            parameters: {
              type: "object",
              properties: {
                issueKey: {
                  type: "string",
                  description: "The Jira issue key (e.g., QWER-1269)",
                  pattern: "^[A-Z]+-\\d+$",
                },
                description: {
                  type: "string",
                  description:
                    "The complete description including both user story and acceptance criteria. Format: [User Story]\n\nAcceptance Criteria:\n1. [Criteria 1]\n2. [Criteria 2]...",
                },
                summary: {
                  type: "string",
                  description: "The issue summary or title",
                },
                dueDate: {
                  type: "string",
                  description: "The due date in YYYY-MM-DD format",
                  pattern: "^\\d{4}-\\d{2}-\\d{2}$",
                },
                priority: {
                  type: "string",
                  description: "The priority level (P0, P1, P2, P3, etc.)",
                  pattern: "^P[0-9]$",
                },
              },
              required: ["issueKey"],
            },
          },
        ],
      },
    };

    // Track the event before sending
    const trackedEvent = eventManager.addEvent(
      "session.update",
      sessionUpdateEvent
    );

    const startTime = performance.now();
    ws.send(JSON.stringify(trackedEvent));
    performanceLogger.logMessageLatency(performance.now() - startTime);

    addRealtimeEvent("client", "session.update");
    performanceLogger.endTiming("sessionUpdate");

    // Log WebSocket state
    performanceLogger.logState(Components.WEBSOCKET, "socketState", {
      readyState: ws.readyState,
      bufferedAmount: ws.bufferedAmount,
      timestamp: Date.now(),
    });
  } catch (error) {
    log("Error sending session update", {
      component: Components.WEBSOCKET,
      type: "error",
    });
    performanceLogger.logState(
      Components.WEBSOCKET,
      "sessionUpdateError",
      error
    );
  }
};

export const sendInitialUserMessage = (
  ws: WebSocket,
  addRealtimeEvent: (source: "client" | "server", event: string) => void
) => {
  try {
    performanceLogger.startTiming("initialUserMessage");
    const userMessageEvent = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: "",
          },
        ],
      },
    };

    // Track the event before sending
    const trackedEvent = eventManager.addEvent(
      "conversation.item.create",
      userMessageEvent
    );

    const startTime = performance.now();
    ws.send(JSON.stringify(trackedEvent));
    performanceLogger.logMessageLatency(performance.now() - startTime);

    addRealtimeEvent("client", "conversation.item.create");
    performanceLogger.endTiming("initialUserMessage");
  } catch (error) {
    log("Error sending initial user message", {
      component: Components.WEBSOCKET,
      type: "error",
    });
    performanceLogger.logState(
      Components.WEBSOCKET,
      "initialMessageError",
      error
    );
  }
};

export const sendMessage = (
  ws: WebSocket,
  messageContent: string,
  addRealtimeEvent: (source: "client" | "server", event: string) => void
) => {
  try {
    performanceLogger.startTiming(`message-${Date.now()}`);
    const messageEvent = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "text",
            text: messageContent,
          },
        ],
      },
    };

    // Track the event before sending
    const trackedEvent = eventManager.addEvent(
      "conversation.item.create",
      messageEvent
    );

    const startTime = performance.now();
    ws.send(JSON.stringify(trackedEvent));
    performanceLogger.logMessageLatency(performance.now() - startTime);

    // Log message size and WebSocket state
    performanceLogger.logState(Components.WEBSOCKET, "messageSent", {
      size: JSON.stringify(messageEvent).length,
      bufferedAmount: ws.bufferedAmount,
      timestamp: Date.now(),
    });

    addRealtimeEvent("client", "conversation.item.create");
    performanceLogger.endTiming(`message-${Date.now()}`);
  } catch (error) {
    log("Error sending message", {
      component: Components.WEBSOCKET,
      type: "error",
    });
    performanceLogger.logState(Components.WEBSOCKET, "messageError", error);
  }
};

export const sendErrorResponse = (
  ws: WebSocket,
  addRealtimeEvent: (source: "client" | "server", event: string) => void
) => {
  try {
    performanceLogger.startTiming("errorResponse");
    const errorResponseEvent = {
      type: "response.create",
      response: {
        modalities: ["text", "audio"],
        instructions:
          "I apologize, but I am having trouble processing your request right now. Is there anything else I can help you with?",
      },
    };

    // Track the event before sending
    const trackedEvent = eventManager.addEvent(
      "response.create",
      errorResponseEvent
    );

    const startTime = performance.now();
    ws.send(JSON.stringify(trackedEvent));
    performanceLogger.logMessageLatency(performance.now() - startTime);

    addRealtimeEvent("client", "response.create.error");
    performanceLogger.endTiming("errorResponse");
  } catch (error) {
    log("Error sending error response", {
      component: Components.WEBSOCKET,
      type: "error",
    });
    performanceLogger.logState(
      Components.WEBSOCKET,
      "errorResponseError",
      error
    );
  }
};

export const sendFunctionCallOutput = (
  ws: WebSocket,
  callId: string,
  output: string,
  addRealtimeEvent: (source: "client" | "server", event: string) => void
) => {
  try {
    performanceLogger.startTiming(`functionCall-${callId}`);
    const functionOutputEvent = {
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: output,
      },
    };

    // Track the event before sending
    const trackedEvent = eventManager.addEvent(
      "conversation.item.create",
      functionOutputEvent
    );

    const startTime = performance.now();
    ws.send(JSON.stringify(trackedEvent));
    performanceLogger.logMessageLatency(performance.now() - startTime);

    addRealtimeEvent("client", "conversation.item.create.function_call_output");

    // Track and send the response create event
    const responseEvent = {
      type: "response.create",
      response: {
        modalities: ["text", "audio"],
        instructions: `Respond to the user's request based on this information: ${output}. Be concise and friendly.`,
      },
    };
    const trackedResponseEvent = eventManager.addEvent(
      "response.create",
      responseEvent
    );
    ws.send(JSON.stringify(trackedResponseEvent));

    addRealtimeEvent("client", "response.create");
    performanceLogger.endTiming(`functionCall-${callId}`);
  } catch (error) {
    log("Error sending function call output", {
      component: Components.WEBSOCKET,
      type: "error",
    });
    performanceLogger.logState(
      Components.WEBSOCKET,
      "functionCallError",
      error
    );
  }
};

export const cleanupWebSocket = (ws: WebSocket) => {
  // Get event stats before cleanup
  const stats = eventManager.getStats();

  performanceLogger.logState(Components.WEBSOCKET, "cleanup", {
    readyState: ws.readyState,
    bufferedAmount: ws.bufferedAmount,
    timestamp: Date.now(),
    eventStats: stats,
  });

  if (ws.readyState === WebSocket.OPEN) {
    ws.close();
  }

  // Stop event manager and cleanup
  eventManager.stop();
  performanceLogger.reset();
};
