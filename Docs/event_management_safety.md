# Event Management Safety Analysis

## Current Audio Processing Flow
1. OpenAI Realtime API sends:
   - `response.audio.delta` events with raw audio chunks
   - These chunks go directly to WavStreamPlayer for playback
   - The audio is played immediately as it arrives

2. Event Storage:
   - Currently we store ALL events indefinitely
   - This includes completed audio chunks that have already been played
   - These stored events aren't used for playback, only for logging/debugging

## Proposed Changes Safety
1. Audio Playback - UNCHANGED:
   ```typescript
   // This critical path remains exactly the same
   case 'response.audio.delta': {
     if (data.delta) {
       await handleAudioDelta(data, wavStreamPlayerRef, currentItemIdRef);
     }
   }
   ```

2. Event Cleanup - ONLY affects stored events:
   - Only cleans up events AFTER they've been processed
   - Only removes events older than 5 seconds
   - Keeps all state events (session, conversation, etc.)
   - Does not touch the audio processing pipeline

3. Safety Guarantees:
   - Audio chunks are processed before any cleanup
   - WavStreamPlayer receives all chunks in order
   - No interruption to audio playback
   - No impact on real-time processing

4. What Gets Cleaned Up:
   - Old audio chunks that have already been played
   - Old transcript deltas that have been displayed
   - Old text deltas that have been rendered
   - Events older than 5 seconds that aren't needed

5. What Stays Untouched:
   - Current audio chunk being played
   - Recent events (last 5 seconds)
   - All state events (session, conversation)
   - Active WebSocket connection
   - Audio processing pipeline

## Testing Plan
1. Basic Functionality:
   - Send/receive messages
   - Audio playback quality
   - Real-time transcription
   - No interruptions

2. Extended Testing:
   - Long conversations (>10 minutes)
   - Continuous audio streaming
   - Memory usage monitoring
   - Performance metrics

3. Rollback Plan:
   If any issues occur:
   - EventManager can be disabled instantly
   - System reverts to current behavior
   - No data loss or connection interruption

## Why It's Safe
1. Separation of Concerns:
   - Event storage ≠ Event processing
   - Cleaning up stored events doesn't affect processing
   - Audio pipeline is independent of event storage

2. Real-time Priority:
   - Process events first
   - Clean up later
   - Never interrupt active streams

3. Conservative Approach:
   - Keep events for 5 seconds (much longer than needed)
   - Only clean up definitively old events
   - Preserve all important state
