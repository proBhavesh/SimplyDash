import { AudioAnalysis, AudioAnalysisOutputType } from './analysis/audio_analysis';
import { WavPacker, WavPackerAudioType } from './wav_packer';

interface DecodedAudioType {
  blob: Blob;
  url: string;
  values: Float32Array;
  audioBuffer: AudioBuffer;
}

export class WavRecorder {
  public sampleRate: number;
  public outputToSpeakers: boolean;
  public debug: boolean;
  public stream: MediaStream | null = null;
  public context: AudioContext | null = null;
  public source: MediaStreamAudioSourceNode | null = null;
  public processor: AudioWorkletNode | null = null;
  public analyser: AnalyserNode | null = null;
  public recording = false;

  // Event handling system
  private _lastEventId = 0;
  private eventReceipts: Record<string, { timestamp: number; data: any }> = {};
  private eventTimeout = 5000;
  private _lastProcessTime = Date.now(); // Added for audio buffer check

  // Chunk processing system
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private _chunkProcessor: (data: { mono: Int16Array; raw: Int16Array }) => void = () => {};
  private _chunkProcessorSize?: number;
  private _chunkProcessorBuffer: { raw: Int16Array; mono: Int16Array } = {
    raw: new Int16Array(8192),
    mono: new Int16Array(4096),
  };

  constructor({
    sampleRate = 44100,
    outputToSpeakers = false,
    debug = false,
  } = {}) {
    this.sampleRate = sampleRate;
    this.outputToSpeakers = outputToSpeakers;
    this.debug = debug;
  }

  static async decode(
    audioData: Blob | Float32Array | Int16Array | ArrayBuffer | number[],
    sampleRate = 44100,
    fromSampleRate = -1
  ): Promise<DecodedAudioType> {
    const context = new AudioContext({ sampleRate });
    let arrayBuffer: ArrayBuffer;
    let blob: Blob;

    if (audioData instanceof Blob) {
      if (fromSampleRate !== -1) {
        throw new Error('Cannot specify "fromSampleRate" when reading from Blob');
      }
      blob = audioData;
      arrayBuffer = await blob.arrayBuffer();
    } else if (audioData instanceof ArrayBuffer) {
      if (fromSampleRate !== -1) {
        throw new Error('Cannot specify "fromSampleRate" when reading from ArrayBuffer');
      }
      arrayBuffer = audioData;
      blob = new Blob([arrayBuffer], { type: 'audio/wav' });
    } else {
      let float32Array: Float32Array;
      let data: Int16Array;

      if (audioData instanceof Int16Array) {
        data = audioData;
        float32Array = new Float32Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          float32Array[i] = audioData[i] / 0x8000;
        }
      } else if (audioData instanceof Float32Array) {
        float32Array = audioData;
      } else if (Array.isArray(audioData)) {
        float32Array = new Float32Array(audioData);
      } else {
        throw new Error(
          '"audioData" must be one of: Blob, Float32Array, Int16Array, ArrayBuffer, Array<number>'
        );
      }

      if (fromSampleRate === -1) {
        throw new Error(
          'Must specify "fromSampleRate" when reading from Float32Array, Int16Array, or Array'
        );
      } else if (fromSampleRate < 3000) {
        throw new Error('Minimum "fromSampleRate" is 3000 (3kHz)');
      }

      data = new Int16Array(WavPacker.floatTo16BitPCM(float32Array));

      const audio = {
        bitsPerSample: 16,
        channels: [float32Array],
        data,
      };

      const packer = new WavPacker();
      const result = packer.pack(fromSampleRate, audio);
      blob = result.blob;
      arrayBuffer = await blob.arrayBuffer();
    }

    const audioBuffer = await context.decodeAudioData(arrayBuffer);
    const values = audioBuffer.getChannelData(0);
    const url = URL.createObjectURL(blob);

    return {
      blob,
      url,
      values,
      audioBuffer,
    };
  }

  log(...args: any[]): void {
    if (this.debug) {
      console.log('[WavRecorder]', ...args);
    }
  }

  getSampleRate(): number {
    return this.sampleRate;
  }

  getStatus(): 'ended' | 'paused' | 'recording' {
    if (!this.processor) {
      return 'ended';
    } else if (!this.recording) {
      return 'paused';
    } else {
      return 'recording';
    }
  }

  private cleanupEventReceipts() {
    const now = Date.now();
    Object.keys(this.eventReceipts).forEach(key => {
      if (now - this.eventReceipts[key].timestamp > this.eventTimeout) {
        delete this.eventReceipts[key];
      }
    });
  }

  private clearMessageHandler() {
    if (this.processor?.port) {
      this.processor.port.onmessage = null;
    }
  }

  // Added method to check and clear audio buffer
  private checkAudioBuffer() {
    if (this.processor?.port) {
      this.processor.port.postMessage({ event: 'clear' });
    }
  }

  // Modified to include buffer check
  private processChunk(data: { mono: Int16Array; raw: Int16Array }) {
    // Check for potential backup before processing
    if (Date.now() - this._lastProcessTime > 5000) {
      this.checkAudioBuffer();
    }
    this._lastProcessTime = Date.now();
    
    this._chunkProcessor(data);
  }

  async begin(deviceId?: string): Promise<boolean> {
    this.log('Beginning WavRecorder initialization');
    if (this.processor) {
      this.log('Error: Already connected. Call .end() to start a new session');
      throw new Error('Already connected: please call .end() to start a new session');
    }

    if (!navigator.mediaDevices || !('getUserMedia' in navigator.mediaDevices)) {
      this.log('Error: Could not request user media. Browser may not support required APIs');
      throw new Error('Could not request user media');
    }

    try {
      const config: MediaStreamConstraints = { audio: true };
      if (deviceId) {
        config.audio = { deviceId: { exact: deviceId } };
      }
      this.log('Requesting media stream');
      this.stream = await navigator.mediaDevices.getUserMedia(config);
      this.log('Media stream obtained successfully');
    } catch (err) {
      this.log('Error accessing microphone:', err);
      throw new Error('Could not start media stream');
    }

    try {
      this.log('Creating AudioContext');
      this.context = new AudioContext({ sampleRate: this.sampleRate });
      this.log('Creating MediaStreamSource');
      this.source = this.context.createMediaStreamSource(this.stream);
    } catch (err) {
      this.log('Error creating AudioContext or MediaStreamSource:', err);
      throw new Error('Failed to initialize audio context');
    }

    try {
      this.log('Loading audio_processor.js module');
      await this.context.audioWorklet.addModule('/wavtools/worklets/audio_processor.js');
      this.log('audio_processor.js module loaded successfully');
    } catch (e) {
      this.log('Error loading audio_processor.js:', e);
      throw new Error('Could not add audioWorklet module: audio_processor.js');
    }

    try {
      this.log('Creating AudioWorkletNode');
      this.processor = new AudioWorkletNode(this.context, 'audio_processor');
      this.processor.port.onmessage = (e) => {
        const { event, id, data } = e.data;
        if (event === 'receipt') {
          this.eventReceipts[id] = { timestamp: Date.now(), data };
        } else if (event === 'chunk') {
          this.processChunk(data);
        }
      };
      this.log('AudioWorkletNode created successfully');
    } catch (e) {
      this.log('Error creating AudioWorkletNode:', e);
      throw new Error('Failed to create AudioWorkletNode');
    }

    this.log('Creating AnalyserNode');
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 8192;
    this.analyser.smoothingTimeConstant = 0.1;
    this.log('Analyser node created and configured');

    this.log('Connecting audio nodes');
    this.source.connect(this.processor);
    this.processor.connect(this.analyser);
    this.log('Audio nodes connected');

    if (this.outputToSpeakers) {
      this.log('Warning: Output to speakers enabled. This may affect sound quality.');
      console.warn(
        'Warning: Output to speakers may affect sound quality,\n' +
          'especially due to system audio feedback preventative measures.\n' +
          'Use only for debugging.'
      );
      this.analyser.connect(this.context.destination);
      this.log('Connected to speakers for debugging');
    }

    this.log('WavRecorder initialization completed successfully');
    return true;
  }

  getFrequencies(
    analysisType: 'frequency' | 'music' | 'voice' = 'frequency',
    minDecibels = -100,
    maxDecibels = -30
  ): AudioAnalysisOutputType {
    if (!this.analyser) {
      throw new Error('Session ended: please call .begin() first');
    }
    try {
      const result = AudioAnalysis.getFrequencies(
        this.analyser,
        this.sampleRate,
        null,
        analysisType,
        minDecibels,
        maxDecibels
      );
      this.log(`Frequencies analyzed: ${analysisType}`);
      return result;
    } catch (error) {
      console.error('Error getting frequencies:', error);
      throw new Error('Failed to get frequencies');
    }
  }

  private async _event(
    name: string,
    data: any = {},
    _processor: AudioWorkletNode | null = null
  ): Promise<any> {
    _processor = _processor || this.processor;
    if (!_processor) {
      throw new Error('Can not send events without recording first');
    }

    // Cleanup old event receipts
    this.cleanupEventReceipts();

    const message = {
      event: name,
      id: this._lastEventId++,
      data,
      timestamp: Date.now(),
    };

    _processor.port.postMessage(message);

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        delete this.eventReceipts[message.id];
        reject(new Error(`Timeout waiting for "${name}" event`));
      }, this.eventTimeout);

      const checkReceipt = () => {
        const receipt = this.eventReceipts[message.id];
        if (receipt) {
          clearTimeout(timeoutId);
          delete this.eventReceipts[message.id];
          resolve(receipt.data);
        } else {
          setTimeout(checkReceipt, 10);
        }
      };

      checkReceipt();
    });
  }

  async record(): Promise<boolean>;
  async record(chunkProcessor: (data: { mono: Int16Array; raw: Int16Array }) => void): Promise<boolean>;
  async record(
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    chunkProcessor: (data: { mono: Int16Array; raw: Int16Array }) => void = () => {},
    chunkSize = 8192
  ): Promise<boolean> {
    if (!this.processor) {
      throw new Error('Session ended: please call .begin() first');
    }
    if (this.recording) {
      throw new Error('Already recording: please call .pause() first');
    }

    this._chunkProcessor = chunkProcessor;
    this._chunkProcessorSize = chunkSize;
    this._chunkProcessorBuffer = {
      raw: new Int16Array(8192),
      mono: new Int16Array(4096),
    };

    this.log('Recording ...');
    await this._event('start');
    this.recording = true;
    return true;
  }

  async pause(): Promise<boolean> {
    if (!this.processor) {
      throw new Error('Session ended: please call .begin() first');
    }
    if (!this.recording) {
      throw new Error('Already paused: please call .record() first');
    }

    if (this._chunkProcessorBuffer.raw.byteLength) {
      this._chunkProcessor(this._chunkProcessorBuffer);
      this._chunkProcessorBuffer = {
        raw: new Int16Array(8192),
        mono: new Int16Array(4096),
      };
    }

    this.log('Pausing ...');
    await this._event('stop');
    this.recording = false;
    return true;
  }

  async clear(): Promise<boolean> {
    if (!this.processor) {
      throw new Error('Session ended: please call .begin() first');
    }
    this.processor.port.postMessage({ event: 'clear' });
    return true;
  }

  async read(): Promise<{ meanValues: Float32Array; channels: Array<Float32Array> }> {
    if (!this.processor) {
      throw new Error('Session ended: please call .begin() first');
    }
    this.log('Reading ...');
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Timeout waiting for read event'));
      }, this.eventTimeout);

      const messageHandler = (e: MessageEvent) => {
        if (e.data.event === 'receipt' && e.data.data) {
          clearTimeout(timeoutId);
          this.processor?.port.removeEventListener('message', messageHandler);
          resolve(e.data.data);
        }
      };

      this.processor?.port.addEventListener('message', messageHandler);
      this.processor?.port.postMessage({ event: 'read' });
    });
  }

  async save(force = false): Promise<WavPackerAudioType> {
    if (!this.processor) {
      throw new Error('Session ended: please call .begin() first');
    }
    if (!force && this.recording) {
      throw new Error(
        'Currently recording: please call .pause() first, or call .save(true) to force'
      );
    }
    this.log('Exporting ...');
    return new Promise((resolve) => {
      const messageHandler = (e: MessageEvent) => {
        if (e.data.event === 'receipt' && e.data.data) {
          this.processor?.port.removeEventListener('message', messageHandler);
          const packer = new WavPacker();
          const result = packer.pack(this.sampleRate, e.data.data.audio);
          resolve(result);
        }
      };

      this.processor?.port.addEventListener('message', messageHandler);
      this.processor?.port.postMessage({ event: 'export' });
    });
  }

  async end(): Promise<WavPackerAudioType> {
    if (!this.processor) {
      throw new Error('Session ended: please call .begin() first');
    }

    this.log('Stopping recording and cleaning up resources...');

    // Stop recording first
    if (this.recording) {
      await this.pause();
    }

    // Save current audio before cleanup
    const result = await this.save(true);

    // Clean up audio resources
    try {
      // Stop all media tracks
      if (this.stream) {
        this.stream.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
      }

      // Disconnect and cleanup audio nodes
      if (this.processor) {
        this.clearMessageHandler();
        this.processor.disconnect();
      }
      if (this.source) this.source.disconnect();
      if (this.analyser) this.analyser.disconnect();

      // Close audio context
      if (this.context && this.context.state !== 'closed') {
        await this.context.close();
      }

      // Clear all event receipts
      this.eventReceipts = {};
      this._lastEventId = 0;

      // Reset chunk processor state
      this._chunkProcessorBuffer = {
        raw: new Int16Array(8192),
        mono: new Int16Array(4096)
      };
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      this._chunkProcessor = () => {};
      this._chunkProcessorSize = undefined;

    } catch (error) {
      console.error('Error during cleanup:', error);
    } finally {
      // Null out references
      this.stream = null;
      this.context = null;
      this.processor = null;
      this.source = null;
      this.analyser = null;
      this.recording = false;
    }

    this.log('Cleanup completed');
    return result;
  }
}
