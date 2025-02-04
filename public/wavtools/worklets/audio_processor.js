// public/wavtools/worklets/audio_processor.js

class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.port.onmessage = this.receive.bind(this);
    this.initialize();
    this.lastMemoryCheck = Date.now();
    this.memoryCheckInterval = 1000; // Check memory every second
  }

  initialize() {
    this.foundAudio = false;
    this.recording = false;
    this.chunks = [];
    this.totalMemoryUsage = 0;
  }

  checkMemoryUsage() {
    // Estimate memory usage based on chunks
    const now = Date.now();
    if (now - this.lastMemoryCheck >= this.memoryCheckInterval) {
      this.lastMemoryCheck = now;
      
      // Estimate memory usage of chunks
      this.totalMemoryUsage = this.chunks.reduce((total, chunk) => {
        return total + chunk.reduce((channelTotal, channel) => {
          return channelTotal + channel.length * Float32Array.BYTES_PER_ELEMENT;
        }, 0);
      }, 0);

      // Send memory usage information to main thread
      this.port.postMessage({
        event: 'memoryUsage',
        data: {
          totalBytes: this.totalMemoryUsage,
          chunksCount: this.chunks.length
        }
      });
    }
  }

  readChannelData(chunks, channel = -1, maxChannels = 9) {
    let channelLimit;
    if (channel !== -1) {
      if (chunks[0] && chunks[0].length - 1 < channel) {
        throw new Error(
          `Channel ${channel} out of range: max ${chunks[0].length}`
        );
      }
      channelLimit = channel + 1;
    } else {
      channel = 0;
      channelLimit = Math.min(chunks[0] ? chunks[0].length : 1, maxChannels);
    }
    const channels = [];
    for (let n = channel; n < channelLimit; n++) {
      const length = chunks.reduce((sum, chunk) => {
        return sum + chunk[n].length;
      }, 0);
      const buffers = chunks.map((chunk) => chunk[n]);
      const result = new Float32Array(length);
      let offset = 0;
      for (let i = 0; i < buffers.length; i++) {
        result.set(buffers[i], offset);
        offset += buffers[i].length;
      }
      channels[n] = result;
    }
    return channels;
  }

  formatAudioData(channels) {
    if (channels.length === 1) {
      const float32Array = channels[0].slice();
      const meanValues = channels[0].slice();
      return { float32Array, meanValues };
    } else {
      const float32Array = new Float32Array(
        channels[0].length * channels.length
      );
      const meanValues = new Float32Array(channels[0].length);
      for (let i = 0; i < channels[0].length; i++) {
        const offset = i * channels.length;
        let meanValue = 0;
        for (let n = 0; n < channels.length; n++) {
          float32Array[offset + n] = channels[n][i];
          meanValue += channels[n][i];
        }
        meanValues[i] = meanValue / channels.length;
      }
      return { float32Array, meanValues };
    }
  }

  floatTo16BitPCM(float32Array) {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  }

  getValues(channel = -1) {
    const channels = this.readChannelData(this.chunks, channel);
    const { meanValues } = this.formatAudioData(channels);
    return { meanValues, channels };
  }

  export() {
    const channels = this.readChannelData(this.chunks);
    const { float32Array, meanValues } = this.formatAudioData(channels);
    const audioData = this.floatTo16BitPCM(float32Array);
    return {
      meanValues: meanValues,
      audio: {
        bitsPerSample: 16,
        channels: channels,
        data: audioData,
      },
    };
  }

  receive(e) {
    const { event, id } = e.data;
    let receiptData = {};
    switch (event) {
      case 'start':
        this.recording = true;
        break;
      case 'stop':
        this.recording = false;
        break;
      case 'clear':
        this.initialize();
        break;
      case 'export':
        receiptData = this.export();
        break;
      case 'read':
        receiptData = this.getValues();
        break;
      case 'getMemoryUsage':
        receiptData = {
          totalBytes: this.totalMemoryUsage,
          chunksCount: this.chunks.length
        };
        break;
      default:
        break;
    }
    this.port.postMessage({ event: 'receipt', id, data: receiptData });
  }

  sendChunk(chunk) {
    const channels = this.readChannelData([chunk]);
    const { float32Array, meanValues } = this.formatAudioData(channels);
    const rawAudioData = this.floatTo16BitPCM(float32Array);
    const monoAudioData = this.floatTo16BitPCM(meanValues);
    this.port.postMessage({
      event: 'chunk',
      data: {
        mono: monoAudioData,
        raw: rawAudioData,
      },
    });
  }

  process(inputList, outputList, parameters) {
    const sourceLimit = Math.min(inputList.length, outputList.length);
    for (let inputNum = 0; inputNum < sourceLimit; inputNum++) {
      const input = inputList[inputNum];
      const output = outputList[inputNum];
      const channelCount = Math.min(input.length, output.length);
      for (let channelNum = 0; channelNum < channelCount; channelNum++) {
        input[channelNum].forEach((sample, i) => {
          output[channelNum][i] = sample;
        });
      }
    }

    const inputs = inputList[0];
    let sliceIndex = 0;
    if (!this.foundAudio) {
      for (const channel of inputs) {
        sliceIndex = 0;
        if (this.foundAudio) {
          break;
        }
        if (channel) {
          for (const value of channel) {
            if (value !== 0) {
              this.foundAudio = true;
              break;
            } else {
              sliceIndex++;
            }
          }
        }
      }
    }

    if (inputs && inputs[0] && this.foundAudio && this.recording) {
      // We need to copy the TypedArray, because the `process` 
      // internals will reuse the same buffer to hold each input
      const chunk = inputs.map((input) => input.slice(sliceIndex));
      this.chunks.push(chunk);
      this.sendChunk(chunk);
      this.checkMemoryUsage();
    }

    return true;
  }
}

registerProcessor('audio_processor', AudioProcessor);
