export interface AssistantData {
  assistantId?: string;
  id?: string;
  name: string;
  instructions?: string;
  voiceSettings?: string;
  threshold?: number;
  prefix_padding_ms?: number;
  silence_duration_ms?: number;
  temperature?: number;
  talkingGifUrl?: string;
  waitingGifUrl?: string;
}

export interface ProcessStatus {
  total_stories: number;
  processed_stories: number;
  status: string;
  success_count: number;
  failure_count: number;
  total_time: number;
  start_time: number;
  message: string;
  note: string;
}

export interface Config {
  voiceSettings: string;
  threshold: number;
  prefixPaddingMs: number;
  silenceDurationMs: number;
  temperature: number;
}
