// src/lib/AudioPlayer.ts

export class AudioPlayer {
  private context: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private audioQueue: AudioBuffer[] = [];
  private isPlaying = false;

  constructor(private sampleRate: number = 24000) {}

  async connect(): Promise<boolean> {
    if (!this.context) {
      this.context = new AudioContext({ sampleRate: this.sampleRate });
    }
    return true;
  }

  async add16BitPCM(arrayBuffer: ArrayBuffer, trackId: string): Promise<void> {
    if (!this.context) {
      throw new Error('AudioPlayer not connected. Call connect() first.');
    }

    const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
    this.audioQueue.push(audioBuffer);

    if (!this.isPlaying) {
      this.playNextInQueue();
    }
  }

  private playNextInQueue(): void {
    if (this.audioQueue.length === 0 || !this.context) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const audioBuffer = this.audioQueue.shift()!;
    this.sourceNode = this.context.createBufferSource();
    this.sourceNode.buffer = audioBuffer;
    this.sourceNode.connect(this.context.destination);
    this.sourceNode.onended = () => this.playNextInQueue();
    this.sourceNode.start();
  }

  async interrupt(): Promise<void> {
    if (this.sourceNode) {
      this.sourceNode.stop();
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    this.audioQueue = [];
    this.isPlaying = false;
  }
}
