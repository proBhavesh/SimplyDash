// src/types/openai-assistant-types.ts

export interface TrainingFile {
  id: string;
  name: string;
  size: number;
  // Add other properties as needed
}

export interface CallTypeData {
  calls: number;
  minutes: number;
}

export interface CallTypeBreakdown {
  [type: string]: CallTypeData;
}

export interface AnalyticsData {
  totalMinutes: number;
  totalCalls: number;
  totalTokens: number;
  costPerMinute: number;
  callTypeBreakdown?: CallTypeBreakdown;
}

export interface AnalyticsBoxProps {
  analyticsData: AnalyticsData;
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  onDateRangeChange: (newDateRange: { startDate: Date; endDate: Date }) => void;
}

export interface OpenAIAssistantDetailProps {
  assistant: any;
  editedAssistant: any;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  setEditedAssistant: React.Dispatch<React.SetStateAction<any>>;
}
