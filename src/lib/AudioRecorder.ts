// src/lib/AudioRecorder.ts

interface AudioData {
  mono: Int16Array;
  raw: Int16Array;
}

export class AudioRecorder {
  private sampleRate;
  private stream: MediaStream | null = null;
  private processor: AudioWorkletNode | null = null;
  private context: AudioContext | null = null;
  private recording = false;

  constructor(sampleRate = 24000) {
    this.sampleRate = sampleRate;
  }

  async begin(): Promise<boolean> {
    if (this.processor) {
      throw new Error('Already connected: please call .end() to start a new session');
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.context = new AudioContext({ sampleRate: this.sampleRate });
      
      await this.context.audioWorklet.addModule('/src/lib/worklets/audio_processor.js');
      this.processor = new AudioWorkletNode(this.context, 'audio_processor');

      const source = this.context.createMediaStreamSource(this.stream);
      source.connect(this.processor);
      this.processor.connect(this.context.destination);

      return true;
    } catch (error) {
      console.error('Error initializing AudioRecorder:', error);
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        throw new Error('Microphone access denied. Please grant permission and try again.');
      } else if (error instanceof DOMException && error.name === 'NotFoundError') {
        throw new Error('No microphone found. Please check your audio input devices and try again.');
      }
      throw error;
    }
  }

  async record(onAudioData: (data: AudioData) => void): Promise<boolean> {
    if (!this.processor) {
      throw new Error('Session not started: please call .begin() first');
    }
    if (this.recording) {
      throw new Error('Already recording: please call .pause() first');
    }

    this.recording = true;
    this.processor.port.onmessage = (event) => {
      if (event.data.eventType === 'audioData') {
        onAudioData(event.data.audioData);
      }
    };

    this.processor.port.postMessage({ command: 'start' });
    return true;
  }

  async pause(): Promise<boolean> {
    if (!this.processor) {
      throw new Error('Session not started: please call .begin() first');
    }
    if (!this.recording) {
      throw new Error('Not recording: please call .record() first');
    }

    this.recording = false;
    this.processor.port.postMessage({ command: 'stop' });
    return true;
  }

  async end(): Promise<boolean> {
    if (this.recording) {
      await this.pause();
    }

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.context) {
      await this.context.close();
      this.context = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    return true;
  }
}
