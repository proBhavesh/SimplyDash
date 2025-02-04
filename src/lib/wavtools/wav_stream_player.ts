// src/lib/wavtools/wav_stream_player.ts

import { AudioAnalysis, AudioAnalysisOutputType } from './analysis/audio_analysis';

interface InterruptResult {
  trackId: string;
  offset: number;
}

// Chrome-specific performance memory API
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface ExtendedPerformance extends Performance {
  memory?: PerformanceMemory;
}

declare const performance: ExtendedPerformance;

export class WavStreamPlayer extends EventTarget {
  private context: AudioContext | null = null;
  private streamNode: AudioWorkletNode | null = null;
  private analyser: AnalyserNode | null = null;
  private sampleRate: number;
  private playbackOffset = 0;
  private currentTrackId: string | null = null;
  private isConnected = false;
  private debug: boolean;
  private hasReceivedAudioData = false;
  private audioBuffer: Float32Array[] = [];
  private isPlaying = false;
  private trackSampleOffsets: Record<string, {
    trackId: string;
    offset: number;
    currentTime: number;
  }> = {};
  private timeouts: Set<number> = new Set();
  private readonly TIMEOUT_DURATION = 5000; // 5 seconds timeout
  private interruptedTrackIds: Record<string, boolean> = {};
  private readonly MAX_BUFFER_COUNT = 10; // Double buffer count for smoother playback
  private readonly BUFFER_SIZE_LIMIT = 256 * 1024; // Reduced per-buffer size for faster processing
  private readonly TOTAL_BUFFER_SIZE_LIMIT = 4 * 1024 * 1024; // Increased total limit
  private totalBufferSize = 0;

  constructor({ sampleRate = 24000, debug = false } = {}) {
    super();
    this.sampleRate = sampleRate;
    this.debug = debug;
    this.setupVisibilityHandler();
    // Removed startMemoryMonitoring call
  }

  private setupVisibilityHandler() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }
  }

  private async handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      if (this.context?.state === 'suspended') {
        await this.context.resume();
        this.log('AudioContext resumed after visibility change');
        
        // Only replay if we were actually playing
        if (this.isPlaying && this.audioBuffer.length > 0) {
          await this.replayBufferedAudio();
        }
      }
    }
  }

  private async replayBufferedAudio() {
    if (!this.isConnected || !this.streamNode) return;

    try {
      // Ensure context is resumed
      if (this.context?.state === 'suspended') {
        await this.context.resume();
        this.log('AudioContext resumed before replay');
      }

      // Keep last few buffers instead of just one
      const recentBuffers = this.audioBuffer.slice(-3);
      if (recentBuffers.length === 0) return;

      this.audioBuffer = recentBuffers;
      this.totalBufferSize = recentBuffers.reduce((sum, buf) => 
        sum + buf.length * Float32Array.BYTES_PER_ELEMENT, 0);
      
      // Send buffers with small delay between each
      for (const buffer of recentBuffers) {
        this.streamNode.port.postMessage({ 
          event: 'write', 
          buffer: buffer
        });
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      this.log('Replayed audio buffers after resume');
    } catch (error) {
      this.error('Error replaying buffered audio:', error);
      // Try to recover by resetting audio pipeline
      this.reset().catch(console.error);
    }
  }

  private log(...args: any[]): void {
    if (this.debug) {
      console.log('[WavStreamPlayer]', ...args);
    }
  }

  private error(...args: any[]): void {
    console.error('[WavStreamPlayer]', ...args);
  }

  private async loadAudioWorklet(context: AudioContext): Promise<void> {
    try {
      if (!context.audioWorklet) {
        throw new Error('AudioWorklet is not supported in this browser.');
      }

      // Add retry logic for worklet loading with better path handling
      let attempts = 0;
      const maxAttempts = 3;
      const paths = [
        '/wavtools/worklets/stream_processor.js',
        './wavtools/worklets/stream_processor.js',
        'wavtools/worklets/stream_processor.js',
        '/stream_processor.js'
      ];
      
      let lastError: Error | null = null;
      for (const path of paths) {
        attempts = 0;
        while (attempts < maxAttempts) {
          try {
            await context.audioWorklet.addModule(path);
            this.log(`Audio worklet module loaded successfully from ${path}`);
            return;
          } catch (error) {
            lastError = error as Error;
            attempts++;
            if (attempts < maxAttempts) {
              this.log(`Retrying worklet load from ${path}, attempt ${attempts + 1}/${maxAttempts}`);
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }
      }
      throw new Error(`Failed to load AudioWorklet from any path. Last error: ${lastError?.message}`);
    } catch (e) {
      const error = e as Error;
      this.error('Error loading audio worklet module:', error);
      throw new Error(`Failed to load audio worklet: ${error.message}`);
    }
  }

  async connect(): Promise<boolean> {
    try {
      // Always disconnect first to ensure clean state
      await this.disconnect();
      
      this.context = new AudioContext({ sampleRate: this.sampleRate });
      
      // Ensure context is resumed
      if (this.context.state === 'suspended') {
        await this.context.resume();
        this.log('AudioContext resumed during connect');
      }

      await this.loadAudioWorklet(this.context);

      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;

      this.streamNode = new AudioWorkletNode(this.context, 'stream_processor');
      await Promise.all([
        this.streamNode.connect(this.context.destination),
        this.streamNode.connect(this.analyser)
      ]);

      // Set up message handling with error recovery
      this.streamNode.port.onmessage = async (event) => {
        if (!event.data) return;
        
        try {
          switch (event.data.type) {
            case 'playbackStarted':
              this.log('Playback started');
              this.isPlaying = true;
              this.dispatchEvent(new Event('playbackStarted'));
              break;
              
            case 'playbackEnded':
              this.log('Playback ended');
              this.isPlaying = false;
              this.audioBuffer = [];
              this.totalBufferSize = 0;
              this.dispatchEvent(new Event('playbackEnded'));
              break;
              
            case 'processingGap':
              this.log('Processing gap detected:', event.data.duration);
              await this.cleanupResources();
              break;
              
            case 'error':
              this.error('AudioWorklet error:', event.data.error);
              await this.reset();
              break;
          }
        } catch (error) {
          this.error('Error handling AudioWorklet message:', error);
          await this.reset().catch(console.error);
        }
      };

      this.isConnected = true;
      this.log('Connected successfully');
      return true;
    } catch (e) {
      const error = e as Error;
      this.error('Error connecting:', error);
      this.isConnected = false;
      throw new Error(`Error connecting WavStreamPlayer: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      this.log('Already disconnected');
      return;
    }
    try {
      // Clear all pending timeouts
      this.timeouts.forEach(timeoutId => {
        window.clearTimeout(timeoutId);
      });
      this.timeouts.clear();

      if (this.streamNode) {
        this.streamNode.disconnect();
        this.streamNode = null;
      }
      if (this.analyser) {
        this.analyser.disconnect();
        this.analyser = null;
      }
      if (this.context) {
        if (this.context.state !== 'closed') {
          await this.context.close();
        }
        this.context = null;
      }
      this.playbackOffset = 0;
      this.currentTrackId = null;
      this.isConnected = false;
      this.isPlaying = false;
      this.audioBuffer = [];
      this.totalBufferSize = 0;
      this.log('Disconnected');
    } catch (error) {
      const err = error as DOMException;
      if (err.name !== 'InvalidStateError') {
        this.error('Error during disconnect:', error);
      }
    }
  }

  private cleanupResources() {
    this.log('Starting resource cleanup');
    
    // Clear audio buffers and reset size
    this.audioBuffer = [];
    this.totalBufferSize = 0;

    // Clear all timeouts
    this.timeouts.forEach(timeoutId => {
      window.clearTimeout(timeoutId);
    });
    this.timeouts.clear();

    // Reset track state
    this.interruptedTrackIds = {};
    this.trackSampleOffsets = {};
    this.playbackOffset = 0;
    this.currentTrackId = null;
    this.hasReceivedAudioData = false;

    // Force audio context cleanup if needed
    if (this.context && this.context.state !== 'closed') {
      this.log('Recycling audio context');
      this.disconnect().then(() => {
        // Small delay before reconnecting to ensure cleanup
        setTimeout(() => {
          this.connect().catch(error => {
            this.error('Error reconnecting after cleanup:', error);
          });
        }, 100);
      }).catch(error => {
        this.error('Error during context cleanup:', error);
      });
    }

    this.log('Resource cleanup completed');
  }

  async add16BitPCM(arrayBuffer: ArrayBuffer | Int16Array, trackId: string): Promise<Int16Array> {
    if (!this.isConnected || !this.streamNode) {
      throw new Error('Not connected, please call .connect() first');
    }

    // Ensure context is active
    if (this.context?.state === 'suspended') {
      try {
        await this.context.resume();
        this.log('AudioContext resumed in add16BitPCM');
      } catch (error) {
        this.error('Failed to resume AudioContext:', error);
        await this.reset();
      }
    }


    if (this.interruptedTrackIds[trackId]) {
      this.log(`Skipping interrupted track: ${trackId}`);
      return new Int16Array(0);
    }
    let buffer: Int16Array;
    if (arrayBuffer instanceof Int16Array) {
      buffer = arrayBuffer;
    } else if (arrayBuffer instanceof ArrayBuffer) {
      buffer = new Int16Array(arrayBuffer);
    } else {
      throw new Error(`Argument must be Int16Array or ArrayBuffer`);
    }

    const floatBuffer = new Float32Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      floatBuffer[i] = buffer[i] / 32768.0;
    }

    const bufferSize = floatBuffer.length * Float32Array.BYTES_PER_ELEMENT;

    // Check if adding this buffer would exceed the total size limit
    if (this.totalBufferSize + bufferSize > this.TOTAL_BUFFER_SIZE_LIMIT) {
      this.log('Total buffer size limit reached, cleaning up old buffers');
      // Remove oldest buffers until within limit
      while (this.audioBuffer.length > 0 && this.totalBufferSize + bufferSize > this.TOTAL_BUFFER_SIZE_LIMIT) {
        const removed = this.audioBuffer.shift();
        if (removed) {
          this.totalBufferSize -= removed.length * Float32Array.BYTES_PER_ELEMENT;
        }
      }
    }

    this.log('Adding 16-bit PCM data', { bufferLength: buffer.length, trackId });

    // More sophisticated buffer management
    if (this.audioBuffer.length >= this.MAX_BUFFER_COUNT || 
        this.totalBufferSize + bufferSize > this.TOTAL_BUFFER_SIZE_LIMIT) {
      // Keep more recent buffers when cleaning up
      const keepCount = Math.max(2, Math.floor(this.MAX_BUFFER_COUNT / 2));
      while (this.audioBuffer.length > keepCount) {
        const removed = this.audioBuffer.shift();
        if (removed) {
          this.totalBufferSize -= removed.length * Float32Array.BYTES_PER_ELEMENT;
        }
      }
      this.log(`Buffer cleanup: kept ${keepCount} buffers, total size: ${this.totalBufferSize}`);
    }

    // Add new buffer
    this.audioBuffer.push(floatBuffer);
    this.totalBufferSize += bufferSize;

    // Periodically check context state
    if (this.context?.state === 'suspended') {
      try {
        await this.context.resume();
        this.log('AudioContext auto-resumed during buffer add');
      } catch (error) {
        this.error('Failed to auto-resume context:', error);
      }
    }

    // Always try to send to audio worklet, with error recovery
    try {
      if (!this.streamNode) {
        throw new Error('StreamNode lost');
      }
      this.streamNode.port.postMessage({ event: 'write', buffer: floatBuffer });
    } catch (error) {
      this.error('Error sending buffer to audio worklet:', error);
      // Try to recover the audio pipeline
      await this.reset();
      // Retry sending after reset
      if (this.streamNode) {
        this.streamNode.port.postMessage({ event: 'write', buffer: floatBuffer });
      }
    }

    const offset = this.playbackOffset;
    this.trackSampleOffsets[trackId] = {
      trackId,
      offset,
      currentTime: offset / this.sampleRate
    };

    this.playbackOffset += buffer.length;
    this.currentTrackId = trackId;
    this.hasReceivedAudioData = true;

    return buffer;
  }

  async getPlaybackOffset(): Promise<number> {
    return this.playbackOffset;
  }

  async interrupt(): Promise<void> {
    // Simple interrupt that just resets state
    this.playbackOffset = 0;
    this.currentTrackId = null;
    this.isPlaying = false;
    this.audioBuffer = [];
    this.totalBufferSize = 0;
    
    if (this.streamNode) {
      this.streamNode.port.postMessage({ event: 'flush' });
    }
  }

  async flush(): Promise<void> {
    if (!this.isConnected || !this.streamNode) {
      return;
    }

    const requestId = crypto.randomUUID();
    this.streamNode.port.postMessage({ 
      event: 'flush',
      requestId 
    });

    return new Promise<void>((resolve) => {
      const timeoutId = window.setTimeout(() => {
        cleanup();
        resolve();
      }, this.TIMEOUT_DURATION);

      const cleanup = () => {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
          this.timeouts.delete(timeoutId);
        }
        this.audioBuffer = [];
        this.totalBufferSize = 0;
      };

      this.timeouts.add(timeoutId);
      this.log('Flushing audio buffer');
      
      // Cleanup and resolve immediately for most cases
      cleanup();
      resolve();
    });
  }

  async reset(): Promise<void> {
    this.log('Resetting WavStreamPlayer');
    try {
      await this.disconnect();
      this.playbackOffset = 0;
      this.currentTrackId = null;
      this.hasReceivedAudioData = false;
      this.audioBuffer = [];
      this.totalBufferSize = 0;

      // Add delay before reconnecting to ensure clean state
      await new Promise(resolve => setTimeout(resolve, 100));
      
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          await this.connect();
          this.log('Successfully reconnected after reset');
          return;
        } catch (error) {
          retryCount++;
          this.error(`Reset attempt ${retryCount} failed:`, error);
          if (retryCount === maxRetries) {
            throw new Error(`Failed to reset after ${maxRetries} attempts: ${error instanceof Error ? error.message : String(error)}`);
          }
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, retryCount), 5000)));
        }
      }
    } catch (error) {
      this.error('Critical error during reset:', error);
      // Ensure we're in a clean state even after error
      this.isConnected = false;
      this.playbackOffset = 0;
      this.currentTrackId = null;
      this.audioBuffer = [];
      this.totalBufferSize = 0;
      throw error;
    }
  }

  hasAudioData(): boolean {
    return this.hasReceivedAudioData;
  }

  getStatus(): { 
    isConnected: boolean; 
    contextState: string; 
    nodesInitialized: boolean;
    currentDuration?: number;
  } {
    return {
      isConnected: this.isConnected,
      contextState: this.context ? this.context.state : 'not initialized',
      nodesInitialized: !!(this.streamNode && this.analyser),
      currentDuration: this.playbackOffset > 0 ? this.playbackOffset : undefined
    };
  }

  getFrequencies(
    analysisType: 'frequency' | 'music' | 'voice' = 'frequency',
    minDecibels = -100,
    maxDecibels = -30
  ): AudioAnalysisOutputType {
    if (!this.isConnected || !this.analyser) {
      throw new Error('Not connected, please call .connect() first');
    }

    try {
      const rawData = new Float32Array(this.analyser.frequencyBinCount);
      this.analyser.getFloatFrequencyData(rawData);

      const result = AudioAnalysis.getFrequencies(
        this.analyser,
        this.sampleRate,
        null,
        analysisType,
        minDecibels,
        maxDecibels
      );

      return result;
    } catch (error) {
      this.error('Error in getFrequencies:', error);
      return {
        values: new Float32Array(this.analyser!.frequencyBinCount),
        frequencies: [],
        labels: [],
      };
    }
  }
}
