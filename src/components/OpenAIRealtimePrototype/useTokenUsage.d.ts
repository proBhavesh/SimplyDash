export interface TokenUsage {
  totalTokens: number;
  inputTokens: {
    total: number;
    cached: number;
    text: number;
    audio: number;
  };
  outputTokens: {
    total: number;
    text: number;
    audio: number;
  };
  remainingRequests: number;
  requestLimit: number;
}

export interface UseTokenUsageResult {
  tokenUsage: TokenUsage;
  tokenUsageKey: number;
  handleRefreshTokenUsage: () => void;
  handleRefreshTokenUsageDisplay: () => void;
  updateTokenUsage: (usage: any, rateLimits: any[]) => void;
}

declare function useTokenUsage(
  isConnected: boolean,
  isAdmin: boolean,
  sessionId: string,
  conversationId: string
): UseTokenUsageResult;

export default useTokenUsage;