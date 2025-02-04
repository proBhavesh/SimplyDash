// src/lib/wavtools/wav_stream_player_singleton.ts

import { WavStreamPlayer } from './wav_stream_player';

let wavStreamPlayerInstance: WavStreamPlayer | null = null;

/**
 * Retrieves the singleton instance of WavStreamPlayer.
 * @returns {WavStreamPlayer | null} The singleton instance or null if on the server.
 */
export const getWavStreamPlayerInstance = (): WavStreamPlayer | null => {
  if (typeof window === 'undefined') {
    // We're on the server, do not instantiate
    console.warn('getWavStreamPlayerInstance called on the server. Returning null.');
    return null;
  }

  if (!wavStreamPlayerInstance) {
    wavStreamPlayerInstance = new WavStreamPlayer({ sampleRate: 24000 });
    console.log('WavStreamPlayer singleton instance created');
  }
  return wavStreamPlayerInstance;
};
