# Performance Monitoring System

npx playwright test tests/memory-monitor.spec.ts --project=chromium --headed --timeout=600000

This document describes how to use the performance monitoring system to diagnose and resolve performance issues, particularly the slowdown observed after extended conversations.

## Overview

The system includes:
1. Real-time performance logging
2. Performance metrics collection
3. Automated analysis
4. Recommendations for optimization

## Available Tools

### Performance Buttons (UI)
- **Download Logs**: Downloads raw performance logs in JSON format
- **Analyze Performance**: Generates a detailed performance analysis report
- **Clear Logs**: Clears stored performance logs (use before starting a new test session)

### Metrics Tracked

1. **Message Latencies**
   - Time between messages
   - Processing time for each message
   - Trend analysis of message latencies

2. **Audio Processing**
   - Audio chunk processing times
   - Audio buffer accumulation
   - Gaps in audio processing

3. **WebSocket State**
   - Buffer amount
   - Ready state
   - Event queue size

4. **Memory Usage**
   - Heap size monitoring
   - Memory growth patterns

## How to Diagnose Issues

### For Extended Conversation Slowdown

1. Start a new conversation session
2. Clear existing logs: Click "Clear Logs"
3. Have a conversation for about 5-7 minutes
4. When slowdown occurs:
   - Click "Analyze Performance" to generate a report
   - Look for patterns in:
     - Increasing message latencies
     - Growing audio chunk accumulation
     - WebSocket buffer growth
     - Memory usage trends

### Common Patterns and Solutions

1. **Growing Audio Chunks**
   - Pattern: `audioChunksCount` increases steadily
   - Solution: Audio chunks are automatically cleaned up after processing
   - If accumulation continues, the system will trigger automatic interruption

2. **Increasing Message Latencies**
   - Pattern: Average processing time grows over time
   - Solution: System automatically logs warnings when latencies exceed thresholds
   - Consider implementing automatic reconnection after extended conversations

3. **WebSocket Buffer Growth**
   - Pattern: `wsBufferedAmount` increases
   - Solution: Monitor backpressure and implement flow control

4. **Memory Leaks**
   - Pattern: Consistent increase in `usedJSHeapSize`
   - Solution: Check for retained references and implement cleanup

## Performance Report Format

The analysis report includes:

```
Performance Analysis Report
[Timestamp]

Metrics:
- Average Processing Time: [value]ms
- Maximum Processing Time: [value]ms
- Audio Latency Trend: [recent values]ms
- Message Latency Trend: [recent values]ms
- Audio Chunks Accumulation: [count]
- WebSocket Buffered Amount: [bytes]
- Event Queue Size: [count]
- Time to First Response: [value]ms
- Interruption Count: [count]
- Total Errors: [count]

Issues Detected:
- [List of identified issues]

Recommendations:
- [Actionable recommendations]
```

## Best Practices

1. **Regular Monitoring**
   - Download and analyze logs periodically
   - Watch for warning messages in the console
   - Monitor memory usage in browser dev tools

2. **Testing New Features**
   - Clear logs before testing
   - Run extended conversations (>7 minutes)
   - Analyze performance before and after changes

3. **Troubleshooting**
   - Compare performance reports from different sessions
   - Look for patterns in timing metrics
   - Check for memory leaks using browser dev tools

## Automatic Safeguards

The system includes several automatic safeguards:

1. **Audio Chunk Cleanup**
   - Threshold: 100 chunks
   - Action: Automatic cleanup when threshold exceeded

2. **Response Timeout**
   - Threshold: 10 seconds
   - Action: Marks response as interrupted

3. **Event Processing Timeout**
   - Threshold: 5 seconds
   - Action: Logs warning and detailed state

4. **Memory Usage Warning**
   - Threshold: 500MB
   - Action: Logs warning with current usage

## Future Improvements

1. **Automatic Reconnection**
   - Implement automatic reconnection after extended conversations
   - Reset internal state while maintaining conversation context

2. **Adaptive Thresholds**
   - Adjust timeouts based on network conditions
   - Scale chunk limits based on available memory

3. **Real-time Monitoring**
   - Add real-time performance graphs
   - Implement proactive warning system

## Contributing

When adding new features:
1. Add appropriate performance logging
2. Update thresholds if needed
3. Document new metrics in this guide
4. Add test cases for performance monitoring
