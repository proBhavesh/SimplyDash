declare module '../../utils/vapiClient' {
  export function listAssistants(): Promise<any[]>;
  export function getAnalytics(): Promise<any[]>;
  export function deleteAssistant(assistantId: string): Promise<void>;
  // Add other functions as needed
}