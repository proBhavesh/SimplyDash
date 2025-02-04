import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Separator } from "./ui/separator";

interface TokenUsageStatsProps {
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
  sessionTotalTokens: number;
}

const TokenUsageStats: React.FC<TokenUsageStatsProps> = ({
  totalTokens,
  inputTokens,
  outputTokens,
  sessionTotalTokens,
}) => {
  const calculatePrice = (tokens: number, type: 'input' | 'output', modality: 'text' | 'audio') => {
    const rates = {
      input: { text: 0.000005, audio: 0.0001 },
      output: { text: 0.00002, audio: 0.0002 },
    };
    return (tokens * rates[type][modality]).toFixed(6);
  };

  const totalPrice = (
    parseFloat(calculatePrice(inputTokens.text, 'input', 'text')) +
    parseFloat(calculatePrice(inputTokens.audio, 'input', 'audio')) +
    parseFloat(calculatePrice(outputTokens.text, 'output', 'text')) +
    parseFloat(calculatePrice(outputTokens.audio, 'output', 'audio'))
  ).toFixed(6);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Token Usage Stats</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between">
            <span className="text-sm font-medium">Total Tokens:</span>
            <span className="text-sm">{totalTokens}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-medium">Session Total Tokens:</span>
            <span className="text-sm">{sessionTotalTokens}</span>
          </div>
          <Separator />
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Input Tokens:</span>
              <span className="text-sm">{inputTokens.total}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Cached: {inputTokens.cached}</div>
              <div>Text: {inputTokens.text} (${calculatePrice(inputTokens.text, 'input', 'text')})</div>
              <div>Audio: {inputTokens.audio} (${calculatePrice(inputTokens.audio, 'input', 'audio')})</div>
            </div>
          </div>
          <Separator />
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Output Tokens:</span>
              <span className="text-sm">{outputTokens.total}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Text: {outputTokens.text} (${calculatePrice(outputTokens.text, 'output', 'text')})</div>
              <div>Audio: {outputTokens.audio} (${calculatePrice(outputTokens.audio, 'output', 'audio')})</div>
            </div>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-sm font-medium">Total Price:</span>
            <span className="text-sm font-semibold">${totalPrice}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TokenUsageStats;