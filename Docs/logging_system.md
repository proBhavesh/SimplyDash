# Realtime API Logging System

## Overview

The logging system provides detailed insights into the Realtime API's operation, focusing on critical events such as:
- Audio buffer management
- WebSocket connections
- Interruption handling
- Error states
- Resource cleanup

## Log File Location

Logs are stored in `logs/realtime-api.log` with automatic rotation when the file exceeds 10MB.

## Using the CLI Tool

### Basic Commands

```bash
# Show overall log summary
npm run logs:summary

# Show last 100 error logs
npm run logs:errors

# Show last 100 warning logs
npm run logs:warnings

# Show recent interruption sequences
npm run logs:interruptions

# Show connection events
npm run logs:connections

# Follow logs in real-time
npm run logs:tail
```

### Advanced Usage

```bash
# Show logs for a specific component
npm run logs component audio.ts

# Search logs for specific terms
npm run logs search "WebSocket"

# Show last N lines of logs
npm run logs tail -n 200

# Follow logs in real-time
npm run logs tail -f
```

## Log Format

Each log entry follows this format:
```
[TIMESTAMP] [LEVEL] COMPONENT:LINE - MESSAGE
```

Example:
```
[2024-03-15 14:30:45.123] [INFO] useRealtimeConnection.ts:213 - Initializing audio system
[2024-03-15 14:30:45.234] [ERROR] audio.ts:156 - Error during audio interruption: AudioContext not initialized
```

## Key Events to Monitor

### Audio Management
```bash
# View audio-related events
npm run logs component audio.ts
```

Key events:
- Audio buffer cleanup
- Track state management
- Interruption handling

### WebSocket Events
```bash
# View connection events
npm run logs:connections
```

Key events:
- Connection establishment
- Cleanup operations
- Error handling

### Interruption Sequences
```bash
# View interruption events
npm run logs:interruptions
```

Shows complete sequences of:
- Interruption trigger
- Audio cleanup
- State reset
- Reconnection

## Analyzing Performance Issues

1. Check for error patterns:
```bash
npm run logs:errors
```

2. Look for interruption sequences:
```bash
npm run logs:interruptions
```

3. Monitor resource cleanup:
```bash
npm run logs search "cleanup"
```

4. Track WebSocket state:
```bash
npm run logs:connections
```

## Log Categories

- INFO: Normal operational events
- WARN: Potential issues that don't affect core functionality
- ERROR: Critical issues requiring attention

## Components

- useRealtimeConnection.ts: Connection management
- audio.ts: Audio buffer and track management
- eventHandlers.ts: Event processing
- websocket.ts: WebSocket communication
- wav_stream_player.ts: Audio playback

## Best Practices

1. Monitor Error Patterns:
   - Check logs:errors regularly
   - Look for recurring issues

2. Track Resource Usage:
   - Monitor cleanup operations
   - Watch for memory-related warnings

3. Debug Interruptions:
   - Use logs:interruptions to understand sequence
   - Verify cleanup completion

4. Performance Monitoring:
   - Watch connection events
   - Monitor audio buffer management
   - Track state transitions

## Example Analysis Workflow

1. Start with summary:
```bash
npm run logs:summary
```

2. Check for errors:
```bash
npm run logs:errors
```

3. Look for patterns:
```bash
npm run logs search "memory"
npm run logs search "cleanup"
```

4. Monitor specific components:
```bash
npm run logs component audio.ts
npm run logs component websocket.ts
```

5. Follow real-time activity:
```bash
npm run logs:tail -f
```

## Troubleshooting Common Issues

### Audio Issues
```bash
npm run logs component audio.ts
```
Look for:
- Buffer cleanup failures
- Track state inconsistencies
- Interruption failures

### Connection Issues
```bash
npm run logs:connections
```
Look for:
- Failed cleanup operations
- Connection state mismatches
- Event handler leaks

### Resource Leaks
```bash
npm run logs search "memory"
npm run logs search "leak"
```
Look for:
- Missed cleanup operations
- Resource accumulation
- Failed state resets

## Maintenance

Logs are automatically rotated when they exceed 10MB. Old logs are preserved with .old extension.

To manually clear logs:
```typescript
import { clearLogs } from './utils/logger';
clearLogs();
