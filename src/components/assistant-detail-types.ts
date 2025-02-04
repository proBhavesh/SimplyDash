import { Assistant } from '../types/assistant';

export interface TrainingFile {
  id: string;
  name: string;
  size: number;
}

export interface Conversation {
  id: string;
  user: string;
  timestamp: string;
}

export interface AnalyticsData {
  totalMinutes: string;
  totalCalls: number;
  callTypeBreakdown: { [key: string]: { minutes: number, calls: number } };
  costPerMinute: number;
}

export const COST_PER_MINUTE = 0.45;

export interface AssistantDetailPageProps {
  assistantId: string;
}