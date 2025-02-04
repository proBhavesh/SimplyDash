// src/types/assistant-types.ts

export interface TrainingFile {
  id: string;
  name: string;
  size: number;
  // Add other properties as needed
}

export interface AssistantDetailProps {
  assistant: any;
  editedAssistant: any;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  setEditedAssistant: React.Dispatch<React.SetStateAction<any>>;
}

export interface AnalyticsData {
  totalMinutes: number;
  totalCalls: number;
  totalTokens: number;
  callTypeBreakdown?: any; // Adjust the type as necessary
  costPerMinute: number;
}
