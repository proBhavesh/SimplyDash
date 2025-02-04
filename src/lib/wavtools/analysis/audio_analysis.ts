import {
  noteFrequencies,
  noteFrequencyLabels,
  voiceFrequencies,
  voiceFrequencyLabels,
} from "./constants";

export interface AudioAnalysisOutputType {
  values: Float32Array;
  frequencies: number[];
  labels: string[];
}

export class AudioAnalysis {
  private static readonly THROTTLE_INTERVAL = 200; // ms between updates
  private static readonly SMALLER_FFT_SIZE = 512; // Reduced from 1024
  private static readonly CACHE_SIZE = 500;
  private static readonly DOWNSAMPLING_TARGET = 250; // Reduced from 500

  private static worker: Worker | null = null;
  private static readonly USE_WORKER = typeof Worker !== "undefined";

  private fftResults: Float32Array[] = [];
  private audio: HTMLAudioElement;
  private context!: AudioContext | OfflineAudioContext;
  private analyser!: AnalyserNode;
  private sampleRate!: number;
  private audioBuffer: AudioBuffer | null;
  private lastAnalysisTime = 0;
  private cachedAnalysis: Map<string, AudioAnalysisOutputType> = new Map();

  static getFrequencies(
    analyser: AnalyserNode,
    sampleRate: number,
    fftResult?: Float32Array | null,
    analysisType: "frequency" | "music" | "voice" = "frequency",
    minDecibels = -100,
    maxDecibels = -30
  ): AudioAnalysisOutputType {
    const frequencyData =
      fftResult || new Float32Array(analyser.frequencyBinCount);
    if (!fftResult) {
      analyser.getFloatFrequencyData(frequencyData);
    }

    for (let i = 0; i < frequencyData.length; i++) {
      if (!isFinite(frequencyData[i])) {
        frequencyData[i] = minDecibels;
      }
    }

    const nyquistFrequency = sampleRate / 2;
    const frequencyStep = nyquistFrequency / frequencyData.length;

    if (analysisType === "music" || analysisType === "voice") {
      return this.processSpecializedAnalysis(
        frequencyData,
        frequencyStep,
        analysisType,
        minDecibels,
        maxDecibels
      );
    }

    return this.processFrequencyAnalysis(
      frequencyData,
      frequencyStep,
      minDecibels,
      maxDecibels
    );
  }

  private static processSpecializedAnalysis(
    frequencyData: Float32Array,
    frequencyStep: number,
    analysisType: "music" | "voice",
    minDecibels: number,
    maxDecibels: number
  ): AudioAnalysisOutputType {
    const useFrequencies =
      analysisType === "voice" ? voiceFrequencies : noteFrequencies;
    const useLabels =
      analysisType === "voice" ? voiceFrequencyLabels : noteFrequencyLabels;

    const aggregateOutput = new Float32Array(useFrequencies.length).fill(
      minDecibels
    );
    const bandCounts = new Uint16Array(useFrequencies.length).fill(0);

    for (let i = 0; i < frequencyData.length; i++) {
      const frequency = i * frequencyStep;
      const value = frequencyData[i];

      let low = 0;
      let high = useFrequencies.length - 1;
      while (low <= high) {
        const mid = (low + high) >>> 1;
        if (useFrequencies[mid] < frequency) {
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      const band = Math.max(0, low - 1);

      aggregateOutput[band] += value;
      bandCounts[band]++;
    }

    for (let i = 0; i < aggregateOutput.length; i++) {
      if (bandCounts[i] > 0) {
        aggregateOutput[i] /= bandCounts[i];
      }
    }

    return this.normalizeOutput(
      aggregateOutput,
      useFrequencies,
      useLabels,
      minDecibels,
      maxDecibels
    );
  }

  private static processFrequencyAnalysis(
    frequencyData: Float32Array,
    frequencyStep: number,
    minDecibels: number,
    maxDecibels: number
  ): AudioAnalysisOutputType {
    const downsampleFactor = Math.max(
      1,
      Math.ceil(frequencyData.length / this.DOWNSAMPLING_TARGET)
    );
    const outputLength = Math.ceil(frequencyData.length / downsampleFactor);

    const values = new Float32Array(outputLength);
    const frequencies = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      let sum = 0;
      const startIdx = i * downsampleFactor;
      const endIdx = Math.min(
        startIdx + downsampleFactor,
        frequencyData.length
      );

      for (let j = startIdx; j < endIdx; j++) {
        sum += frequencyData[j];
      }

      values[i] = sum / (endIdx - startIdx);
      frequencies[i] = frequencyStep * startIdx;
    }

    // Convert frequencies to numbers array before mapping to strings
    const freqArray = Array.from(frequencies);
    const labels = freqArray.map((f) => `${Math.round(f)} Hz`);

    return this.normalizeOutput(
      values,
      freqArray,
      labels,
      minDecibels,
      maxDecibels
    );
  }

  private static normalizeOutput(
    values: Float32Array,
    frequencies: number[],
    labels: string[],
    minDecibels: number,
    maxDecibels: number
  ): AudioAnalysisOutputType {
    const range = maxDecibels - minDecibels;
    const normalizedOutput = new Float32Array(values.length);

    for (let i = 0; i < values.length; i++) {
      normalizedOutput[i] = Math.max(
        0,
        Math.min((values[i] - minDecibels) / range, 1)
      );
    }

    return { values: normalizedOutput, frequencies, labels };
  }

  constructor(
    audioElement: HTMLAudioElement,
    audioBuffer: AudioBuffer | null = null
  ) {
    this.audio = audioElement;
    this.audioBuffer = audioBuffer;

    if (audioBuffer) {
      this.initializeOfflineContext(audioBuffer);
    } else {
      this.initializeRealTimeContext(audioElement);
    }
  }

  private initializeOfflineContext(audioBuffer: AudioBuffer) {
    const { length, sampleRate } = audioBuffer;
    const offlineContext = new OfflineAudioContext({
      length,
      sampleRate,
    });

    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    const analyser = offlineContext.createAnalyser();
    analyser.fftSize = AudioAnalysis.SMALLER_FFT_SIZE;
    analyser.smoothingTimeConstant = 0.1;
    source.connect(analyser);

    this.processOfflineAnalysis(
      offlineContext,
      analyser,
      source,
      length,
      sampleRate
    );

    this.context = offlineContext;
    this.analyser = analyser;
    this.sampleRate = sampleRate;
  }

  private initializeRealTimeContext(audioElement: HTMLAudioElement) {
    const audioContext = new AudioContext();
    const track = audioContext.createMediaElementSource(audioElement);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = AudioAnalysis.SMALLER_FFT_SIZE;
    analyser.smoothingTimeConstant = 0.1;
    track.connect(analyser);
    analyser.connect(audioContext.destination);

    this.context = audioContext;
    this.analyser = analyser;
    this.sampleRate = audioContext.sampleRate;
  }

  private processOfflineAnalysis(
    context: OfflineAudioContext,
    analyser: AnalyserNode,
    source: AudioBufferSourceNode,
    length: number,
    sampleRate: number
  ) {
    const renderQuantumInSeconds = 1 / 10; // Reduce to 10fps for better performance
    const durationInSeconds = length / sampleRate;
    const totalFrames = Math.ceil(durationInSeconds / renderQuantumInSeconds);

    const analyze = (index: number) => {
      const suspendTime = renderQuantumInSeconds * index;
      if (suspendTime < durationInSeconds) {
        context.suspend(suspendTime).then(() => {
          const fftResult = new Float32Array(analyser.frequencyBinCount);
          analyser.getFloatFrequencyData(fftResult);
          this.fftResults.push(fftResult);

          // Process in batches
          if (index % 5 === 0) {
            setTimeout(() => analyze(index + 1), 0);
          } else {
            analyze(index + 1);
          }
        });
      }
      if (index === 1) {
        context.startRendering();
      } else {
        context.resume();
      }
    };

    source.start(0);
    analyze(1);
  }

  getFrequencies(
    analysisType: "frequency" | "music" | "voice" = "frequency",
    minDecibels = -100,
    maxDecibels = -30
  ): AudioAnalysisOutputType {
    const now = performance.now();
    if (now - this.lastAnalysisTime < AudioAnalysis.THROTTLE_INTERVAL) {
      const cacheKey = `${analysisType}-${
        Math.floor(this.audio.currentTime * 10) / 10
      }`; // Round to 0.1s
      const cached = this.cachedAnalysis.get(cacheKey);
      if (cached) return cached;
    }

    let fftResult: Float32Array | null = null;
    if (this.audioBuffer && this.fftResults.length) {
      const pct = this.audio.currentTime / this.audio.duration;
      const index = Math.min(
        (pct * this.fftResults.length) | 0,
        this.fftResults.length - 1
      );
      fftResult = this.fftResults[index];
    }

    const result = AudioAnalysis.getFrequencies(
      this.analyser,
      this.sampleRate,
      fftResult,
      analysisType,
      minDecibels,
      maxDecibels
    );

    // Cache the result
    const cacheKey = `${analysisType}-${this.audio.currentTime.toFixed(2)}`;
    this.cachedAnalysis.set(cacheKey, result);
    if (this.cachedAnalysis.size > AudioAnalysis.CACHE_SIZE) {
      const firstKey = this.cachedAnalysis.keys().next().value;
      this.cachedAnalysis.delete(firstKey);
    }

    this.lastAnalysisTime = now;
    return result;
  }

  async resumeIfSuspended(): Promise<boolean> {
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
    return true;
  }
}

(globalThis as any).AudioAnalysis = AudioAnalysis;
