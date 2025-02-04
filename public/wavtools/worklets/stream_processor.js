// public/wavtools/worklets/stream_processor.js

// Safari/Firefox compatibility wrapper
if (typeof AudioWorkletProcessor === 'undefined') {
  self.AudioWorkletProcessor = class AudioWorkletProcessor {
    constructor() {
      this.port = null;
    }
  };
  self.registerProcessor = null;
}

// Ensure currentTime is available
let currentTime = 0;
if (typeof globalThis !== 'undefined') {
  Object.defineProperty(globalThis, 'currentTime', {
    get() { return performance.now() / 1000; }
  });
}

// Constants for memory management
const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB worth of samples
const BUFFER_CLEANUP_THRESHOLD = MAX_BUFFER_SIZE * 0.8; // 80% of max

// Ensure sampleRate is defined for Safari
const sampleRate = 24000;

class StreamProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return []; // Required for Firefox
  }

  constructor() {
    super();
    this.buffer = [];
    this.isPlaying = false;
    this.sampleRate = sampleRate;
    this.initialized = false;
    this.initializationMessageSent = false;
    this.lastProcessTime = 0;
    this.processingStarted = false;
    this.totalProcessedSamples = 0;
    this.totalBufferSize = 0;

    // Initialize port message handler
    this.port.onmessage = (event) => {
      if (!event.data) return;

      try {
        const { event: eventType, buffer, requestId } = event.data;
        
        switch (eventType) {
          case 'write':
            if (buffer && buffer.length > 0) {
              // Check if adding this buffer would exceed our memory limit
              if (this.totalBufferSize + buffer.length > MAX_BUFFER_SIZE) {
                // Remove oldest buffers until we have space
                while (this.buffer.length > 0 && this.totalBufferSize + buffer.length > BUFFER_CLEANUP_THRESHOLD) {
                  const oldestBuffer = this.buffer.shift();
                  this.totalBufferSize -= oldestBuffer.length;
                }
              }

              // Check if adding this buffer would exceed our memory limit
              if (this.totalBufferSize + buffer.length > MAX_BUFFER_SIZE) {
                // Remove oldest buffers until we have space
                while (this.buffer.length > 0 && 
                       this.totalBufferSize + buffer.length > BUFFER_CLEANUP_THRESHOLD) {
                  const oldestBuffer = this.buffer.shift();
                  if (oldestBuffer) {
                    this.totalBufferSize -= oldestBuffer.length;
                  }
                }
              }

              // Ensure buffer is Float32Array for Safari 
              const floatBuffer = buffer instanceof Float32Array ? 
                buffer : 
                new Float32Array(buffer);
              
              this.buffer.push(floatBuffer);
              this.totalBufferSize += floatBuffer.length;
              
              if (!this.isPlaying && this.buffer.length > 0) {
                this.isPlaying = true;
                this.processingStarted = true;
                this.port.postMessage({ type: 'playbackStarted' });
              }
            }
            break;

          case 'flush':
            this.buffer = [];
            this.totalBufferSize = 0;
            this.totalProcessedSamples = 0;
            break;

          case 'interrupt':
            const currentOffset = this.totalProcessedSamples;
            this.buffer = [];
            this.totalBufferSize = 0;
            this.totalProcessedSamples = 0;
            if (this.isPlaying) {
              this.isPlaying = false;
              this.processingStarted = false;
              this.port.postMessage({ 
                type: 'playbackEnded',
                requestId,
                offset: currentOffset
              });
            }
            break;

          case 'resume':
            if (this.buffer.length > 0) {
              this.isPlaying = true;
              this.processingStarted = true;
              this.port.postMessage({ type: 'playbackStarted' });
            }
            break;

          default:
            console.log('Unknown event type:', eventType);
        }
      } catch (error) {
        console.error('Error in StreamProcessor message handler:', error);
      }
    };
  }

  process(inputs, outputs, parameters) {
    try {
      // Firefox requires this check
      if (!outputs || !outputs[0] || !outputs[0][0]) {
        this.lastProcessTime = currentTime;
        return true;
      }
    } catch (error) {
      console.error('Error in StreamProcessor process:', error);
      // Ensure we fill with silence on error
      if (outputs && outputs[0]) {
        for (const channel of outputs[0]) {
          channel.fill(0);
        }
      }
        // Notify main thread of error
        this.port.postMessage({
          type: 'error',
          error: error.message
        });
        return true;
      }

    try {
      // Validate outputs before accessing
      if (!outputs?.[0]?.[0]) {
        throw new Error('Invalid output format');
      }
      
      const output = outputs[0];
      const channelData = output[0];

      // Initialize on first process call for Safari
      if (!this.initialized) {
        this.initialized = true;
        if (!this.initializationMessageSent) {
          this.port.postMessage({ type: 'initialized' });
          this.initializationMessageSent = true;
        }
      }

      // Check for processing gaps
      if (this.processingStarted && typeof currentTime !== 'undefined') {
        const timeSinceLastProcess = currentTime - this.lastProcessTime;
        if (timeSinceLastProcess > 0.1) { // Gap larger than 100ms
          this.port.postMessage({ 
            type: 'processingGap', 
            duration: timeSinceLastProcess,
            totalProcessed: this.totalProcessedSamples
          });
        }
      }

      if (this.isPlaying && this.buffer.length > 0 && channelData) {
        let remainingSamples = channelData.length;
        let bufferIndex = 0;

        while (remainingSamples > 0 && bufferIndex < this.buffer.length) {
          const currentBuffer = this.buffer[bufferIndex];
          if (!currentBuffer) {
            bufferIndex++;
            continue;
          }

          const samplesFromBuffer = Math.min(remainingSamples, currentBuffer.length);

          // Safe copy for all browsers
          for (let i = 0; i < samplesFromBuffer; i++) {
            const outputIndex = channelData.length - remainingSamples + i;
            if (outputIndex < channelData.length) {
              channelData[outputIndex] = currentBuffer[i] || 0;
            }
          }

          remainingSamples -= samplesFromBuffer;
          this.totalProcessedSamples += samplesFromBuffer;

          if (samplesFromBuffer === currentBuffer.length) {
            // Update total buffer size when removing a buffer
            this.totalBufferSize -= currentBuffer.length;
            bufferIndex++;
          } else {
            // Update buffer size for partial buffer
            const remainingBuffer = currentBuffer.slice(samplesFromBuffer);
            this.totalBufferSize -= (currentBuffer.length - remainingBuffer.length);
            this.buffer[bufferIndex] = remainingBuffer;

            // Reset total processed samples periodically to prevent overflow
            if (this.totalProcessedSamples > Number.MAX_SAFE_INTEGER - 1000000) {
              this.totalProcessedSamples = 0;
            }
          }

          // Reset total processed samples periodically to prevent overflow
          if (this.totalProcessedSamples > Number.MAX_SAFE_INTEGER - 1000000) {
            this.totalProcessedSamples = 0;
          }
        }

        // Clean up processed buffers
        this.buffer = this.buffer.slice(bufferIndex);

        // Fill remaining samples with silence
        if (remainingSamples > 0) {
          const startIndex = channelData.length - remainingSamples;
          for (let i = startIndex; i < channelData.length; i++) {
            channelData[i] = 0;
          }
        }

        // Check if playback ended
        if (this.buffer.length === 0) {
          this.isPlaying = false;
          this.processingStarted = false;
          this.totalProcessedSamples = 0;
          this.totalBufferSize = 0;
          this.port.postMessage({ type: 'playbackEnded' });
        }
      } else if (channelData) {
        // Fill with silence when not playing
        channelData.fill(0);
      }

      // Copy to other channels if they exist (for Firefox)
      for (let i = 1; i < output.length; i++) {
        output[i].set(channelData);
      }

      this.lastProcessTime = typeof currentTime !== 'undefined' ? currentTime : performance.now() / 1000;

    } catch (error) {
      console.error('Error in StreamProcessor process:', error);
      // Ensure we fill with silence on error
      if (outputs && outputs[0]) {
        for (const channel of outputs[0]) {
          channel.fill(0);
        }
      }
    }

    return true;
  }
}

// Register the processor
try {
  if (typeof registerProcessor === 'function') {
    registerProcessor('stream_processor', StreamProcessor);
  }
} catch (error) {
  console.error('Error registering StreamProcessor:', error);
}
