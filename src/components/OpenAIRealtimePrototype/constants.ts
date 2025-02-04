// src/components/OpenAIRealtimePrototype/constants.ts

export const MAX_CONVERSATION_ITEMS = 20;
export const MAX_REALTIME_EVENTS = 20;
export const MAX_CONVERSATION_HISTORY = 20;
export const SESSION_DURATION = 300000; // 5 minutes - full reconnect instead of refresh
export const RECONNECT_BUFFER = 30000; // 30 seconds before session expires
export const CLEANUP_DELAY = 1000; // 1 second delay for cleanup
export const RECONNECT_RETRY_LIMIT = 3;
export const RECONNECT_RETRY_DELAY = 500; // 0.5 seconds between retries
