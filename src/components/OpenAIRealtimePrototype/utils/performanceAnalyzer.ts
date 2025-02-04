interface PerformanceMetrics {
  avgProcessingTime: number;
  maxProcessingTime: number;
  audioLatencyTrend: number[];
  messageLatencyTrend: number[];
  audioChunksAccumulation: number;
  wsBufferedAmount: number;
  eventQueueSize: number;
  timeToFirstResponse: number;
  interruptionCount: number;
  totalErrors: number;
}

interface PerformanceThresholds {
  processingTime: number;
  audioLatency: number;
  messageLatency: number;
  maxAudioChunks: number;
  maxBufferedAmount: number;
  maxQueueSize: number;
  responseTimeout: number;
}

const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  processingTime: 1000, // 1 second
  audioLatency: 200, // 200ms
  messageLatency: 2000, // 2 seconds
  maxAudioChunks: 100,
  maxBufferedAmount: 1024 * 1024, // 1MB
  maxQueueSize: 100,
  responseTimeout: 10000, // 10 seconds
};

/**
 * Analyzes performance logs and generates a condensed summary focusing on key patterns
 * and potential issues that could cause slowdown.
 */
export function generatePerformanceReport(logs: any[]): string {
  // Group logs into 1-minute intervals for trend analysis
  const intervals: { [key: string]: any[] } = {};
  const intervalSize = 60 * 1000; // 1 minute

  logs.forEach(log => {
    const interval = Math.floor(log.timestamp / intervalSize);
    if (!intervals[interval]) {
      intervals[interval] = [];
    }
    intervals[interval].push(log);
  });

  // Analyze trends over time
  const windows = Object.entries(intervals).map(([interval, logs]) => {
    const audioLogs = logs.filter(log => log.type === 'latency' && log.data.audioLatency);
    const messageLogs = logs.filter(log => log.type === 'latency' && log.data.messageLatency);
    const stateLogs = logs.filter(log => log.type === 'state');
    const errorLogs = logs.filter(log => log.type === 'error' || log.type === 'warning');

    const audioLatencies = audioLogs.map(log => log.data.audioLatency);
    const messageLatencies = messageLogs.map(log => log.data.messageLatency);
    const wsStates = stateLogs
      .filter(log => log.data.wsState)
      .map(log => log.data.wsState);
    
    return {
      minute: parseInt(interval),
      metrics: {
        avgAudioLatency: audioLatencies.length ? 
          audioLatencies.reduce((a, b) => a + b, 0) / audioLatencies.length : 0,
        avgMessageLatency: messageLatencies.length ?
          messageLatencies.reduce((a, b) => a + b, 0) / messageLatencies.length : 0,
        maxBufferedAmount: Math.max(...wsStates.map(s => s.bufferedAmount || 0)),
        audioChunksCount: Math.max(...wsStates.map(s => s.audioChunksCount || 0)),
        errorCount: errorLogs.length
      }
    };
  });

  // Identify concerning patterns
  const patterns = {
    increasingLatency: false,
    audioChunkAccumulation: false,
    bufferGrowth: false,
    highErrorRate: false
  };

  // Check for increasing latency trend
  if (windows.length >= 3) {
    const recentWindows = windows.slice(-3);
    patterns.increasingLatency = recentWindows.every((window, i) => 
      i === 0 || window.metrics.avgMessageLatency > recentWindows[i-1].metrics.avgMessageLatency
    );
  }

  // Check for audio chunk accumulation
  patterns.audioChunkAccumulation = windows.some(window => 
    window.metrics.audioChunksCount > DEFAULT_THRESHOLDS.maxAudioChunks * 0.8
  );

  // Check for WebSocket buffer growth
  patterns.bufferGrowth = windows.some(window =>
    window.metrics.maxBufferedAmount > DEFAULT_THRESHOLDS.maxBufferedAmount * 0.8
  );

  // Check for high error rate
  patterns.highErrorRate = windows.some(window =>
    window.metrics.errorCount > 5 // More than 5 errors per minute
  );

  // Generate report
  const report = `Performance Analysis (${new Date().toISOString()})
Total Duration: ${((windows[windows.length - 1]?.minute - windows[0]?.minute) * 60).toFixed(1)} seconds
Samples Analyzed: ${logs.length}

Resource Accumulation:
${windows.map((w, i) => `
Window ${i} (${w.minute * 60}s):
- Audio Chunks: ${w.metrics.audioChunksCount}
- WS Buffer: ${(w.metrics.maxBufferedAmount / 1024).toFixed(2)}KB
- Avg Message Latency: ${w.metrics.avgMessageLatency.toFixed(2)}ms
- Avg Audio Latency: ${w.metrics.avgAudioLatency.toFixed(2)}ms
- Errors: ${w.metrics.errorCount}
`).join('')}

Critical Patterns:
${Object.entries(patterns)
  .filter(([_, detected]) => detected)
  .map(([pattern, _]) => `- ${pattern}`)
  .join('\n')}

Primary Issue: ${
  patterns.audioChunkAccumulation ? 'Audio chunks are accumulating without cleanup' :
  patterns.increasingLatency ? 'Message latency is steadily increasing' :
  patterns.bufferGrowth ? 'WebSocket buffer is growing' :
  patterns.highErrorRate ? 'High error rate detected' :
  'No critical issues detected'
}

Root Cause Analysis:
${(() => {
  if (patterns.audioChunkAccumulation) {
    return 'Audio chunks are not being cleaned up fast enough. This causes memory growth and increases processing time for each new chunk.';
  }
  if (patterns.increasingLatency) {
    return 'Message processing is getting slower over time. This could be due to event queue growth or resource exhaustion.';
  }
  if (patterns.bufferGrowth) {
    return 'WebSocket buffer is accumulating data faster than it can be processed. This indicates a processing bottleneck.';
  }
  if (patterns.highErrorRate) {
    return 'Multiple errors occurring, possibly due to timeouts or failed operations.';
  }
  return 'System is functioning within normal parameters.';
})()}

Recommendation:
${(() => {
  if (patterns.audioChunkAccumulation) {
    return 'Implement more aggressive audio chunk cleanup. Consider reducing the maximum chunk threshold.';
  }
  if (patterns.increasingLatency) {
    return 'Add automatic connection refresh after 5 minutes of continuous conversation.';
  }
  if (patterns.bufferGrowth) {
    return 'Implement backpressure handling in WebSocket processing.';
  }
  if (patterns.highErrorRate) {
    return 'Review error handling and add automatic recovery mechanisms.';
  }
  return 'Continue monitoring for performance changes.';
})()}

Note: Disconnecting helps because it forces cleanup of accumulated resources and resets all internal state.`;

  return report;
}
