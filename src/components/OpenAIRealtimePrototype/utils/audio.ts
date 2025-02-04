import { WavRecorder, WavStreamPlayer } from '../../../lib/wavtools';
import type { RealtimeEvent } from '../types';
import { log, Components } from './logger';

// Shared state for audio processing
let isAudioProcessing = false;
export const getIsAudioProcessing = () => isAudioProcessing;
export const setIsAudioProcessing = (value: boolean) => {
  isAudioProcessing = value;
};



export const handleAudioDelta = async (
  data: any,
  wavStreamPlayerRef: React.RefObject<WavStreamPlayer>,
  currentItemIdRef: React.MutableRefObject<string | null>
) => {
  if (!data.delta) return;

  try {
    const audioDataBase64 = data.delta;
    const audioBinaryString = atob(audioDataBase64);
    const len = audioBinaryString.length;
    const audioBuffer = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
      audioBuffer[i] = audioBinaryString.charCodeAt(i);
    }

    const trackId = data.item_id || 'default';
    
    // Skip processing if track is marked as interrupted
    if (trackStates.get(trackId)?.interrupted) {
      log('Skipping interrupted track', { 
        component: Components.AUDIO,
        details: { trackId }
      });
      return;
    }
    
    updateTrackState(trackId);

    // Only attempt reconnection if truly disconnected
    const status = wavStreamPlayerRef.current?.getStatus();
    if (!status?.isConnected || status?.contextState === 'closed') {
      console.warn('Audio system disconnected, attempting to reconnect...');
      try {
        await wavStreamPlayerRef.current?.reset();
        await wavStreamPlayerRef.current?.connect();
        
        // Verify successful reconnection
        const newStatus = wavStreamPlayerRef.current?.getStatus();
        if (!newStatus?.isConnected || newStatus?.contextState !== 'running') {
          throw new Error('Failed to reestablish audio connection');
        }
      } catch (error) {
        console.error('Failed to reconnect audio system:', error);
        throw new Error('Audio system disconnected');
      }
    }

    // Add new audio buffer with retry
    try {
      await wavStreamPlayerRef.current?.add16BitPCM(audioBuffer.buffer, trackId);
      console.log('Audio delta added to player for track:', trackId);
    } catch (error) {
      console.error('Error adding audio delta:', error);
      // Try to recover by resetting
      if (wavStreamPlayerRef.current) {
        await wavStreamPlayerRef.current.reset();
        // Retry once after reset
        await wavStreamPlayerRef.current.add16BitPCM(audioBuffer.buffer, trackId);
        console.log('Audio delta added after recovery for track:', trackId);
      }
    }

    if (!currentItemIdRef.current && data.item_id) {
      currentItemIdRef.current = data.item_id;
    }
  } catch (error) {
    console.error('Error handling audio delta:', error);
  }
};

// Track state management
const trackStates = new Map<string, {
  id: string;
  startTime: number;
  lastUpdate: number;
  interrupted: boolean;
}>();

let cleanupIntervalId: NodeJS.Timeout | null = null;

// Mark a track as complete and clean up
export const markTrackComplete = (trackId: string) => {
  // Remove the track state immediately since it's complete
  trackStates.delete(trackId);
  
  // If no tracks left, stop cleanup interval
  if (trackStates.size === 0 && cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
};

// Update track state
const updateTrackState = (trackId: string) => {
  const now = Date.now();
  const state = trackStates.get(trackId);
  
  if (state) {
    state.lastUpdate = now;
  } else {
    trackStates.set(trackId, {
      id: trackId,
      startTime: now,
      lastUpdate: now,
      interrupted: false
    });
  }
};

// Mark a track as interrupted
export const markTrackInterrupted = (trackId: string) => {
  const state = trackStates.get(trackId);
  if (state) {
    state.interrupted = true;
    log('Track marked as interrupted', { 
      component: Components.AUDIO,
      details: { trackId }
    });
  }
};

export const startAudioRecording = async (
  wavRecorderRef: React.RefObject<WavRecorder>,
  wsRef: React.MutableRefObject<WebSocket | null>,
  addRealtimeEvent: (source: 'client' | 'server', event: string) => void
) => {
  if (!wavRecorderRef.current) {
    console.error('WavRecorder not initialized');
    return;
  }

  try {
    await wavRecorderRef.current.begin();
    await wavRecorderRef.current.record((data: any) => {
      let audioData: Int16Array;

      if (data && data.mono instanceof Int16Array) {
        audioData = data.mono;
      } else if (data && data.mono instanceof ArrayBuffer) {
        audioData = new Int16Array(data.mono);
      } else if (data instanceof ArrayBuffer) {
        audioData = new Int16Array(data);
      } else if (data && data.raw instanceof Int16Array) {
        // Handle raw PCM data
        audioData = data.raw;
      } else {
        console.warn('Received unexpected data format from recorder:', data);
        return;
      }

      if (audioData.length === 0) {
        console.warn('Received empty audio data chunk, skipping.');
        return;
      }

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const byteArray = new Uint8Array(audioData.buffer);
        let binaryString = '';
        for (let i = 0; i < byteArray.length; i++) {
          binaryString += String.fromCharCode(byteArray[i] & 0xff);
        }
        const base64Audio = btoa(binaryString);

        if (base64Audio.length === 0) {
          console.warn('Base64 encoded audio is empty, skipping.');
          return;
        }

        const audioAppendEvent = {
          type: 'input_audio_buffer.append',
          audio: base64Audio,
        };
        wsRef.current.send(JSON.stringify(audioAppendEvent));
        addRealtimeEvent('client', 'input_audio_buffer.append');
      }
    });
  } catch (error) {
    console.error('Error starting audio recording:', error);
  }
};

export const stopAudioRecording = async (wavRecorderRef: React.RefObject<WavRecorder>) => {
  if (!wavRecorderRef.current) {
    console.error('WavRecorder not initialized');
    return;
  }

  try {
    const recorderStatus = wavRecorderRef.current.getStatus();
    if (recorderStatus === 'recording' || recorderStatus === 'paused') {
      await wavRecorderRef.current.end();
    }
  } catch (error) {
    console.error('Error stopping audio recording:', error);
  }
};

export const stopAudioPlayback = async (wavStreamPlayerRef: React.RefObject<WavStreamPlayer>) => {
  try {
    // Clear track states
    trackStates.clear();
    
    if (cleanupIntervalId) {
      clearInterval(cleanupIntervalId);
      cleanupIntervalId = null;
    }
    
    if (!wavStreamPlayerRef.current) return;

    // First try graceful flush
    try {
      await wavStreamPlayerRef.current.flush().catch(error => {
        console.warn('Audio flush failed:', error);
      });
    } catch (error) {
      console.warn('Audio flush error caught:', error);
    }

    // Then try to disconnect
    try {
      await wavStreamPlayerRef.current.disconnect().catch(error => {
        console.warn('Audio disconnect failed:', error);
      });
    } catch (error) {
      console.warn('Audio disconnect error caught:', error);
    }

    // Always reset as final cleanup step
    try {
      await wavStreamPlayerRef.current.reset();
    } catch (error) {
      console.error('Audio reset failed:', error);
    }

    // Give a small delay for cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Initialize fresh audio context if needed
    try {
      await wavStreamPlayerRef.current.connect();
    } catch (error) {
      console.error('Failed to reinitialize audio:', error);
    }
  } catch (error) {
    console.error('Error in stopAudioPlayback:', error);
    // Last resort - try one final reset
    if (wavStreamPlayerRef.current) {
      try {
        await wavStreamPlayerRef.current.reset();
        await wavStreamPlayerRef.current.connect();
      } catch (finalError) {
        console.error('Failed final audio recovery attempt:', finalError);
      }
    }
  }
};

